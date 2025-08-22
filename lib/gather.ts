/* lib/gather.ts — Enhanced Scholarly Reference Harvester (AI-topic locked) */
import { callLLM } from '@/lib/ai';

export type SourceKind = 'crossref' | 'semanticscholar' | 'arxiv' | 'pubmed' | 'openalex' | 'wiki';

export type RefItem = {
  sectionKey: string;
  title: string;
  url: string;
  doi?: string | null;
  source?: string | null;
  authors?: string | null;
  publishedAt?: string | null; // ISO-ish yyyy-mm-dd
  type?: string | null;        // JOURNAL/CONFERENCE/PREPRINT/etc.
  summary?: string | null;     // abstract/snippet if available
  credibility?: number;        // 0–100
  _kind?: SourceKind;          // internal: origin
  _score?: number;             // internal: overall score for ranking
};

export type GatherOpts = {
  need: number;                     // number of items to return
  sources?: SourceKind[];           // default sensible set
  enableLLMQueryExpand?: boolean;   // default: false
  enableLLMRerank?: boolean;        // default: false
  /** 若為 true，硬性過濾到 AI 領域 */
  aiTopicLock?: boolean;
};

const S2_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
const OPENALEX = process.env.OPENALEX_ENABLE === '1';
const ENABLE_LLM_EXPAND = process.env.REF_LLM_EXPAND === '1';
const ENABLE_LLM_RERANK = process.env.REF_LLM_RERANK === '1';

// 會被強化的 AI 關鍵詞（用於查詢擴展、關聯加權）
const AI_TOKENS = [
  'artificial intelligence','ai','machine learning','ml','deep learning','neural network',
  'transformer','large language model','llm','bert','gpt','diffusion','reinforcement learning',
  'computer vision','nlp','generative','foundation model'
];

/** Main entry: Build queries from title/outline/sectionKey and gather top-N references. */
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

  const queries = await expandQueries(base, ENABLE_LLM_EXPAND || !!opts.enableLLMQueryExpand, opts.aiTopicLock);

  // Fan out to sources per query (small limits each), collect
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
    }
    const chunk = await Promise.allSettled(tasks);
    chunk.forEach(r => { if (r.status === 'fulfilled') raw.push(...r.value); });
  }

  // 1) 去重
  let items = dedupRefs(raw);

  // 2) 主題硬過濾（AI）
  if (opts.aiTopicLock) {
    items = items.filter(isClearlyAI);
  }

  // 3) 打分：關聯（關鍵詞 + LLM）、可信度、時間
  const context = buildContextForRelevance(paperTitle, hint, opts.aiTopicLock);
  const scored = await scoreAndSort(items, context, ENABLE_LLM_RERANK || !!opts.enableLLMRerank, opts.aiTopicLock);

  return scored.slice(0, opts.need || 5).map(stripInternal);
}

/* -------------------- Query Expansion -------------------- */
async function expandQueries(seed: string, useLLM: boolean, aiLock?: boolean): Promise<string[]> {
  const base = seed.replace(/\s+/g, ' ').trim();

  // 基本：把 AI 同義詞硬加進查詢，保證檢索焦點
  const enforced = aiLock
    ? uniqStrings([
        base,
        `${base} Artificial Intelligence`,
        `${base} machine learning`,
        `${base} deep learning`,
        `${base} large language model LLM`,
      ])
    : [base];

  if (!useLLM) return enforced.slice(0, 4);

  try {
    const prompt = `Generate 3 compact academic search queries (<=10 keywords each) for Crossref/Semantic Scholar/arXiv/PubMed.
Topic: ${base}
${aiLock ? `The topic MUST be about Artificial Intelligence / ML. Always include at least one AI term.` : ''}
Return ONLY a JSON array of strings.`;
    const raw = await callLLM([{ role: 'user', content: prompt }], {
      model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
      temperature: 0.2,
      timeoutMs: 15000,
    });
    const arr = JSON.parse((raw || '[]').trim());
    return uniqStrings([...enforced, ...(Array.isArray(arr) ? arr.map(String) : [])]).slice(0, 6);
  } catch {
    return enforced.slice(0, 4);
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
          summary: null,
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
      url: it?.primary_location?.source?.homepage_url
        || it?.primary_location?.landing_page_url
        || it?.id
        || '',
      doi: (it?.ids?.doi ?? '').replace('https://doi.org/', '') || null,
      source: it?.primary_location?.source?.display_name || 'OpenAlex',
      authors: (it?.authorships ?? []).map((a: any) => a?.author?.display_name).filter(Boolean).join('; ') || null,
      publishedAt: it?.from_year ? `${it.from_year}-01-01` : null,
      type: (it?.type ?? 'JOURNAL').toUpperCase(),
      summary: it?.abstract_inverted_index ? flattenInverted(it.abstract_inverted_index) : null,
      credibility: 80,
      _kind: 'openalex',
    })).filter(v => v.title && v.url);
  } catch { return []; }
}

/* -------------------- Relevance / Scoring -------------------- */
async function scoreAndSort(items: RefItem[], context: string, useLLM: boolean, aiLock?: boolean): Promise<RefItem[]> {
  const nowYear = new Date().getFullYear();

  const relBase = items.map(it => ({ it, rel: relevanceKeyword(context, it, aiLock) }));

  let llmScores: Map<string, number> | null = null;
  if (useLLM && relBase.length) {
    const top = relBase.sort((a, b) => b.rel - a.rel).slice(0, 20).map(r => r.it);
    llmScores = await llmRelevance(context, top, aiLock);
  }

  const scored = items.map((it) => {
    const relKW = relevanceKeyword(context, it, aiLock);
    const relLLM = llmScores?.get(sig(it)) ?? relKW;
    const cred = credibilityBase(it);
    const rec = recencyScore(it, nowYear);
    const score = (aiLock ? 0.65 : 0.5) * relLLM + 0.25 * cred + 0.10 * rec; // AI 鎖定時提高關聯性權重
    return { ...it, credibility: Math.round(cred), _score: score } as RefItem;
  });

  scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  return scored;
}

function relevanceKeyword(context: string, it: RefItem, aiLock?: boolean): number {
  const text = `${it.title} ${it.source ?? ''} ${it.summary ?? ''}`.toLowerCase();
  const ctxTokens = tokenSet(context);
  const txtTokens = tokenSet(text);
  const inter = [...ctxTokens].filter(t => txtTokens.has(t)).length;
  let score = (inter / Math.sqrt(ctxTokens.size * txtTokens.size || 1)) * 100;

  if (aiLock) {
    const hits = AI_TOKENS.filter(t => text.includes(t)).length;
    score += Math.min(30, hits * 6); // 命中越多 AI 詞，越加分
  }
  return Math.max(0, Math.min(100, score));
}

async function llmRelevance(context: string, items: RefItem[], aiLock?: boolean): Promise<Map<string, number>> {
  try {
    const payload = items.map((it, i) => ({ id: i + 1, title: it.title, abstract: it.summary || '', venue: it.source || '' }));
    const prompt =
      `Rate relevance (0-100) of each candidate to the topic below.\n` +
      `${aiLock ? 'Reject or heavily downscore items not clearly about AI/ML.' : ''}\n` +
      `Topic:\n${context}\n\nReturn ONLY a JSON object {id: score}.\nCandidates:\n` +
      JSON.stringify(payload, null, 2);
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

/* -------------------- Topic filters & utilities -------------------- */
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

function isClearlyAI(it: RefItem): boolean {
  const t = `${it.title} ${it.summary || ''} ${it.source || ''}`.toLowerCase();
  const hasAI = AI_TOKENS.some(k => t.includes(k));
  return hasAI;
}

function buildContextForRelevance(paperTitle: string, hint: string, aiLock?: boolean): string {
  const base = `${paperTitle}\n${hint}`.trim();
  return aiLock
    ? `${base}\nArtificial Intelligence; Machine Learning; Deep Learning; LLM; Transformer; Generative AI`
    : base;
}

function uniqStrings(arr: string[]): string[] {
  const s = new Set(arr.map(v => v.trim()).filter(Boolean));
  return Array.from(s);
}

function tokenSet(s: string): Set<string> {
  return new Set((s || '').toLowerCase().split(/[^a-z0-9一-龥]+/i).filter(w => w && w.length > 1));
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

function grab(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
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

function flattenInverted(inv: Record<string, number[]>): string {
  const max = Math.max(0, ...Object.values(inv).flat());
  const arr: string[] = new Array(max + 1).fill('');
  for (const [w, idxs] of Object.entries(inv)) idxs.forEach(i => (arr[i] = w));
  return arr.join(' ').trim();
}

function sig(it: RefItem): string {
  return (it.doi || it.url || it.title).toLowerCase();
}

function stripInternal(it: RefItem): RefItem {
  const { _kind, _score, ...rest } = it as any;
  return rest as RefItem;
}
