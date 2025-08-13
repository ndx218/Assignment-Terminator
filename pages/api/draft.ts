// /pages/api/draft.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

type ResBody = { draft: string } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST 請求' });

  const session = await getAuthSession(req, res); // 讀取登入者（抓 DB 文獻用）

  const {
    title,
    wordCount,
    language,
    tone,
    detail = '',
    reference = '',
    rubric = '',
    outline,
    outlineId,            // ✅ 新增：用來抓已儲存的參考文獻
    mode = 'free',        // 'gemini' | 'flash' | 'gpt-3.5' | 'free'
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

  // ✅ 從 DB 抓此大綱的「已儲存參考文獻」
  let savedRefs: Array<{
    title: string;
    url: string;
    doi: string | null;
    source: string | null;
    authors: string | null;
    publishedAt: string | null;
  }> = [];

  if (outlineId && session?.user?.id) {
    try {
      const rows = await prisma.reference.findMany({
        where: { outlineId, userId: session.user.id },
        orderBy: { credibility: 'desc' },
        take: 12, // 最多帶 12 筆給模型
        select: { title: true, url: true, doi: true, source: true, authors: true, publishedAt: true },
      });
      savedRefs = rows.map(r => ({
        title: r.title,
        url: r.url,
        doi: r.doi,
        source: r.source,
        authors: r.authors,
        publishedAt: r.publishedAt ? String(r.publishedAt).slice(0, 10) : null,
      }));
    } catch (e) {
      // 讀不到就當作沒有，不擋流程
      console.warn('[draft] load refs failed', e);
    }
  }

  // 整理參考文獻清單（提供給模型用；不保證全用）
  const refLines = savedRefs.map((r, i) => {
    const year = r.publishedAt?.slice(0, 4) || 'n.d.';
    const tail = r.doi
      ? `https://doi.org/${r.doi.replace(/^https?:\/\/(doi\.org\/)?/, '')}`
      : r.url || '';
    return `${i + 1}. ${r.authors || 'Unknown'} (${year}). ${r.title}. ${r.source || ''} ${tail}`.trim();
  }).join('\n');

  const isZH = /中|中文|zh/i.test(String(language));
  const apaNote = isZH
    ? '若引用，下文請用 APA7 文內引用格式（例如：（王小明，2021）或（Smith, 2021）），文末加「參考文獻」列表，只列實際引用來源；不得捏造或虛構資訊。'
    : 'When citing, use APA 7 in-text citations (e.g., (Smith, 2021)) and include a final “References” section listing only sources you actually cited. Do not fabricate sources or facts.';

  const prompt = `請根據以下大綱與寫作要求，撰寫一篇約 ${wc} 字的完整文章（符合正式語氣、條理清晰、避免贅語）：
題目：${title}
語言：${language}（語氣：${tone}）
細節：${detail}
評分準則：${rubric}

【段落大綱】
${outline}

${reference ? `【其他可對齊之參考或要求】\n${reference}\n` : ''}${
refLines ? `【可引用的資料來源（請審慎使用）】\n${refLines}\n` : ''
}
寫作規範：
- 結構採「引言 → 主體段落（2–4 段）→ 結論」，以段落呈現，**不要使用條列符號**。
- 內容要有解釋、例子或數據支撐，避免空泛與重複。
- ${apaNote}

請輸出為可直接提交的成稿（多段落、連貫過渡），不要再附加大綱或額外說明。`;

  try {
    const llmOpts = mapMode('draft', mode);
    const draft = await callLLM(
      [
        { role: 'system', content: isZH ? '你是嚴謹的中文學術寫作助手，重視清晰結構與可讀性。' : 'You are a rigorous academic writing assistant. Write clearly and coherently.' },
        { role: 'user', content: prompt },
      ],
      {
        ...llmOpts,
        title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
        referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
      }
    );

    return res.status(200).json({ draft: draft || '⚠️ 草稿生成失敗' });
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    // 一次性降級到 3.5，避免 UI 卡住
    if (msg.startsWith('OPENROUTER_HTTP_')) {
      try {
        const draft2 = await callLLM(
          [
            { role: 'system', content: isZH ? '你是嚴謹的中文學術寫作助手，重視清晰結構與可讀性。' : 'You are a rigorous academic writing assistant. Write clearly and coherently.' },
            { role: 'user', content: prompt },
          ],
          {
            model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
            temperature: 0.7,
            timeoutMs: 45_000,
            title: 'Draft Fallback',
            referer: process.env.NEXT_PUBLIC_APP_URL,
          }
        );
        return res.status(200).json({ draft: draft2 || '⚠️ 草稿生成失敗' });
      } catch {}
    }
    console.error('[draft]', { mode, err: msg });
    return res.status(500).json({ error: 'AI 回傳失敗，請稍後再試' });
  }
}
