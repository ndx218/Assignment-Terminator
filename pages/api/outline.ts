// /pages/api/outline.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode, type StepName } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

type Ok   = { outline: string; outlineId: string };
type Err  = { error: string };
type ResBody = Ok | Err;

/* ---------- 小工具：1..20 轉中文數字（章節用） ---------- */
function toZhNum(n: number): string {
  const base = ['零','一','二','三','四','五','六','七','八','九','十'];
  if (n <= 10) return base[n];
  if (n < 20) return '十' + base[n - 10];
  if (n % 10 === 0) return base[Math.floor(n / 10)] + '十';
  return base[Math.floor(n / 10)] + '十' + base[n % 10];
}

/* ---------- – / — / • 開頭行，升級為章節標題；保留既有「一、 / 1. / I.」 ---------- */
function normalizeHeaders(text: string, language: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let sec = 0;

  const okHeader = /^((?:[一二三四五六七八九十]+、)|(?:[IVXLCDMivxlcdm]+\. )|(?:\d+\. ))/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { out.push(''); continue; }

    if (/^- /.test(line)) { out.push(line); continue; } // 子彈點

    if (okHeader.test(line + ' ')) { out.push(line); continue; }

    const m = line.match(/^[—–•]\s*(.+)$/);
    if (m && m[1]) {
      sec += 1;
      const title = m[1].trim();
      const isZH = /中|中文|zh/i.test(language);
      out.push(isZH ? `${toZhNum(sec)}、 ${title}` : `${sec}. ${title}`);
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/* ---------- 固定章節命名：引言 / 主體段N / 結論（可接自訂 body 標題） ---------- */
type ParagraphPlan = {
  intro?: number;
  conclusion?: number;
  bodyCount?: number;
  body?: number[];
  bodyTitles?: string[];
};

/* ---------- 固定章節命名：只顯示「引言／主體段N／結論」，不接自訂標題 ---------- */
function normalizeSectionTitles(
  raw: string,
  language: string,
  _plan?: ParagraphPlan  // 故意保留參數，內部不使用
) {
  const isZH = /中|中文|zh/i.test(String(language));
  const lines = raw.split(/\r?\n/);
  const headerRe = /^((?:[一二三四五六七八九十]+、)|(?:[IVXLCDMivxlcdm]+\.)|(?:\d+\.))\s*(.+)$/;

  const headerIdxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) headerIdxs.push(i);
  }
  if (headerIdxs.length === 0) return raw;

  let bodySeen = 0;

  headerIdxs.forEach((idx, k) => {
    const m = lines[idx].match(headerRe)!;
    const marker = m[1];

    let fixed = '';
    if (headerIdxs.length === 1) {
      fixed = isZH ? '引言' : 'Introduction';
    } else if (k === 0) {
      fixed = isZH ? '引言' : 'Introduction';
    } else if (k === headerIdxs.length - 1) {
      fixed = isZH ? '結論' : 'Conclusion';
    } else {
      bodySeen += 1;
      fixed = isZH ? `主體段${toZhNum(bodySeen)}` : `Body Paragraph ${bodySeen}`;
    }

    lines[idx] = `${marker} ${fixed}`;
  });

  return lines.join('\n');
}

/* ---------- 在標題後面加「建議字數」：優先用 paragraphPlan ---------- */
function appendWordBudgets(
  raw: string,
  language: string,
  total: number,
  plan?: ParagraphPlan
) {
  const lines = raw.split(/\r?\n/);
  const headerRegex = /^((?:[一二三四五六七八九十]+、)|(?:[IVXLCDMivxlcdm]+\.)|(?:\d+\.))\s*(.+)$/;
  const headers: { idx: number; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headerRegex);
    if (m) headers.push({ idx: i, title: m[2].trim() });
  }
  if (headers.length === 0) return raw;

  const isZH = /中|中文|zh/i.test(language);

  // 先建立空 weights/budgets
  let budgets = new Array(headers.length).fill(0);

  const introPos =
    headers.findIndex(h => /引言|前言|introduction/i.test(h.title)) >= 0
      ? headers.findIndex(h => /引言|前言|introduction/i.test(h.title))
      : 0;
  const conclPos =
    headers.findIndex(h => /結論|總結|結語|conclusion/i.test(h.title)) >= 0
      ? headers.findIndex(h => /結論|總結|結語|conclusion/i.test(h.title))
      : headers.length - 1;

  // ★ 優先：paragraphPlan
  if (plan && total > 0) {
    const bodySlots: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      if (i !== introPos && i !== conclPos) bodySlots.push(i);
    }

    // intro/conclusion
    if (headers.length === 1) {
      budgets[0] = plan.intro ?? total;
    } else if (headers.length === 2) {
      budgets[introPos] = plan.intro ?? Math.round(total * 0.4);
      budgets[conclPos] = plan.conclusion ?? Math.round(total * 0.6);
    } else {
      budgets[introPos] = plan.intro ?? Math.round(total * 0.14);
      budgets[conclPos] = plan.conclusion ?? Math.round(total * 0.14);
      const bodyTotal = Math.max(0, total - budgets[introPos] - budgets[conclPos]);
      const desired = plan.body && plan.body.length ? plan.body.slice(0, bodySlots.length) : [];
      if (desired.length === bodySlots.length) {
        desired.forEach((v, i) => (budgets[bodySlots[i]] = v));
        // 若總和與 total 有落差，下面會矯正
      } else {
        const per = bodySlots.length ? Math.round(bodyTotal / bodySlots.length) : 0;
        bodySlots.forEach((pos) => (budgets[pos] = per));
      }
    }
  } else {
    // 備援：14/72/14 + 均分
    const weights: number[] = new Array(headers.length).fill(0);
    if (headers.length >= 3) {
      const introW = 0.14, conclW = 0.14;
      const remain = 1 - introW - conclW;
      const bodyCount = headers.length - 2;
      for (let i = 0; i < headers.length; i++) {
        if (i === introPos) weights[i] = introW;
        else if (i === conclPos) weights[i] = conclW;
        else weights[i] = remain / bodyCount;
      }
    } else if (headers.length === 2) {
      weights[introPos] = 0.4;
      weights[conclPos] = 0.6;
    } else {
      weights[0] = 1;
    }
    budgets = weights.map(w => Math.max(50, Math.round((total * w) / 10) * 10));
  }

  // 四捨五入到 10、最低 50 字
  budgets = budgets.map(b => Math.max(50, Math.round(b / 10) * 10));

  // 矯正總和差距
  const diff = total - budgets.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    const sign = diff > 0 ? 1 : -1;
    for (let i = 0, left = Math.abs(diff); i < headers.length && left > 0; i++) {
      budgets[i] += 10 * sign;
      left -= 10;
    }
  }

  // 去除舊的括號標示再加新尾註
  const cleanTail = isZH
    ? /\s*（約\s*\d+\s*字）\s*$/
    : /\s*\(≈\s*\d+\s*words\)\s*$/i;

  headers.forEach((h, idx) => {
    const suffix = isZH ? `（約 ${budgets[idx]} 字）` : ` (≈ ${budgets[idx]} words)`;
    const original = lines[h.idx].replace(cleanTail, '');
    lines[h.idx] = `${original}${suffix}`;
  });

  return lines.join('\n');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST' });
  }

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: '未登入' });
  }

  const {
    title,
    wordCount,
    language,
    tone,
    detail = '',
    reference = '',
    rubric = '',
    paragraph = '',
    paragraphPlan, // ★ 新增：前端傳來的段落規劃
    mode = 'gemini-flash',
  } = (req.body ?? {}) as Record<string, any>;

  const wc = Number(wordCount);
  if (
    typeof title !== 'string' ||
    typeof language !== 'string' ||
    typeof tone !== 'string' ||
    !Number.isFinite(wc)
  ) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  // —— 提示詞（保留二級要點規則 + 每節最後 > 說明）——
  const planHint = (() => {
    if (!paragraphPlan) return '';
    const bCount = Number(paragraphPlan.bodyCount) || (Array.isArray(paragraphPlan.body) ? paragraphPlan.body.length : 0);
    return `
【段落規劃（硬性要求）】
- 引言：${paragraphPlan.intro ?? '依比例'} 字
- 主體段數：${bCount} 段（依序寫出）
- 主體各段字數：${Array.isArray(paragraphPlan.body) ? paragraphPlan.body.join('、') : '依比例'} 字
- 結論：${paragraphPlan.conclusion ?? '依比例'} 字
`.trim();
  })();

  const prompt = `
請產生「段落式大綱」，**務必**照以下規則：
1. 中文用「一、二、三…」，英文用「1. 2. 3.…」編號。
2. 每節標題獨立一行，後面不加任何符號。
3. 每節下至少 2–4 條「- 主要點」，可視需要在每條主要點下再加 a./b. 子要點（縮排兩空白）。
4. 每個章節最後加 1 行補充說明，開頭寫 **"> 說明："**（提供脈絡與延伸，不要放連結）。
5. 不要多餘空行。

【需求】
題目：${title}
字數：約 ${wc}
語言：${language}（語氣：${tone}）
細節：${detail}
引用：${reference}
評分準則：${rubric}
段落要求：${paragraph || '依內容合理規劃'} 段
${planHint ? '\n' + planHint : ''}

【中文輸出範例】
一、 引言
- 介紹人工智慧（AI）的概念
  a. 定義：模擬人類認知的技術
  b. 關鍵能力：學習、推理、感知
- 討論 AI 的重要性
  a. 社會影響：自動化與效率
  b. 經濟影響：創新與競爭
> 說明：本段建立主題背景與重要性，為後文鋪陳。

二、 AI 的核心概念
- 弱 AI vs. 強 AI
  a. 弱 AI：專注任務，如推薦系統
  b. 強 AI：通用智慧，仍在研究
- 機器學習與深度學習
  a. ML：數據驅動模式識別
  b. DL：多層神經網路
> 說明：本段釐清術語與範疇，降低誤解。

請直接輸出大綱內容，不要額外說明。`.trim();

  // --- 呼叫 LLM（含 fallback） ---
  let outline = '';
  let modelUsed = '';
  try {
    const opt1 = mapMode('outline' as StepName, mode);
    modelUsed = opt1.model;
    outline = await callLLM(
      [{ role: 'user', content: prompt }],
      { ...opt1, title: 'Assignment Terminator', referer: process.env.NEXT_PUBLIC_APP_URL }
    );
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const needFallback =
      /OPENROUTER_HTTP_4\d\d/.test(msg) ||
      /not a valid model id/i.test(msg) ||
      /model.*not.*found/i.test(msg);
    if (!needFallback) {
      console.error('[outline:first-call]', { mode, err: msg });
      return res.status(500).json({ error: 'AI 服務錯誤，請稍後再試' });
    }
    try {
      const opt2 = mapMode('outline' as StepName, 'gpt-3.5');
      modelUsed = opt2.model;
      outline = await callLLM(
        [{ role: 'user', content: prompt }],
        { ...opt2, title: 'Assignment Terminator', referer: process.env.NEXT_PUBLIC_APP_URL }
      );
    } catch (e2: any) {
      console.error('[outline:fallback]', { mode, err: String(e2?.message ?? e2) });
      return res.status(500).json({ error: 'AI 服務錯誤，請稍後再試' });
    }
  }

  // --- 後處理：先升級/清理標題 → 固定命名 → 加建議字數 ---
  outline = normalizeHeaders(outline, String(language || '中文'));

  outline = outline
    .replace(/(^|\n)([一二三四五六七八九十]+[、]|[IVXLCDMivxlcdm]+\.)\s*/g, '$1$2 ')
    .replace(/(^|\n)([A-Z])\.\s*/g, '$1$2. ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  outline = normalizeSectionTitles(outline, String(language || '中文'), paragraphPlan);
  outline = appendWordBudgets(outline, language, wc, paragraphPlan);

  const finalOutline = outline.slice(0, 100_000);

  // --- 落庫 ---
  try {
    const rec = await prisma.outline.create({
      data: {
        userId: session.user.id,
        title: String(title).slice(0, 512),
        content: finalOutline,
      },
      select: { id: true },
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('[outline:ok]', { outlineId: rec.id, modelUsed });
    }
    return res.status(200).json({ outline: finalOutline, outlineId: rec.id });
  } catch (dbErr: any) {
    console.error('[outline:db]', { err: String(dbErr?.message ?? dbErr) });
    return res.status(500).json({ error: '資料庫錯誤，請稍後再試' });
  }
}
