// API: undetectable conversion// ✅ /pages/api/undetectable.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST 請求' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: '請提供要優化的文本' });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
          { role: 'system', content: '請對以下文章進行語句優化，使其更難被 AI 偵測，但保持內容與語意一致。' },
          { role: 'user', content: text }
        ],
        max_tokens: 2000
      })
    });

    const raw = await response.text();
    let json;
    try { json = JSON.parse(raw); } catch { throw new Error('AI 回傳非 JSON 格式內容：' + raw); }

    const result = json?.choices?.[0]?.message?.content || '⚠️ 優化失敗';
    return res.status(200).json({ result });
  } catch (err: any) {
    const msg = err instanceof Error ? `❌ 系統錯誤：${err.message}` : '❌ 未知錯誤';
    console.error('[Undetectable Error]', msg);
    return res.status(500).json({ result: msg });
  }
}
