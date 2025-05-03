// ✅ 修正後：/pages/api/feedback.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Missing required field: text' });
  }

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('❌ 缺少 OPENROUTER_API_KEY 環境變數');
    }

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
          {
            role: 'system',
            content: '你是一位嚴格但鼓勵學生的老師。請指出這篇文章中有哪些問題或不足，並給出具體改善建議。請用清晰條列方式呈現評論，不需要重寫文章。'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 1000
      })
    });

    const rawText = await completionRes.text();
    let json;
    try {
      json = JSON.parse(rawText);
    } catch (err) {
      throw new Error('AI 回傳非 JSON 格式內容：' + rawText);
    }

    const feedback = json?.choices?.[0]?.message?.content || '⚠️ 教師評論生成失敗';
    return res.status(200).json({ feedback });

  } catch (err: any) {
    console.error('[Feedback Error]', err.message || err);
    return res.status(500).json({ error: err.message || '未知錯誤' });
  }
}
