/* /pages/api/outline.ts */
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode, type StepName } from '@/lib/ai';

type ResBody = { outline: string } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>,
) {
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST' });

  const {
    title, wordCount, language, tone,
    detail = '', reference = '', rubric = '', paragraph = '',
    mode = 'gemini-flash',
  } = (req.body ?? {}) as Record<string, any>;

  const wc = Number(wordCount);
  if (typeof title !== 'string' || typeof language !== 'string' || typeof tone !== 'string' || !Number.isFinite(wc)) {
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

  try {
    const llmOpts = mapMode('outline' as StepName, mode);
    const outline = await callLLM(
      [{ role: 'user', content: prompt }],
      { ...llmOpts, title: 'Assignment Terminator', referer: process.env.NEXT_PUBLIC_APP_URL }
    );
    return res.status(200).json({ outline: outline || '⚠️ 生成失敗' });
  } catch (err: any) {
    // Log concrete reason; keep UI generic
    console.error('[outline]', { mode, err: err?.message ?? String(err) });
    return res.status(500).json({ error: 'AI 服務錯誤，請稍後再試' });
  }
}
