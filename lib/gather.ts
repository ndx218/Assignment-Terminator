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
  publishedAt?: string | null;
  type?: string | null;
  summary?: string | null;
  credibility?: number;
  _kind?: SourceKind;
  _score?: number;
};

export type GatherOpts = {
  need: number;
  sources?: SourceKind[];
  enableLLMQueryExpand?: boolean;
  enableLLMRerank?: boolean;
  /** 新增：若為 true，硬性過濾到 AI 領域 */
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

export async function gatherForSection(
  paperTitle: string,
  outline: string,
  sectionKey: string,
  opts: GatherOpts
): Promise<RefItem[]> {
  const sources: SourceKind[] = opts.sources?.length
    ? opts.sources
    : (['crossref', 'semanticscholar', 'arxiv', 'pubmed'] as SourceKind[]);

  const line = outline.split('\n').find(l => l.trim().startsWith(sectionKey));
  const hint = line ? line.replace(/^[IVX一二三四五六七八九十\.\)\s-]+/, '').slice(0, 160) : '';
  const base = `${paperTitle} ${sectionKey} ${hint}`.trim();

  const queries = await expandQueries(base, ENABLE_LLM_EXPAND || !!opts.enableLLMQueryExpand, opts.aiTopicLock);

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

/* -------------------- Fetchers (原樣，略) -------------------- */
// ...（保留你原本的 fetchCrossref / fetchSemanticScholar / fetchArxiv / fetchPubMed / fetchOpenAlex 實作）...

/* -------------------- Scoring & Sorting -------------------- */
async function scoreAndSort(
  items: RefItem[],
  context: string,
  useLLM: boolean,
  aiLock?: boolean
): Promise<RefItem[]> {
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
    // 若鎖 AI，關聯性比重更高
    const score = (aiLock ? 0.65 : 0.5) * relLLM + 0.25 * cred + 0.10 * rec;
    return { ...it, credibility: Math.round(cred), _score: score } as RefItem;
  });

  scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  return scored;
}

function relevanceKeyword(context: string, it: RefItem, aiLock?: boolean): number {
  const text = `${it.title} ${it.source ?? ''} ${it.summary ?? ''}`.toLowerCase();
  const ctxTokens = tokenSet(context);
  const txtTokens = tokenSet(text);

  // 普通餘弦近似
  const inter = [...ctxTokens].filter(t => txtTokens.has(t)).length;
  let score = (inter / Math.sqrt(ctxTokens.size * txtTokens.size || 1)) * 100;

  // AI 專用加權
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

/* -------------------- Topic filters & utilities -------------------- */
function isClearlyAI(it: RefItem): boolean {
  const t = `${it.title} ${it.summary || ''} ${it.source || ''}`.toLowerCase();
  // 必須至少命中一個強 AI 詞，且不得是明顯非 AI 的醫療/化工關鍵詞（除非同時命中 AI 詞）
  const hasAI = AI_TOKENS.some(k => t.includes(k));
  if (!hasAI) return false;
  return true;
}

function buildContextForRelevance(paperTitle: string, hint: string, aiLock?: boolean): string {
  const base = `${paperTitle}\n${hint}`.trim();
  return aiLock ? `${base}\nArtificial Intelligence; Machine Learning; Deep Learning; LLM; Transformer; Generative AI` : base;
}

/* —— 以下工具沿用你原本版本（小幅增補 isClearlyAI / tokenSet 等） —— */

function dedupRefs(items: RefItem[]): RefItem[] {
  const byKey = new Map<string, RefItem>();
  for (const it of items) {
    const key = (it.doi || it.url || it.title).toLowerCase();
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, it);
    else {
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

function tokenSet(s: string): Set<string> {
  return new Set((s || '').toLowerCase().split(/[^a-z0-9一-龥]+/i).filter(w => w && w.length > 1));
}

function sig(it: RefItem): string {
  return (it.doi || it.url || it.title).toLowerCase();
}

function stripInternal(it: RefItem): RefItem {
  const { _kind, _score, ...rest } = it as any;
  return rest as RefItem;
}
