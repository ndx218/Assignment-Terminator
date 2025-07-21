// pages/api/outline.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type ResBody = { outline: string } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  const {
    title,
    wordCount,
    language,
    tone,
    detail = '',
    reference = '',
    rubric = '',
    paragraph = ''  // 這裡才是你從前端傳過來的 "段落數量"
  } = req.body;

  // 校驗必填欄位
  if (
    typeof title !== 'string' ||
    typeof wordCount !== 'string' ||
    typeof language !== 'string' ||
    typeof tone !== 'string'
  ) {
    return res.status(400).json({ error: '缺少必要字段（title, wordCount, language, tone）' });
  }

  // 組 prompt
  const prompt = `請根據以下資料產生段落大綱：\n
題目：${title}
字數：約 ${wordCount}
語言：${language}（語氣：${tone}）
細節：${detail}
引用：${reference}
評分準則：${rubric}
段落要求：${paragraph} 段\n`;

  try {
    const completionRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
      }),
    });

    if (!completionRes.ok) {
      const errText = await completionRes.text();
      console.error('大綱 API 非 200 回傳：', completionRes.status, errText);
      return res.status(500).json({ error: 'AI 回傳失敗，請稍後再試' });
    }

    const json = await completionRes.json();
    const outline = json.choices?.[0]?.message?.content?.trim() || '⚠️ 大綱生成失敗';
    return res.status(200).json({ outline });

  } catch (err: any) {
    console.error('[Outline Error]', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
}
