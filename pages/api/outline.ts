// /pages/api/outline.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const { title, wordCount, language, tone, detail, reference, rubric, paragraph } = req.body;

  if (!title || !wordCount || !language || !tone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompt = `請根據以下資料產生段落大綱：\n\n題目：${title}\n字數：約 ${wordCount}\n語言：${language}（語氣：${tone}）\n細節：${detail}\n引用：${reference}\n評分準則：${rubric}\n段落要求：${paragraph}`;

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
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000
      })
    });

    const json = await completionRes.json();
    const outline = json?.choices?.[0]?.message?.content || '⚠️ 大綱生成失敗';
    res.status(200).json({ outline });
  } catch (err) {
    console.error('[Outline Error]', err);
    res.status(500).json({ error: 'Outline API failed' });
  }
}
