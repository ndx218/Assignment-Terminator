// API: rewrite for human tone// ✅ /pages/api/rewrite.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST requests are allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing required field: text' });

  try {
    const completionRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://easy-work103.vercel.app',
        'X-Title': 'EasyWork'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '請幫學生將以下文章優化，使語句更清楚、結構更合理、不刪除重點，讓文章更自然流暢。' },
          { role: 'user', content: text }
        ],
        max_tokens: 2000
      })
    });

    const raw = await completionRes.text();
    let json;
    try { json = JSON.parse(raw); } catch { throw new Error('AI 回傳非 JSON 格式內容：' + raw); }

    const rewritten = json?.choices?.[0]?.message?.content || '⚠️ 重寫失敗';
    return res.status(200).json({ result: rewritten });
  } catch (err: any) {
    console.error('[Rewrite Error]', err.message || err);
    return res.status(500).json({ error: err.message || '未知錯誤' });
  }
}
