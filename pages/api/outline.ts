/* /pages/api/outline.ts */
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode, type StepName } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

type Ok = { outline: string; outlineId: string };
type Err = { error: string };
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

  const prompt = `請根據以下資料產生段落大綱：
題目：${title}
字數：約 ${wc}
語言：${language}（語氣：${tone}）
細節：${detail}
引用：${reference}
評分準則：${rubric}
段落要求：${paragraph || '依內容合理規劃'} 段`;

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

  // --- 後處理：強制換行（中文 & 英文都能正確斷節） ---
  outline = outline
    // 在大節標號前加換行
    .replace(/([IVX一二三四五六七八九十]+[\\.、]?)\s*/g, '\n$1 ')
    // 在細節小標 (A. B. C.) 前也加換行
    .replace(/([A-Z])\.[ \t]*/g, '\n$1. ')
    // 移除多餘空行
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
