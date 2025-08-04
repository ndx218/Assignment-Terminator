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

/**
 * Extract a section’s text from the stored outline.content.
 * Supports Chinese “一、二、三、…” AND Arabic “1. 2. 3.” headers.
 */
function extractSectionText(content: string, sectionKey: string): string {
  const lines = content.split('\n');
  // find the line that starts with the key (e.g. “1.”, “一、”)
  const startIdx = lines.findIndex(l => l.trim().startsWith(sectionKey));
  if (startIdx === -1) return '';
  // any header regex: Chinese numerals, roman numerals, arabic digits, or uppercase A/B/C...
  const headerRe = /^([一二三四五六七八九十]+、|[0-9]+\.|[IVX]+\.|[A-Z]\.)/;
  // find next header after our start
  const rest = lines.slice(startIdx + 1);
  const nextRel = rest.findIndex(l => headerRe.test(l.trim()));
  const endIdx = nextRel === -1 ? lines.length : startIdx + 1 + nextRel;
  return lines.slice(startIdx, endIdx).join('\n').trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Res>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: '未登入' });
  }

  const { outlineId, sectionKey, text: rawText = '', source = 'web' } =
    req.body as { outlineId: string; sectionKey: string; text?: string; source?: 'web'|'llm' };

  if (!outlineId || !sectionKey) {
    return res.status(400).json({ error: '缺少必要參數' });
  }

  // fetch stored outline
  const outline = await prisma.outline.findFirst({
    where: { id: outlineId, userId: session.user.id },
    select: { content: true },
  });
  if (!outline) {
    return res.status(404).json({ error: '大綱不存在' });
  }

  // prefer user-typed text, else auto-extract
  const text = rawText.trim() || extractSectionText(outline.content, sectionKey);
  if (!text) {
    return res.status(400).json({ error: '該段落無內容可分析，請手動輸入' });
  }

  try {
    let candidates: Cand[] = [];
    if (source === 'web') {
      candidates = await fetchFromWeb(sectionKey, text);
      if (candidates.length === 0) {
        candidates = await fallbackLLM(sectionKey, text);
      }
    } else {
      candidates = await fallbackLLM(sectionKey, text);
    }
    return res.status(200).json({ spent: 0, candidates: candidates.slice(0, 3) });
  } catch (e: any) {
    console.error('[refs/suggest]', e);
    return res.status(500).json({ error: '參考文獻建議失敗，請稍後再試' });
  }
}

async function fetchFromWeb(sectionKey: string, text: string): Promise<Cand[]> {
  const q = buildQuery(text);
  const out: Cand[] = [];

  // Crossref
  try {
    const cr = await fetch(
      `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=5`,
      { headers: { 'User-Agent': 'AssignmentTerminator/1.0 (mailto:you@example.com)' } }
    ).then(r => (r.ok ? r.json() : null));
    for (const it of cr?.message?.items || []) {
      const title = Array.isArray(it.title) ? it.title[0] : it.title || '';
      if (!title) continue;
      const authors = Array.isArray(it.author)
        ? it.author.map((a: any) => [a.family, a.given].filter(Boolean).join(' ')).join('; ')
        : null;
      const year = it.issued?.['date-parts']?.[0]?.[0]?.toString() || null;
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
    const url =
      `https://api.semanticscholar.org/graph/v1/paper/search?` +
      `query=${encodeURIComponent(q)}&limit=5&fields=title,authors,year,venue,externalIds,url`;
    const s2 = await fetch(url, S2_KEY ? { headers: { 'x-api-key': S2_KEY } } : {}).then(r =>
      r.ok ? r.json() : null
    );
    for (const it of s2?.data || []) {
      if (!it.title) continue;
      const authors = Array.isArray(it.authors) ? it.authors.map((a: any) => a.name).join('; ') : null;
      out.push({
        sectionKey,
        title: it.title,
        url: it.url || '',
        doi: it.externalIds?.DOI || null,
        source: it.venue || null,
        authors,
        publishedAt: it.year?.toString() || null,
        type: 'JOURNAL',
        credibility: scoreCredibility({ doi: !!it.externalIds?.DOI, venue: it.venue }),
        summary: null,
      });
    }
  } catch {}

  // de-dup (prefer DOI)
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

async function fallbackLLM(sectionKey: string, text: string): Promise<Cand[]> {
  const prompt = `
你是學術助理。請根據下列段落，提供 3 筆可能的參考文獻（盡量提供 DOI 或正式來源）：
段落：${text}

輸出 JSON 陣列（長度 3），含字段：
sectionKey, title, url, doi, source, authors,
publishedAt, type, credibility, summary。
sectionKey 固定為：${sectionKey}
`;
  const opt = mapMode('outline', 'gpt-3.5');
  const raw = await callLLM([{ role: 'user', content: prompt }], opt);
  try {
    const arr = JSON.parse((raw || '[]').trim());
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
