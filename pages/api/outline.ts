// /pages/api/outline.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode, type StepName } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

type Ok   = { outline: string; outlineId: string };
type Err  = { error: string };
type ResBody = Ok | Err;

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

  // —— 在這裡新增「二級要點」示範與格式化指引 ——  
  const prompt = `
請產生「段落式大綱」，**務必**照以下規則：
1. 中文用「一、二、三…」，英文用「1. 2. 3.…」編號。
2. 每節標題獨立一行，後面不加任何符號。
3. 每節下至少 2–4 條「- 主要點」，並在必要時為每個主要點再加 a./b. 子要點。
4. 要解說文字。
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

二、 AI 的核心概念
- 弱 AI vs. 強 AI
  a. 弱 AI：專注任務，如推薦系統
  b. 強 AI：通用智慧，仍在研究
- 機器學習與深度學習
  a. ML：數據驅動模式識別
  b. DL：多層神經網路

請直接輸出，不要額外說明。`.trim();

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
    // fallback to GPT-3.5
    const opt2 = mapMode('outline' as StepName, 'gpt-3.5');
    modelUsed = opt2.model;
    outline = await callLLM(
      [{ role: 'user', content: prompt }],
      { ...opt2, title: 'Assignment Terminator', referer: process.env.NEXT_PUBLIC_APP_URL }
    );
  }

  // --- 後處理：強制換行（只在行首斷節，避免誤切「AI」等詞） ---
  outline = outline
    .replace(/(^|\n)([一二三四五六七八九十]+[、]|[IVX]+\.)\s*/g, '$1$2 ')
    .replace(/(^|\n)([A-Z])\.\s*/g, '$1$2. ')
    .replace(/\n{2,}/g, '\n')
    .trim();

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
