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
/* 以下請貼到 /pages/api/references/suggest.ts 的最下面 */

async function fetchFromWeb(sectionKey: string, text: string): Promise<Cand[]> {
  const q = buildQuery(text);
  const out: Cand[] = [];
  try {
    const cr = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=5`, {
      headers: { 'User-Agent': 'AssignmentTerminator/1.0 (mailto:you@example.com)' },
    }).then(r => r.ok ? r.json() : null);
    const items: any[] = cr?.message?.items || [];
    for (const it of items) {
      const title = Array.isArray(it.title) ? it.title[0] : it.title || '';
      if (!title) continue;
      const authors = Array.isArray(it.author)
        ? it.author.map((a:any)=>[a.family, a.given].filter(Boolean).join(' ')).join('; ')
        : null;
      const dateParts = it['issued']?.['date-parts']?.[0] || [];
      const year = dateParts[0] ? String(dateParts[0]) : null;
      out.push({ sectionKey, title, url: it.URL || '', doi: it.DOI || null,
        source: it['container-title']?.[0] || it.publisher || null,
        authors, publishedAt: year, type: 'JOURNAL',
        credibility: scoreCredibility({ doi: !!it.DOI, venue: it['container-title']?.[0] }),
        summary: null });
    }
  } catch {}
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=5&fields=title,authors,year,venue,externalIds,url`;
    const s2 = await fetch(url, { headers: S2_KEY ? { 'x-api-key': S2_KEY } : {} })
      .then(r => r.ok ? r.json() : null);
    const items: any[] = s2?.data || [];
    for (const it of items) {
      const title = it.title || ''; if (!title) continue;
      const authors = Array.isArray(it.authors) ? it.authors.map((a:any)=>a.name).join('; ') : null;
      const doi = it.externalIds?.DOI || null;
      out.push({ sectionKey, title, url: it.url || '', doi, source: it.venue || null,
        authors, publishedAt: it.year ? String(it.year) : null,
        type: 'JOURNAL', credibility: scoreCredibility({ doi: !!doi, venue: it.venue }), summary: null });
    }
  } catch {}
  // 去重並回傳前 5
  const dedup = new Map<string,Cand>();
  for (const c of out) {
    const key = (c.doi||c.url||c.title).toLowerCase();
    if (!dedup.has(key)) dedup.set(key, c);
  }
  return Array.from(dedup.values()).slice(0,5);
}

function buildQuery(text: string) {
  return text.replace(/\s+/g,' ').slice(0,200);
}

function scoreCredibility(p: { doi:boolean; venue?:string|null }) {
  let s = 50;
  if (p.doi) s += 25;
  if (p.venue) s += 10;
  return Math.min(95, s);
}

async function fallbackLLM(sectionKey: string, text: string): Promise<Cand[]> {
  const prompt = `你是學術助理…（請用前面的 JSON schema）段落：${text}\nsectionKey:${sectionKey}`;
  const opt = mapMode('outline','gpt-3.5');
  const raw = await callLLM([{role:'user',content:prompt}], opt);
  try {
    const arr = JSON.parse(raw.trim());
    return Array.isArray(arr)
      ? arr.map((x:any)=>({
          sectionKey,
          title:String(x.title||''), url:String(x.url||''), doi:x.doi||null,
          source:x.source||null, authors:x.authors||null,
          publishedAt:x.publishedAt||null, type:x.type||'OTHER',
          credibility:typeof x.credibility==='number'?x.credibility:60,
          summary:x.summary||null
        })).slice(0,3)
      : [];
  } catch {
    return [];
  }
}
