/* lib/gather.ts — Enhanced Scholarly Reference Harvester
 *
 * Multi-source academic reference gathering with query expansion,
 * lightweight relevance scoring, credibility + recency weighting,
 * and de-duplication (DOI > URL > title).
 *
 * Sources included:
 * - Crossref
 * - Semantic Scholar (optional API key)
 * - arXiv (Atom API)
 * - PubMed (NCBI E-utilities)
 * - OpenAlex (optional)
 *
 * Design notes:
 * - No external deps; uses fetch + light parsing.
 * - Optional LLM-assisted query expansion + re-ranking (env-flagged).
 * - Exports a single function `gatherForSection(...)` to integrate
 *   with your existing /pages/api/references/gather.ts.
 */

import { callLLM } from '@/lib/ai';

export type SourceKind = 'crossref' | 'semanticscholar' | 'arxiv' | 'pubmed' | 'openalex' | 'wiki';

export type RefItem = {
  sectionKey: string;
  title: string;
  url: string;
  doi?: string | null;
  source?: string | null; // venue/journal or platform
  authors?: string | null;
  publishedAt?: string | null; // ISO-ish yyyy-mm-dd
  type?: string | null; // JOURNAL/CONFERENCE/PREPRINT/etc.
  summary?: string | null; // abstract/snippet if available
  credibility?: number; // 0–100
  _kind?: SourceKind; // internal: origin
  _score?: number; // internal: overall score for ranking
};

export type GatherOpts = {
  need: number; // number of items to return
  sources?: SourceKind[]; // default sensible set
  enableLLMQueryExpand?: boolean; // default: false
  enableLLMRerank?: boolean; // default: false
};

const S2_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
const OPENALEX = process.env.OPENALEX_ENABLE === '1';
const ENABLE_LLM_EXPAND = process.env.REF_LLM_EXPAND === '1';
const ENABLE_LLM_RERANK = process.env.REF_LLM_RERANK === '1';

/**
 * Main entry: Build queries from title/outline/sectionKey and gather top-N references.
 */
export async function gatherForSection(
  paperTitle: string,
  outline: string,
  sectionKey: string,
  opts: GatherOpts
): Promise<RefItem[]> {
  const sources: SourceKind[] = opts.sources?.length
    ? opts.sources
    : (['crossref', 'semanticscholar', 'arxiv', 'pubmed'] as SourceKind[]);

  // Build a compact section hint and seed query
  const line = outline.split('\n').find(l => l.trim().startsWith(sectionKey));
  const hint = line ? line.replace(/^[IVX一二三四五六七八九十\.\)\s-]+/, '').slice(0, 160) : '';
  const base = `${paperTitle} ${sectionKey} ${hint}`.trim();

  const queries = await expandQueries(base, ENABLE_LLM_EXPAND || !!opts.enableLLMQueryExpand);

  // Fan out to sources per query (small limits each), collect, dedup
  const raw: RefItem[] = [];
  const perQueryNeed = Math.max(2, Math.ceil((opts.need || 5) / Math.max(1, queries.length)));

  for (const q of queries) {
    const tasks: Promise<RefItem[]>[] = [];
    for (const kind of sources) {
      if (kind === 'crossref') tasks.push(fetchCrossref(q, perQueryNeed));
      else if (kind === 'semanticscholar') tasks.push(fetchSemanticScholar(q, perQueryNeed));
      else if (kind === 'arxiv') tasks.push(fetchArxiv(q, perQueryNeed));
      else if (kind === 'pubmed') tasks.push(fetchPubMed(q, perQueryNeed));
      else if (kind === 'openalex' && OPENALEX) tasks.push(fetchOpenAlex(q, perQueryNeed));
      // wiki intentionally omitted here to keep results scholarly; keep in your existing fallback if needed.
    }
    try {
      const chunk = await Promise.allSettled(tasks);
      chunk.forEach(r => {
        if (r.status === 'fulfilled') raw.push(...r.value);
      });
    } catch {}
  }

  // Deduplicate
  const deduped = dedupRefs(raw);

  // Score by relevance/credibility/recency
  const context = `${paperTitle}\n${hint}`.trim();
  const scored = await scoreAndSort(deduped, context, ENABLE_LLM_RERANK || !!opts.enableLLMRerank);

  return scored.slice(0, opts.need || 5).map(stripInternal);
}

/* -------------------- Query Expansion -------------------- */
async function expandQueries(seed: string, useLLM: boolean): Promise<string[]> {
  const basic = uniqStrings([
    seed,
    seed.replace(/人工智慧|AI/g, 'Artificial Intelligence'),
    seed.replace(/機器學習|ML/g, 'Machine Learning'),
  ]).filter(Boolean);

  if (!useLLM) return basic.slice(0, 3);

  try {
    const prompt = `請根據以下主題，產生 3 條「學術檢索查詢語句」（英文優先），
每條不超過 10 個關鍵詞，適合 Crossref、Semantic Scholar、arXiv、PubMed：\n\n${seed}\n\n僅以 JSON 陣列輸出，不要多餘文字。`;
    const raw = await callLLM([{ role: 'user', content: prompt }], {
      model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
      temperature: 0.2,
      timeoutMs: 15000,
    });
    const arr = JSON.parse((raw || '[]').trim());
    const out = Array.isArray(arr) ? arr.map(String) : [];
    return uniqStrings([...basic, ...out]).slice(0, 5);
  } catch {
    return basic.slice(0, 3);
  }
}

/* -------------------- Fetchers -------------------- */
async function fetchCrossref(query: string, limit: number): Promise<RefItem[]> {
  try {
    const u = new URL('https://api.crossref.org/works');
    u.searchParams.set('query', query);
    u.searchParams.set('rows', String(Math.max(3, limit)));
    u.searchParams.set('select', 'title,author,issued,container-title,DOI,URL,type');
    const r = await fetch(u.toString(), { headers: { 'User-Agent': ua() } });
    const j: any = await r.json().catch(() => ({}));
    return (j?.message?.items ?? []).map((it: any): RefItem => ({
      sectionKey: '',
      title: (it?.title?.[0] ?? '').trim(),
      url: (it?.URL ?? '').trim() || (it?.DOI ? `https://doi.org/${it.DOI}` : ''),
      doi: it?.DOI ?? null,
      source: it?.['container-title']?.[0] ?? null,
      authors: (it?.author ?? [])
        .map((a: any) => [a?.given, a?.family].filter(Boolean).join(' '))
        .filter(Boolean)
        .join('; ') || null,
      publishedAt: yearToDate(it?.issued?.['date-parts']?.[0]?.[0]),
      type: (it?.type ?? 'JOURNAL')?.toUpperCase(),
      credibility: 88,
      _kind: 'crossref',
    })).filter(v => v.title && v.url);
  } catch { return []; }
}

async function fetchSemanticScholar(query: string, limit: number): Promise<RefItem[]> {
  try {
    const u = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
    u.searchParams.set('query', query);
    u.searchParams.set('limit', String(Math.max(3, limit)));
    u.searchParams.set('fields', 'title,authors,year,venue,externalIds,url,abstract');
    const headers: Record<string, string> = {};
    if (S2_KEY) headers['x-api-key'] = S2_KEY;
    const r = await fetch(u.toString(), { headers });
    const j: any = await r.json().catch(() => ({}));
    return (j?.data ?? []).map((it: any): RefItem => ({
      sectionKey: '',
      title: it?.title ?? '',
      url: it?.url ?? '',
      doi: it?.externalIds?.DOI ?? null,
      source: it?.venue ?? 'Semantic Scholar',
      authors: (it?.authors ?? []).map((a: any) => a?.name).filter(Boolean).join('; ') || null,
      publishedAt: it?.year ? `${it.year}-01-01` : null,
      type: 'JOURNAL',
      summary: it?.abstract ?? null,
      credibility: 82,
      _kind: 'semanticscholar',
    })).filter(v => v.title && v.url);
  } catch { return []; }
}

async function fetchArxiv(query: string, limit: number): Promise<RefItem[]> {
  try {
    const u = new URL('http://export.arxiv.org/api/query');
    u.searchParams.set('search_query', `all:${query.replace(/\s+/g, '+')}`);
    u.searchParams.set('start', '0');
    u.searchParams.set('max_results', String(Math.max(3, limit)));
    const r = await fetch(u.toString(), { headers: { 'User-Agent': ua() } });
    const xml = await r.text();
    return parseArxiv(xml);
  } catch { return []; }
}

function parseArxiv(xml: string): RefItem[] {
  const out: RefItem[] = [];
  const entries = xml.split('<entry>').slice(1);
  for (const e of entries) {
    const title = unescapeXml(grab(e, 'title'))?.trim().replace(/\s+/g, ' ') || '';
    const id = unescapeXml(grab(e, 'id')) || '';
    const summary = unescapeXml(grab(e, 'summary'))?.trim() || null;
    const published = unescapeXml(grab(e, 'published')) || '';
    const year = (published.match(/^(\d{4})/) || [])[1] || '';
    const authors = Array.from(e.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g))
      .map(m => unescapeXml(m[1]).trim())
      .filter(Boolean)
      .join('; ');
    const url = id || '';
    if (!title || !url) continue;
    out.push({
      sectionKey: '',
      title,
      url,
      doi: null,
      source: 'arXiv',
      authors: authors || null,
      publishedAt: year ? `${year}-01-01` : null,
      type: 'PREPRINT',
      summary,
      credibility: 70,
      _kind: 'arxiv',
    });
  }
  return out;
}

async function fetchPubMed(query: string, limit: number): Promise<RefItem[]> {
  try {
    // Step 1: search IDs
    const esearch = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
    esearch.searchParams.set('db', 'pubmed');
    esearch.searchParams.set('retmode', 'json');
    esearch.searchParams.set('retmax', String(Math.max(3, limit)));
    esearch.searchParams.set('term', query);
    const r1 = await fetch(esearch.toString());
    const j1: any = await r1.json().catch(() => ({}));
    const ids: string[] = j1?.esearchresult?.idlist ?? [];
    if (!ids.length) return [];

    // Step 2: summaries
    const esummary = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
    esummary.searchParams.set('db', 'pubmed');
    esummary.searchParams.set('retmode', 'json');
    esummary.searchParams.set('id', ids.join(','));
    const r2 = await fetch(esummary.toString());
    const j2: any = await r2.json().catch(() => ({}));
    const result = j2?.result || {};
    const out: RefItem[] = [];
    ids.forEach((pmid) => {
      const it = result[pmid];
      if (!it) return;
      const title = (it?.title ?? '').trim();
      const year = String(it?.pubdate || '').match(/\d{4}/)?.[0] || '';
      const authors = (it?.authors ?? []).map((a: any) => a?.name).filter(Boolean).join('; ') || null;
      const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
      if (title)
        out.push({
          sectionKey: '',
          title,
          url,
          doi: it?.elocationid?.startsWith('doi:') ? it.elocationid.replace('doi: ', '').trim() : null,
          source: it?.fulljournalname ?? 'PubMed',
          authors,
          publishedAt: year ? `${year}-01-01` : null,
          type: 'JOURNAL',
          summary: it?.sortfirstauthor ?? null,
          credibility: 86,
          _kind: 'pubmed',
        });
    });
    return out;
  } catch { return []; }
}

async function fetchOpenAlex(query: string, limit: number): Promise<RefItem[]> {
  try {
    const u = new URL('https://api.openalex.org/works');
    u.searchParams.set('search', query);
    u.searchParams.set('per_page', String(Math.max(3, limit)));
    u.searchParams.set('sort', 'relevance_score:desc');
    const r = await fetch(u.toString(), { headers: { 'User-Agent': ua() } });
    const j: any = await r.json().catch(() => ({}));
    return (j?.results ?? []).map((it: any): RefItem => ({
      sectionKey: '',
      title: it?.title ?? '',
      url: it?.primary_location?.source?.homepage_url || it?.primary_location?.landing_page_url || it?.id || '',
      doi: (it?.ids?.doi ?? '').replace('https://doi.org/', '') || null,
      source: it?.primary_location?.source?.display_name || 'OpenAlex',
      authors: (it?.authorships ?? []).map((a: any) => a?.author?.display_name).filter(Boolean).join('; ') || null,
      publishedAt: it?.from_year ? `${it.from_year}-01-01` : null,
      type: (it?.type ?? 'JOURNAL').toUpperCase(),
      summary: (it?.abstract_inverted_index ? flattenInverted(it.abstract_inverted_index) : null),
      credibility: 80,
      _kind: 'openalex',
    })).filter(v => v.title && v.url);
  } catch { return []; }
}

/* -------------------- Scoring & Sorting -------------------- */
async function scoreAndSort(items: RefItem[], context: string, useLLM: boolean): Promise<RefItem[]> {
  const nowYear = new Date().getFullYear();

  // Keyword-based relevance
  const relBase = items.map(it => ({ it, rel: relevanceKeyword(context, it) }));

  // Optional LLM rerank (on top 20 by keyword to save tokens)
  let llmScores: Map<string, number> | null = null;
  if (useLLM && relBase.length) {
    const top = relBase.sort((a, b) => b.rel - a.rel).slice(0, 20).map(r => r.it);
    llmScores = await llmRelevance(context, top);
  }

  // Final score
  const scored = items.map((it) => {
    const relKW = relevanceKeyword(context, it);
    const relLLM = llmScores?.get(sig(it)) ?? relKW;
    const cred = credibilityBase(it);
    const rec = recencyScore(it, nowYear);
    const score = 0.5 * relLLM + 0.3 * cred + 0.2 * rec; // 0–100
    return { ...it, credibility: Math.round(cred), _score: score } as RefItem;
  });

  scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  return scored;
}

function relevanceKeyword(context: string, it: RefItem): number {
  const text = `${it.title} ${it.source ?? ''} ${it.summary ?? ''}`.toLowerCase();
  const ctx = context.toLowerCase();
  const ctxTokens = tokenSet(ctx);
  const txtTokens = tokenSet(text);
  if (!ctxTokens.size || !txtTokens.size) return 0;
  const inter = [...ctxTokens].filter(t => txtTokens.has(t)).length;
  const score = (inter / Math.sqrt(ctxTokens.size * txtTokens.size)) * 100; // cosine-ish
  return Math.max(0, Math.min(100, score));
}

async function llmRelevance(context: string, items: RefItem[]): Promise<Map<string, number>> {
  try {
    const payload = items.map((it, i) => ({ id: i + 1, title: it.title, abstract: it.summary || '', venue: it.source || '' }));
    const prompt = `你是資訊檢索評分器。請依照主題對下列候選文獻評分相對相關性（0~100）。\n主題：\n${context}\n\n輸出 JSON 物件，鍵=候選 id，值=0~100 的分數。候選：\n${JSON.stringify(payload, null, 2)}`;
    const raw = await callLLM([{ role: 'user', content: prompt }], {
      model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
      temperature: 0,
      timeoutMs: 20000,
    });
    const obj = JSON.parse((raw || '{}').trim());
    const m = new Map<string, number>();
    items.forEach((it, idx) => m.set(sig(it), Number(obj[String(idx + 1)] ?? 0)));
    return m;
  } catch { return new Map(); }
}

function credibilityBase(it: RefItem): number {
  let s = 50;
  if (it.doi) s += 20;
  if (it.source) s += 10;
  const kindW: Record<string, number> = {
    crossref: 15,
    pubmed: 20,
    semanticscholar: 12,
    arxiv: 5,
    openalex: 10,
    wiki: -10,
  };
  s += kindW[it._kind || ''] || 0;
  return Math.max(0, Math.min(100, s));
}

function recencyScore(it: RefItem, nowYear: number): number {
  const y = (it.publishedAt || '').slice(0, 4);
  const year = Number(y) || 0;
  if (!year) return 50;
  const diff = Math.abs(nowYear - year);
  if (diff <= 1) return 100;
  if (diff <= 3) return 85;
  if (diff <= 5) return 70;
  if (diff <= 10) return 55;
  return 40;
}

/* -------------------- Utilities -------------------- */
function dedupRefs(items: RefItem[]): RefItem[] {
  const byKey = new Map<string, RefItem>();
  for (const it of items) {
    const key = (it.doi || it.url || it.title).toLowerCase();
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, it);
    else {
      // merge: prefer one with DOI, with summary, with higher cred
      const prev = byKey.get(key)!;
      const better = chooseBetter(prev, it);
      byKey.set(key, better);
    }
  }
  return Array.from(byKey.values());
}

function chooseBetter(a: RefItem, b: RefItem): RefItem {
  const score = (x: RefItem) => (x.doi ? 3 : 0) + (x.summary ? 1 : 0) + (x.credibility || 0) / 100;
  return score(a) >= score(b) ? a : b;
}

function uniqStrings(arr: string[]): string[] {
  const s = new Set(arr.map(v => v.trim()).filter(Boolean));
  return Array.from(s);
}

function ua() {
  const site = process.env.NEXT_PUBLIC_APP_URL || 'https://assignment-terminator.example';
  return `AssignmentTerminator (+${site})`;
}

function yearToDate(y?: number): string | null {
  if (!y) return null;
  const n = Number(y);
  if (!n) return null;
  return `${n}-01-01`;
}

function tokenSet(s: string): Set<string> {
  return new Set((s || '').toLowerCase().split(/[^a-z0-9一-龥]+/i).filter(w => w && w.length > 1));
}

function flattenInverted(inv: Record<string, number[]>): string {
  const max = Math.max(0, ...Object.values(inv).flat());
  const arr: string[] = new Array(max + 1).fill('');
  for (const [w, idxs] of Object.entries(inv)) idxs.forEach(i => (arr[i] = w));
  return arr.join(' ').trim();
}

function grab(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`));
  return m ? m[1] : '';
}

function unescapeXml(s?: string | null): string {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sig(it: RefItem): string {
  return (it.doi || it.url || it.title).toLowerCase();
}

function stripInternal(it: RefItem): RefItem {
  const { _kind, _score, ...rest } = it as any;
  return rest as RefItem;
}
