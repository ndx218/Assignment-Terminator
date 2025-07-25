// pages/api/draft.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type ResBody = { draft: string } | { error: string };

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
    outline,
  } = req.body;

  // 验证必填字段
  if (
    typeof title !== 'string' ||
    typeof wordCount !== 'string' ||
    typeof language !== 'string' ||
    typeof tone !== 'string' ||
    typeof outline !== 'string' ||
    outline.trim().length === 0
  ) {
    return res
      .status(400)
      .json({ error: '缺少必要字段：title, wordCount, language, tone, outline' });
  }

  // 解析字数为数字
  const approxWords = parseInt(wordCount, 10) || 0;

  // 构建 prompt
  const prompt = `請根據以下大綱與寫作要求撰寫一篇約 ${approxWords} 字的文章：
題目：${title}
語言：${language}（語氣：${tone}）
細節：${detail}
引用：${reference}
評分準則：${rubric}

段落大綱：
${outline}`;

  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 3000,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Draft API 非 200 回傳：', response.status, errText);
      return res
        .status(500)
        .json({ error: 'AI 回傳失敗，請稍後再試' });
    }

    const json = await response.json();
    const draft =
      json.choices?.[0]?.message?.content?.trim() ||
      '⚠️ 草稿生成失敗';
    return res.status(200).json({ draft });
  } catch (err: any) {
    console.error('❌ Draft API 錯誤：', err);
    return res
      .status(500)
      .json({ error: err.message || '伺服器錯誤，請稍後再試' });
  }
}
