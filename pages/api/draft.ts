// /pages/api/draft.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode } from '@/lib/ai';

type ResBody = { draft: string } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST 請求' });

  const {
    title,
    wordCount,
    language,
    tone,
    detail = '',
    reference = '',
    rubric = '',
    outline,
    mode = 'free', // 可選：'gemini' | 'flash' | 'gpt-3.5' | 'free'
  } = (req.body ?? {}) as Record<string, any>;

  // 驗證
  const wc = typeof wordCount === 'number' ? wordCount : parseInt(String(wordCount || ''), 10);
  if (
    typeof title !== 'string' ||
    !Number.isFinite(wc) ||
    typeof language !== 'string' ||
    typeof tone !== 'string' ||
    typeof outline !== 'string' ||
    outline.trim().length === 0
  ) {
    return res.status(400).json({
      error: '缺少必要字段：title, wordCount, language, tone, outline',
    });
  }

  const prompt = `請根據以下大綱與寫作要求，撰寫一篇約 ${wc} 字的完整文章（符合正式語氣、條理清晰、避免贅語）：
題目：${title}
語言：${language}（語氣：${tone}）
細節：${detail}
引用：${reference}
評分準則：${rubric}

【段落大綱】
${outline}

請輸出為可直接提交的成稿（含段落、連貫過渡），不需要再附加大綱或說明。`;

  try {
    const llmOpts = mapMode('draft', mode);
    const draft = await callLLM(
      [
        { role: 'system', content: '你是嚴謹的英文寫作助手，重視清晰結構與可讀性。' },
        { role: 'user', content: prompt },
      ],
      { ...llmOpts, title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator', referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL }
    );
    return res.status(200).json({ draft: draft || '⚠️ 草稿生成失敗' });
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    // 一次性降級到 3.5，避免 UI 卡住
    if (msg.startsWith('OPENROUTER_HTTP_')) {
      try {
        const draft2 = await callLLM(
          [
            { role: 'system', content: '你是嚴謹的英文寫作助手，重視清晰結構與可讀性。' },
            { role: 'user', content: prompt },
          ],
          { model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo', temperature: 0.7, timeoutMs: 45_000, title: 'Draft Fallback', referer: process.env.NEXT_PUBLIC_APP_URL }
        );
        return res.status(200).json({ draft: draft2 || '⚠️ 草稿生成失敗' });
      } catch {}
    }
    console.error('[draft]', { mode, err: msg });
    return res.status(500).json({ error: 'AI 回傳失敗，請稍後再試' });
  }
}
