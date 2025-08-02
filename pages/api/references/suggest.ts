// pages/api/references/suggest.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCost } from '@/lib/points';
import { callLLM, mapMode } from '@/lib/ai';

type Cand = {
  sectionKey: string;
  title: string;
  url: string;
  doi?: string | null;
  source?: string | null;   // 期刊/會議/網站
  authors?: string | null;  // "A. Author; B. Author"
  publishedAt?: string | null; // YYYY-MM-DD 或 年
  type?: string | null;     // JOURNAL|CONF|WEB|OTHER
  credibility?: number | null; // 0-100 估值
  summary?: string | null;  // 一句話摘要
};

type Res = { error: string } | {
  spent: number;               // 此 API 不扣點（扣點放在 save），所以 0
  candidates: Cand[];
};

const S2_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY || ''; // Optional

export default async function handler(req: NextApiRequest, res: NextApiResponse<Res>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: '未登入' });

  const { outlineId, sectionKey, text, source = 'web' } =
    (req.body || {}) as { outlineId: string; sectionKey: string; text: string; source?: 'web'|'llm' };

  if (!outlineId || !sectionKey || !text) return res.status(400).json({ error: '缺少必要參數' });

  // 驗證 outline 屬於本人
  const own = await prisma.outline.findFirst({
    where: { id: outlineId, userId: session.user.id },
    select: { id: true },
  });
  if (!own) return res.status(404).json({ error: '大綱不存在' });

  try {
    let candidates: Cand[] = [];
    if (source === 'web') {
      candidates = await fetchFromWeb(sectionKey, text);
      if (candidates.length < 1) {
        // 退回 LLM
        candidates = await fallbackLLM(sectionKey, text);
      }
    } else {
      candidates = await fallbackLLM(sectionKey, text);
    }
    return res.status(200).json({ spent: 0, candidates: candidates.slice(0,3) });
  } catch (e:any) {
    console.error('[refs/suggest]', e?.message || e);
    return res.status(500).json({ error: '參考文獻建議失敗，請稍後再試' });
  }
}

/* --------------------------- 真實來源：Crossref + Semantic Scholar --------------------------- */
async function fetchFromWeb(sectionKey: string, text: string): Promise<Cand[]> {
  const q = buildQuery(text);
  const out: Cand[] = [];

  // 1) Crossref（不需 API Key）
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
      out.push({
        sectionKey,
        title,
        url: it.URL || (it.link?.[0]?.URL) || '',
        doi: it.DOI || null,
        source: it['container-title']?.[0] || it.publisher || null,
        authors: authors,
        publishedAt: year,
        type: it.type?.toUpperCase() || 'JOURNAL',
        credibility: scoreCredibility({ doi: !!it.DOI, venue: it['container-title']?.[0] }),
        summary: null,
      });
    }
  } catch {}

  // 2) Semantic Scholar（有 Key 的話更穩；無 Key 也可試舊端點，可能限流）
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=5&fields=title,authors,year,venue,externalIds,url,isOpenAccess`;
    const s2 = await fetch(url, {
      headers: S2_KEY ? { 'x-api-key': S2_KEY } : {},
    }).then(r => r.ok ? r.json() : null);

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

  // 去重（優先保留有 DOI）
  const dedup = new Map<string, Cand>();
  for (const c of out) {
    const key = (c.doi || c.url || c.title).toLowerCase();
    if (!dedup.has(key)) dedup.set(key, c);
  }
  return Array.from(dedup.values()).slice(0, 5);
}

function buildQuery(text: string) {
  // 取前 200 字，去掉過多空白
  return text.replace(/\s+/g, ' ').slice(0, 200);
}

function scoreCredibility(p: { doi: boolean; venue?: string | null }) {
  let s = 50;
  if (p.doi) s += 25;
  if (p.venue) s += 10;
  return Math.min(95, s);
}

/* --------------------------- 後備：LLM 生成 3 筆 JSON --------------------------- */
async function fallbackLLM(sectionKey: string, text: string): Promise<Cand[]> {
  const prompt = `
你是學術助理。請根據下列段落，提供 3 筆可能的參考文獻（盡量提供 DOI 或正式來源）：
段落：${text}

輸出 JSON 陣列（長度 3），欄位：
sectionKey, title, url, doi, source, authors, publishedAt(YYYY 或 YYYY-MM-DD), type, credibility(0-100), summary(一句話中文)。
sectionKey 固定輸出為：${sectionKey}
`;
  const opt = mapMode('outline', 'gpt-3.5'); // 可換你偏好的模型
  const raw = await callLLM([{ role: 'user', content: prompt }], opt);
  try {
    const arr = JSON.parse((raw || '[]').trim());
    if (!Array.isArray(arr)) return [];
    return arr.map((x:any) => ({
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
    })).slice(0,3);
  } catch {
    return [];
  }
}
