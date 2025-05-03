// API: generate draftimport type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  const { title, wordCount, language, tone, detail, reference, rubric, outline } = req.body;

  if (!title || !wordCount || !language || !tone || typeof outline !== 'string') {
    return res.status(400).json({ error: '請填寫所有必要欄位（包含大綱）' });
  }

  try {
    const prompt = `請依照以下段落大綱與寫作指引撰寫完整文章：
題目：${title}
語言：${language}（語氣：${tone}）
字數：約 ${wordCount}
內容細節：${detail}
引用：${reference}
評分準則：${rubric}

段落大綱：
${outline}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://easy-work103.vercel.app',
        'X-Title': 'EasyWork',
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      }),
    });

    const raw = await response.text();
    let json;

    try {
      json = JSON.parse(raw);
    } catch (e) {
      console.error('❌ 回傳格式解析失敗：', raw);
      return res.status(500).json({ error: '草稿 API 回傳格式錯誤，請稍後再試。' });
    }

    const draft = json?.choices?.[0]?.message?.content || '⚠️ 草稿生成失敗';
    return res.status(200).json({ draft });
  } catch (err: any) {
    console.error('❌ Draft API 錯誤：', err.message || err);
    return res.status(500).json({ error: err.message || '未知錯誤' });
  }
}
