// pages/api/references/suggest.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { callLLM, mapMode } from '@/lib/ai';

// 從 outline.content 自動擷取指定章節文字（中／英文標號皆支援）
function extractSectionText(content: string, key: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().startsWith(key));
  if (start === -1) return '';
  const next = lines
    .slice(start + 1)
    .findIndex((l) => /^[一二三四五六七八九十]+、|^[0-9]+\.\s|^[IVX]+\.\s/.test(l.trim()));
  const end = next === -1 ? lines.length : start + 1 + next;
  return lines.slice(start, end).join('\n').trim();
}

type Cand = {
  sectionKey: string;
  title: string;
  url: string;
  doi?: string | null;
  source?: string | null;
  authors?: string | null;
  publishedAt?: string | null;
  type?: string | null;
  credibility?: number | null;
  summary?: string | null;
};
type Res = { error: string } | { spent: number; candidates: Cand[] };

const S2_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY || '';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Res>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: '尚未登入，請先登入' });
  }

  const {
    outlineId,
    sectionKey,
    text: rawText = '',
    source = 'web',
  } = req.body as {
    outlineId: string;
    sectionKey: string;
    text?: string;
    source?: 'web' | 'llm';
  };

  if (!outlineId || !sectionKey) {
    return res.status(400).json({ error: '缺少必要參數' });
  }

  const outline = await prisma.outline.findFirst({
    where: { id: outlineId, userId: session.user.id },
    select: { content: true },
  });
  if (!outline) {
    return res.status(404).json({ error: '找不到對應的大綱' });
  }

  // 優先使用傳入 text，否則自動抽取
  const text = rawText.trim() || extractSectionText(outline.content, sectionKey);
  if (!text) {
    return res.status(400).json({ error: '該段落無可用內容，請手動輸入' });
  }

  try {
    let cands: Cand[] = [];
    if (source === 'web') {
      cands = await fetchFromWeb(sectionKey, text);
      if (cands.length === 0) {
        cands = await fallbackLLM(sectionKey, text);
      }
    } else {
      cands = await fallbackLLM(sectionKey, text);
    }
    return res.status(200).json({ spent: 0, candidates: cands.slice(0, 3) });
  } catch (err: any) {
    console.error('[refs/suggest]', err);
    return res.status(500).json({ error: '參考文獻建議失敗，請稍後再試' });
  }
}

/* 以下 fetchFromWeb、fallbackLLM、buildQuery、scoreCredibility 等函式保持不變 */
