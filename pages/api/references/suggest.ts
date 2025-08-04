// pages/api/references/suggest.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { callLLM, mapMode } from '@/lib/ai';

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

type Res =
  | { error: string }
  | { spent: 0; candidates: Cand[] };

// 从 outline.content 自动提取段落文本（支持「一、」「2.」「III.」等）
function extractSectionText(content: string, key: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().startsWith(key));
  if (start === -1) return '';
  const next = lines
    .slice(start + 1)
    .findIndex((l) =>
      /^[一二三四五六七八九十]+、/.test(l.trim()) ||
      /^[0-9]+\.\s/.test(l.trim()) ||
      /^[IVX]+\.\s/.test(l.trim())
    );
  const end = next === -1 ? lines.length : start + 1 + next;
  return lines.slice(start, end).join('\n').trim();
}

function buildQuery(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 200);
}

function scoreCredibility(p: { doi: boolean; venue?: string | null }): number {
  let s = 50;
  if (p.doi) s += 25;
  if (p.venue) s += 10;
  return Math.min(95, s);
}

async function fallbackLLM(sectionKey: string, text: string): Promise<Cand[]> {
  const prompt = `
你是學術助理。請根據下列段落提供 3 筆參考文獻（盡量包含 DOI），
輸出 JSON 陣列，每項字段：sectionKey, title, url, doi, source, authors, publishedAt, type, credibility, summary。
段落：${text}
sectionKey: ${sectionKey}
`;
  // 直接使用 mapMode 返回的配置对象
  const opt = mapMode('outline', 'gpt-3.5');
  const raw = await callLLM([{ role: 'user', content: prompt }], opt);
  try {
    const arr = JSON.parse(raw.trim());
    if (Array.isArray(arr)) {
      return arr.slice(0, 3).map((x: any) => ({
        sectionKey,
        title: String(x.title || ''),
        url: String(x.url || ''),
        doi: x.doi ?? null,
        source: x.source ?? null,
        authors: x.authors ?? null,
        publishedAt: x.publishedAt ?? null,
        type: x.type ?? 'OTHER',
        credibility: typeof x.credibility === 'number' ? x.credibility : 60,
        summary: x.summary ?? null,
      }));
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

async function fetchFromWeb(sectionKey: string, text: string, need = 3): Promise<Cand[]> {
  const q = buildQuery(text);
  const out: Cand[] = [];

  // Crossref
  try {
    const cr = await fetch(
      `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${Math.max(need, 5)}`,
      { headers: { 'User-Agent': 'AssignmentTerminator/1.0' } }
    ).then((r) => (r.ok ? r.json() : null));
    const items: any[] = cr?.message?.items || [];
    for (const it of items) {
      const title = Array.isArray(it.title) ? it.title[0] : it.title || '';
      if (!title) continue;
      const authors = Array.isArray(it.author)
        ? it.author.map((a: any) => [a.family, a.given].filter(Boolean).join(' ')).join('; ')
        : null;
      const year = it.issued?.['date-parts']?.[0]?.[0]
        ? String(it.issued['date-parts'][0][0])
        : null;
      out.push({
        sectionKey,
        title,
        url: it.URL || '',
        doi: it.DOI || null,
        source: it['container-title']?.[0] || it.publisher || null,
        authors,
        publishedAt: year,
        type: 'JOURNAL',
        credibility: scoreCredibility({ doi: !!it.DOI, venue: it['container-title']?.[0] }),
        summary: null,
      });
    }
  } catch {
    /* ignore */
  }

  // Semantic Scholar
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
      q
    )}&limit=${Math.max(need, 5)}&fields=title,authors,year,venue,externalIds,url`;
    const headers: Record<string, string> = {};
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    }
    const s2 = await fetch(url, { headers }).then((r) => (r.ok ? r.json() : null));
    const items: any[] = s2?.data || [];
    for (const it of items) {
      const title = it.title || '';
      if (!title) continue;
      const authors = Array.isArray(it.authors)
        ? it.authors.map((a: any) => a.name).join('; ')
        : null;
      const doi = it.externalIds?.DOI || null;
      out.push({
        sectionKey,
        title,
        url: it.url || '',
        doi,
        source: it.venue || null,
        authors,
        publishedAt: it.year ? String(it.year) : null,
        type: 'JOURNAL',
        credibility: scoreCredibility({ doi: !!doi, venue: it.venue }),
        summary: null,
      });
    }
  } catch {
    /* ignore */
  }

  // 去重并取前 need 条
  const dedup = new Map<string, Cand>();
  for (const c of out) {
    const key = (c.doi || c.url || c.title).toLowerCase();
    if (!dedup.has(key)) dedup.set(key, c);
  }
  return Array.from(dedup.values()).slice(0, need);
}

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

  const text = rawText.trim() || extractSectionText(outline.content, sectionKey);
  if (!text) {
    return res.status(400).json({ error: '該段落無可用內容，請手動輸入' });
  }

  try {
    let cands: Cand[] = [];
    if (source === 'web') {
      cands = await fetchFromWeb(sectionKey, text, 3);
      if (cands.length === 0) {
        cands = await fallbackLLM(sectionKey, text);
      }
    } else {
      cands = await fallbackLLM(sectionKey, text);
    }

    return res.status(200).json({ spent: 0, candidates: cands });
  } catch (err: any) {
    console.error('[refs/suggest]', err);
    return res.status(500).json({ error: '參考文獻建議失敗，請稍後再試' });
  }
}
