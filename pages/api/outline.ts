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

/* ---------- 保障章節數量與結構：補齊主體段與結論 ---------- */
function ensureMinSections(
  raw: string,
  language: string,
  desiredBodies: number // 例如 3
): string {
  const isZH = /中|中文|zh/i.test(String(language));
  const headerRe = /^((?:[一二三四五六七八九十]+、)|(?:[IVXLCDMivxlcdm]+\.)|(?:\d+\.))\s*(.+)$/;

  const lines = raw.split(/\r?\n/);
  type Sec = { title: string; content: string[] };
  const secs: Sec[] = [];
  let cur: Sec | null = null;

  const pushCur = () => { if (cur) { cur.content = cur.content.map(s => s.trimEnd()); secs.push(cur); } };

  for (const ln of lines) {
    const m = ln.match(headerRe);
    if (m) {
      pushCur();
      cur = { title: m[2].trim(), content: [] };
    } else {
      if (!cur) cur = { title: isZH ? '引言' : 'Introduction', content: [] };
      cur!.content.push(ln);
    }
  }
  pushCur();

  const needBodies = Math.max(1, Number.isFinite(desiredBodies) ? desiredBodies : 3);
  const targetCount = needBodies + 2; // Intro + bodies + Conclusion

  if (secs.length >= 3) {
    // 夠用就不硬補
  } else if (secs.length === 2) {
    while (secs.length < targetCount - 1) secs.push({ title: '（主體待補）', content: ['- （請補充要點）'] });
    secs.push({ title: isZH ? '結論' : 'Conclusion', content: ['- （總結與展望）'] });
  } else if (secs.length === 1) {
    while (secs.length < targetCount - 1) secs.push({ title: '（主體待補）', content: ['- （請補充要點）'] });
    secs.push({ title: isZH ? '結論' : 'Conclusion', content: ['- （總結與展望）'] });
  }

  // 重新依語言編號（中文/阿拉伯）
  const rebuilt: string[] = [];
  for (let i = 0; i < secs.length; i++) {
    const marker = isZH ? `${toZhNum(i + 1)}、` : `${i + 1}.`;
    rebuilt.push(`${marker} ${secs[i].title}`);
    rebuilt.push(...secs[i].content);
  }
  return rebuilt.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- 固定章節命名：引言 / 主體段N / 結論（不接自訂標題） ---------- */
type ParagraphPlan = {
  intro?: number;
  conclusion?: number;
  bodyCount?: number;
  body?: number[];
  bodyTitles?: string[];
};

function normalizeSectionTitles(
  raw: string,
  language: string,
  _plan?: ParagraphPlan
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

  let budgets = new Array(headers.length).fill(0);

  const introPos =
    headers.findIndex(h => /引言|前言|introduction/i.test(h.title)) >= 0
      ? headers.findIndex(h => /引言|前言|introduction/i.test(h.title))
      : 0;
  const conclPos =
    headers.findIndex(h => /結論|總結|結語|conclusion/i.test(h.title)) >= 0
      ? headers.findIndex(h => /結論|總結|結語|conclusion/i.test(h.title))
      : headers.length - 1;

  if (plan && total > 0) {
    const bodySlots: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      if (i !== introPos && i !== conclPos) bodySlots.push(i);
    }

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
      } else {
        const per = bodySlots.length ? Math.round(bodyTotal / bodySlots.length) : 0;
        bodySlots.forEach((pos) => (budgets[pos] = per));
      }
    }
  } else {
    // 備援比例：14% / 均分 72% / 14%
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

  // 最低 50、四捨五入到 10
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

/* ================== 章節解析與缺內容回填（自動補子彈） ================== */
function parseSections(text: string) {
  const headerRe = /^((?:[一二三四五六七八九十]+、)|(?:[IVXLCDMivxlcdm]+\.)|(?:\d+\.))\s*(.+)$/;
  const lines = text.split(/\r?\n/);
  const idxs: number[] = [];
  for (let i = 0; i < lines.length; i++) if (headerRe.test(lines[i])) idxs.push(i);
  const secs = idxs.map((start, i) => {
    const end = i + 1 < idxs.length ? idxs[i + 1] : lines.length;
    const header = lines[start];
    const body = lines.slice(start + 1, end);
    const m = header.match(headerRe)!;
    return { start, end, header, title: m[2].trim(), body };
  });
  return { lines, secs, headerRe };
}

function isMissingBody(bodyLines: string[]) {
  const clean = bodyLines.map(s => s.trim()).filter(Boolean);
  if (clean.length === 0) return true;
  const onlyPlaceholders = clean.every(s =>
    /^[-•]?\s*[（(]/.test(s) || /^> 說明：/.test(s)
  );
  const hasBullet = clean.some(s => /^[-•]\s+/.test(s));
  return onlyPlaceholders || !hasBullet;
}

async function backfillMissingBullets(
  outline: string,
  ctx: { title: string; language: string; tone: string; detail?: string; reference?: string },
  llmOpt: { model: string; temperature?: number; timeoutMs?: number; title?: string; referer?: string }
) {
  const { lines, secs } = parseSections(outline);
  const missing = secs.filter(s => isMissingBody(s.body));
  if (missing.length === 0) return outline;

  for (const sec of missing) {
    const prompt = `
請用「${ctx.language}」為主題《${ctx.title}》中的章節「${sec.title}」補出 3–5 條要點：
- 直接輸出每行以「- 」開頭的子彈點
- 不要加章節標題、不要加小節編號或其他說明
- 語氣：${ctx.tone}
- 盡量呼應本文的整體主題；可參考：${(ctx.detail || '').slice(0, 200)}
`.trim();

    let bullets = '';
    try {
      bullets = await callLLM([{ role: 'user', content: prompt }], {
        ...llmOpt,
        temperature: Math.min(0.8, (llmOpt.temperature ?? 0.6)),
        timeoutMs: Math.max(30_000, llmOpt.timeoutMs ?? 30_000),
        title: 'Outline Backfill',
      });
    } catch {
      continue; // 忽略失敗，保留佔位
    }

    const cleaned = String(bullets || '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => (s.startsWith('- ') ? s : `- ${s}`));

    // 找最後一條「> 說明：」
    let explain: string | null = null;
    for (let i = sec.body.length - 1; i >= 0; i--) {
      const t = sec.body[i]?.trim();
      if (t && /^> 說明：/.test(t)) { explain = sec.body[i]; break; }
    }

    const newBody = [...cleaned.slice(0, 5), ...(explain ? [explain] : [])];
    lines.splice(sec.start + 1, sec.end - (sec.start + 1), ...newBody);
  }

  return lines.join('\n');
}

/* ================== Handler ================== */
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
    paragraphPlan, // 可選：前端段落規劃器
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
    const bCount =
      Number(paragraphPlan.bodyCount) ||
      (Array.isArray(paragraphPlan.body) ? paragraphPlan.body.length : 0);
    return `
【段落規劃（硬性要求）】
- 引言：${paragraphPlan.intro ?? '依比例'} 字
- 主體段數：${bCount || '依比例'} 段（依序寫出）
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

  // --- 後處理：升級/清理標題 → 補齊章節 → 固定命名 → 加建議字數 → 回填缺內容 ---
  outline = normalizeHeaders(outline, String(language || '中文'));

  outline = outline
    .replace(/(^|\n)([一二三四五六七八九十]+[、]|[IVXLCDMivxlcdm]+\.)\s*/g, '$1$2 ')
    .replace(/(^|\n)([A-Z])\.\s*/g, '$1$2. ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  // 主體段數：優先 paragraphPlan.bodyCount，其次 paragraph（純數字），預設 3
  const desiredBodyCount =
    Number((req.body as any)?.paragraphPlan?.bodyCount) ||
    (Number.isFinite(parseInt(String(paragraph), 10)) ? parseInt(String(paragraph), 10) : 3);

  outline = ensureMinSections(outline, String(language || '中文'), desiredBodyCount);
  outline = normalizeSectionTitles(outline, String(language || '中文'), paragraphPlan);
  outline = appendWordBudgets(outline, language, wc, paragraphPlan);

  // ★ 自動回填缺內容的章節（補 3–5 條要點）
  try {
    const optForBackfill = mapMode('outline' as StepName, mode);
    outline = await backfillMissingBullets(
      outline,
      { title, language, tone, detail, reference },
      optForBackfill
    );
  } catch {
    // 忽略回填失敗，保留現況
  }

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
