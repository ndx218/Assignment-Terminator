// /pages/api/feedback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode } from '@/lib/ai';

type ResBody = { feedback: string } | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResBody>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST requests are allowed' });

  const { text, mode = 'free' } = (req.body ?? {}) as Record<string, any>;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Missing required field: text' });
  }

  const system = '你是一位嚴格但鼓勵學生的老師。請指出這篇文章中的問題或不足，並給出具體改善建議。使用條列式，避免重寫全文。';

  try {
    const llmOpts = mapMode('review', mode);
    const feedback = await callLLM(
      [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      { ...llmOpts, title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator', referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL }
    );
    return res.status(200).json({ feedback: feedback || '⚠️ 教師評論生成失敗' });
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    if (msg.startsWith('OPENROUTER_HTTP_')) {
      try {
        const fb2 = await callLLM(
          [
            { role: 'system', content: system },
            { role: 'user', content: text },
          ],
          { model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo', temperature: 0.7, timeoutMs: 45_000, title: 'Feedback Fallback', referer: process.env.NEXT_PUBLIC_APP_URL }
        );
        return res.status(200).json({ feedback: fb2 || '⚠️ 教師評論生成失敗' });
      } catch {}
    }
    console.error('[feedback]', { mode, err: msg });
    return res.status(500).json({ error: err?.message || '未知錯誤' });
  }
}
