/* pages/api/outline.ts --------------------------------------------- */
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode } from '@/lib/ai';
import { StepName } from '@/lib/points';

type ResBody =
  | { outline: string }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>,
) {
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST' });

  const {
    title, wordCount, language, tone,
    detail = '', reference = '', rubric = '', paragraph = '',
    mode = 'free',       // 前端會傳進來
  } = req.body as Record<string, any>;

  if (![title, wordCount, language, tone].every(v => typeof v === 'string')) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const prompt = `請根據以下資料產生段落大綱：
題目：${title}
字數：約 ${wordCount}
語言：${language}（語氣：${tone}）
細節：${detail}
引用：${reference}
評分準則：${rubric}
段落要求：${paragraph} 段`;

  try {
    const llmOpts = mapMode('outline' satisfies StepName, mode);
    const outline = await callLLM(
      [{ role: 'user', content: prompt }],
      llmOpts,
    );
    return res.status(200).json({ outline: outline || '⚠️ 生成失敗' });
  } catch (err: any) {
    console.error('[outline]', err);
    return res.status(500).json({ error: 'AI 服務錯誤，請稍後再試' });
  }
}
