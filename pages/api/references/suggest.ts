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
type Res = { error: string } | { spent: number; candidates: Cand[] };

const S2_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY || '';

/** 從 outline.content 擷取指定章節文字（支援中／英數字編號） */
function extractSectionText(content: string, key: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().startsWith(key));
  if (start === -1) return '';
  const next = lines
    .slice(start + 1)
    .findIndex((l) => /^[一二三四五六七八九十]+、/.test(l.trim())
                   || /^[0-9]+\.\s/.test(l.trim())
                   || /^[IVX]+\.\s/.test(l.trim()));
  const end = next === -1 ? lines.length : start + 1 + next;
  return lines.slice(start, end).join('\n').trim();
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

  // 取出該 outline 的全文 content
  const outline = await prisma.outline.findFirst({
    where: { id: outlineId, userId: session.user.id },
    select: { content: true },
  });
  if (!outline) {
    return res.status(404).json({ error: '找不到對應的大綱' });
  }

  // 優先用前端傳入的 text，否則自動擷取
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

/** 真實來源：Crossref + Semantic Scholar */
async function fetchFromWeb(sectionKey: string, text: string): Promise<Cand[]> {
  const q = buildQuery(text);
  const out: Cand[] = [];

  // Crossref
  try {
    const cr = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=5`, {
      headers: { 'User-Agent': 'AssignmentTerminator/1.0 (mailto:you@example.com)' },
    }).then(r => r.ok ? r.json() : null);
    const items: any[] = cr?.message?.items || [];
    for (const it of items) {
      const title = Array.isArray(it.title) ? it.title[0] : it.title || '';
      if (!title) continue;
      const authors = Array.isArray(it.author)
        ? it.author.map((a:any)=>[a.family,a.given].filter(Boolean).join(' ')).join('; ')
        : null;
      const year = it.issued?.['date-parts']?.[0]?.[0] ? String(it.issued['date-parts'][0][0]) : null;
      out.push({
        sectionKey,
        title,
        url: it.URL || '',
        doi: it.DOI || null,
        source: it['container-title']?.[0] || it.publisher || null,
        authors,
        publishedAt: year,
        type: it.type?.toUpperCase() || 'JOURNAL',
        credibility: scoreCredibility({ doi: !!it.DOI, venue: it['container-title']?.[0] }),
        summary: null,
      });
    }
  } catch {}

  // Semantic Scholar
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=5&fields=title,authors,year,venue,externalIds,url`;
    const s2 = await fetch(url, { headers: S2_KEY ? { 'x-api-key': S2_KEY } : {} })
      .then(r => r.ok ? r.json() : null);
    const items: any[] = s2?.data || [];
    for (const it of items) {
      const title = it.title || '';
      if (!title) continue;
      const authors = Array.isArray(it.authors) ? it.authors.map((a:any)=>a.name).join('; ') : null;
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
  } catch {}

  // 去重（優先 DOI），並回傳前 5
  const dedup = new Map<string, Cand>();
  for (const c of out) {
    const key = (c.doi || c.url || c.title).toLowerCase();
    if (!dedup.has(key)) dedup.set(key, c);
  }
  return Array.from(dedup.values()).slice(0, 5);
}

function buildQuery(text: string) {
  return text.replace(/\s+/g, ' ').slice(0, 200);
}

function scoreCredibility(p: { doi: boolean; venue?: string | null }) {
  let s = 50;
  if (p.doi) s += 25;
  if (p.venue) s += 10;
  return Math.min(95, s);
}

/** 後備：LLM 生成 3 筆 JSON */
async function fallbackLLM(sectionKey: string, text: string): Promise<Cand[]> {
  const prompt = `
你是學術助理。請根據下列段落，提供 3 筆可能的參考文獻（盡量包含 DOI）：
段落：${text}

請以 JSON 陣列形式回傳（長度 3），欄位：
sectionKey, title, url, doi, source, authors, publishedAt（YYYY 或 YYYY-MM-DD）, type, credibility（0-100）, summary（一句話中文）。
sectionKey 固定為：${sectionKey}
`;
  const opt = mapMode('outline', 'gpt-3.5');
  const raw = await callLLM([{ role: 'user', content: prompt }], opt);
  try {
    const arr = JSON.parse(raw.trim());
    if (!Array.isArray(arr)) return [];
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
  } catch {
    return [];
  }
}
