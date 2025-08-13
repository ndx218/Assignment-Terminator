// /pages/api/outline.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode, type StepName } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

type Ok   = { outline: string; outlineId: string };
type Err  = { error: string };
type ResBody = Ok | Err;

/** 將 1..20 轉中文數字（章節用） */
function toZhNum(n: number): string {
  const base = ['零','一','二','三','四','五','六','七','八','九','十'];
  if (n <= 10) return base[n];
  if (n < 20) return '十' + base[n - 10];
  if (n % 10 === 0) return base[Math.floor(n / 10)] + '十';
  return base[Math.floor(n / 10)] + '十' + base[n % 10];
}

/** 將「— / – / • 標題」行正規化為章節標題（中文→一、；英文→1.）
 * - 不會動到一般 "- 子彈點"
 * - 已經是「一、 / 1. / I.」的標題會原樣保留
 */
function normalizeHeaders(text: string, language: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let sec = 0;

  const okHeader = /^((?:[一二三四五六七八九十]+、)|(?:[IVXLCDM]+\. )|(?:\d+\. ))/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { out.push(''); continue; }

    // 原本就以 "- " 開頭的子彈，不變
    if (/^- /.test(line)) { out.push(line); continue; }

    // 已是可辨識標題，保留
    if (okHeader.test(line + ' ')) { out.push(line); continue; }

    // 「— / – / • 」開頭 → 升級為編號標題
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST' });
  }

  // 驗證登入（避免匿名亂刷）
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

  // —— 你的提示詞（保留你的二級要點規則 + 每節最後 > 說明）——
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
    // fallback to GPT-3.5（保留你的行為）
    const opt2 = mapMode('outline' as StepName, 'gpt-3.5');
    modelUsed = opt2.model;
    outline = await callLLM(
      [{ role: 'user', content: prompt }],
      { ...opt2, title: 'Assignment Terminator', referer: process.env.NEXT_PUBLIC_APP_URL }
    );
  }

  // --- 後處理流程：先正規化標題 → 再做你的行首整理 → 最後加「（約 N 字）」 ---
  outline = normalizeHeaders(outline, String(language || '中文'));

  outline = outline
    // 中文數字或羅馬/阿拉伯章節號 → 保留行首
    .replace(/(^|\n)([一二三四五六七八九十]+[、]|[IVXLCDM]+\.)\s*/g, '$1$2 ')
    // 子編號 A. B. C. 行首
    .replace(/(^|\n)([A-Z])\.\s*/g, '$1$2. ')
    // 合併多餘空行
    .replace(/\n{2,}/g, '\n')
    .trim();

  outline = appendWordBudgets(outline, language, wc);

  // 防守：避免超長
  const finalOutline = outline.slice(0, 100_000);

  // --- 落庫到 Outline ---
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

/* ================== 小工具：在標題後面加「建議字數」 ================== */
/**
 * 規則：
 * - 偵測章節標題行（中文一、二…；阿拉伯 1. 2.…；羅馬 I. II.…）
 * - 若 >=3 節：Intro 14%、Conclusion 14%，其餘 Body 平分 72%
 * - 若 2 節：40% / 60%
 * - 其餘：平均分配
 * - 中文顯示「（約 N 字）」；英文顯示「 (≈ N words)」
 */
function appendWordBudgets(raw: string, language: string, total: number) {
  const lines = raw.split(/\r?\n/);

  // 抓章節標題（行首）
  const headerRegex = /^((?:[一二三四五六七八九十]+、)|(?:[IVXLCDM]+\.)|(?:\d+\.))\s*(.+)$/;
  const headers: { idx: number; marker: string; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headerRegex);
    if (m) {
      const marker = m[1];
      const title = m[2].trim();
      headers.push({ idx: i, marker, title });
    }
  }

  if (headers.length === 0) return raw;

  const isZH = /中|中文|zh/i.test(language);

  // 找出 intro / conclusion（若沒寫明，預設第一個 / 最後一個）
  const introIdx =
    headers.find(h => /引言|前言|introduction/i.test(h.title))?.idx ?? headers[0].idx;
  const conclusionIdx =
    headers.find(h => /結論|總結|結語|conclusion/i.test(h.title))?.idx ?? headers[headers.length - 1].idx;

  // 配權重
  const weights: number[] = new Array(headers.length).fill(0);
  if (headers.length >= 3) {
    const introW = 0.14;
    const conclW = 0.14;
    const remain = 1 - introW - conclW;
    const bodyCount = headers.length - 2;
    for (let i = 0; i < headers.length; i++) {
      if (i === headers.findIndex(h => h.idx === introIdx)) weights[i] = introW;
      else if (i === headers.findIndex(h => h.idx === conclusionIdx)) weights[i] = conclW;
      else weights[i] = remain / bodyCount;
    }
  } else if (headers.length === 2) {
    weights[0] = 0.4;
    weights[1] = 0.6;
  } else {
    weights[0] = 1;
  }

  // 轉成實際字數（四捨五入到 10）
  let budgets = weights.map(w => Math.max(50, Math.round((total * w) / 10) * 10));
  // 微調總和差距
  const diff = total - budgets.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    const sign = diff > 0 ? 1 : -1;
    for (let i = 0, left = Math.abs(diff); i < headers.length && left > 0; i++) {
      budgets[i] += 10 * sign;
      left -= 10;
    }
  }

  // 套到每個標題行（先移除舊的括號字數，避免重覆）
  const cleanTail = isZH
    ? /\s*（約\s*\d+\s*字）\s*$/
    : /\s*\(≈\s*\d+\s*words\)\s*$/i;

  headers.forEach((h, idx) => {
    const budget = budgets[idx];
    const suffix = isZH ? `（約 ${budget} 字）` : ` (≈ ${budget} words)`;
    const original = lines[h.idx].replace(cleanTail, '');
    lines[h.idx] = `${original}${suffix}`;
  });

  return lines.join('\n');
}
