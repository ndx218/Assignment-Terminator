/* /pages/api/references/gather.ts */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { callLLM } from '@/lib/ai';

const UA_SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://assignment-terminator.example';

type GatherReq = {
  outlineId: string;
  maxPerSection?: number;
  fixedPerSection?: number;
  customPlan?: Record<string, number>;
  sources?: ('crossref' | 'wiki')[];
  preview?: boolean;
};

type RefItem = {
  sectionKey: string;
  title: string;
  url: string;
  doi?: string | null;
  source?: string | null;
  authors?: string | null;
  publishedAt?: string | null;
  type?: string;
  summary?: string | null;
  credibility?: number;
};

type ResBody =
  | { saved: RefItem[]; spent: number; remainingCredits: number; preview?: true }
  | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResBody>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: '未登入' });

  const {
    outlineId,
    maxPerSection = 3,
    fixedPerSection,
    customPlan,
    sources = ['crossref', 'wiki'],
    preview = false,
  } = req.body as GatherReq;

  if (!outlineId) return res.status(400).json({ error: '缺少 outlineId' });

  const [outline, user] = await Promise.all([
    prisma.outline.findFirst({
      where: { id: outlineId, userId: session.user.id },
      select: { id: true, title: true, content: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, credits: true } }),
  ]);

  if (!outline) return res.status(404).json({ error: '大綱不存在或無權限' });
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  let plan: Record<string, number> = {};

  if (customPlan && Object.keys(customPlan).length) {
    plan = clampPlan(customPlan, maxPerSection);
  } else if (fixedPerSection && fixedPerSection > 0) {
    plan = { I: Math.min(fixedPerSection, maxPerSection) };
  } else {
    plan = await getPlanByLLM(outline.content, maxPerSection);
  }

  const totalNeed = Object.values(plan).reduce((a, b) => a + b, 0);

  if (!preview && user.credits < totalNeed) {
    return res.status(402).json({ error: `點數不足：需 ${totalNeed} 點，剩餘 ${user.credits} 點` });
  }

  const toSave: RefItem[] = [];
  for (const [sectionKey, need] of Object.entries(plan)) {
    const q = buildQuery(outline.title, outline.content, sectionKey);
    const cands = await gatherCandidates(q, need, sources);
    for (const c of cands) {
      c.sectionKey = sectionKey;
      c.summary = await explainReference(c.title, outline.title, sectionKey);
      toSave.push(c);
    }
  }

  if (preview) {
    return res.status(200).json({
      saved: toSave,
      spent: 0,
      remainingCredits: user.credits,
      preview: true,
    });
  }

  const data = toSave.map((c) => ({
    userId: user.id,
    outlineId: outline.id,
    sectionKey: c.sectionKey,
    title: c.title,
    url: c.url,
    doi: c.doi,
    source: c.source,
    authors: c.authors,
    publishedAt: c.publishedAt ? new Date(c.publishedAt) : undefined,
    type: c.type ?? 'OTHER',
    summary: c.summary,
    credibility: c.credibility ?? 0,
  }));

  const txRes = await prisma.$transaction(async (tx) => {
    const write = await tx.reference.createMany({ data, skipDuplicates: true });
    const spent = write.count;

    if (spent > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: spent } },
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          amount: spent,
          type: 'USAGE_REFERENCE',
          description: `引用產生 - 扣 ${spent} 點 (outline ${outline.id})`,
        },
      });
    }

    return { spent, remain: user.credits - spent };
  });

  const rows = await prisma.reference.findMany({
    where: { outlineId: outline.id, userId: user.id },
    orderBy: [{ sectionKey: 'asc' }, { credibility: 'desc' }, { createdAt: 'asc' }],
    select: {
      sectionKey: true,
      title: true,
      url: true,
      doi: true,
      source: true,
      authors: true,
      credibility: true,
      summary: true,
    },
  });

  return res.status(200).json({ saved: rows, spent: txRes.spent, remainingCredits: txRes.remain });
}

function clampPlan(raw: Record<string, number>, cap: number) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Math.max(1, Math.min(cap, Number(v) || 0));
    if (n) out[k] = n;
  }
  return Object.keys(out).length ? out : { I: 1 };
}

async function getPlanByLLM(outline: string, cap: number) {
  const prompt = `下面的大綱，請輸出 JSON 形式（鍵=段落 key，值=建議引用數 1~${cap}）。僅輸出 JSON：\n${outline}`;
  try {
    const raw = await callLLM(
      [{ role: 'user', content: prompt }],
      { model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo', temperature: 0.2, timeoutMs: 30000 }
    );
    return clampPlan(JSON.parse(raw), cap);
  } catch {
    return { I: 2 };
  }
}

function buildQuery(title: string, outline: string, sectionKey: string) {
  const line = outline.split('\n').find((l) => l.trim().startsWith(sectionKey));
  const hint = line ? line.replace(/^[IVX\.A-Z\)\s-]+/, '').slice(0, 120) : '';
  return `${title} ${sectionKey} ${hint}`.trim();
}

async function explainReference(title: string, paperTitle: string, sectionKey: string) {
  const prompt = `以下是學生寫作主題《${paperTitle}》的第 ${sectionKey} 段落主題，請說明下面這篇文獻的價值：\n\n文獻標題：「${title}」\n\n請輸出三段：\n1. 此文獻哪一句最具價值？\n2. 這篇文獻有什麼優點、可信之處或特點？\n3. 建議將這篇文獻用在寫作的哪一句？（可創作建議句）`;
  const out = await callLLM([{ role: 'user', content: prompt }], {
    model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
    temperature: 0.4,
    timeoutMs: 15000,
  });
  return out.trim();
}

async function gatherCandidates(query: string, need: number, sources: ('crossref' | 'wiki')[]): Promise<RefItem[]> {
  const out: RefItem[] = [];

  if (sources.includes('crossref')) {
    try {
      const u = new URL('https://api.crossref.org/works');
      u.searchParams.set('query', query);
      u.searchParams.set('rows', String(Math.max(need, 2)));
      u.searchParams.set('select', 'title,author,issued,container-title,DOI,URL');
      const r = await fetch(u.toString(), { headers: { 'User-Agent': `AssignmentTerminator (${UA_SITE})` } });
      const j: any = await r.json().catch(() => ({}));
      (j?.message?.items ?? []).forEach((it: any) => {
        const title = (it?.title?.[0] ?? '').trim();
        const doi = it?.DOI ? String(it.DOI) : null;
        const url = (it?.URL ?? '').trim() || (doi ? `https://doi.org/${doi}` : '');
        if (title && url)
          out.push({
            sectionKey: '',
            title,
            url,
            doi,
            source: it?.['container-title']?.[0] ?? null,
            authors: (it?.author ?? [])
              .map((a: any) => [a?.given, a?.family].filter(Boolean).join(' '))
              .filter(Boolean)
              .join('; ') || null,
            publishedAt: it?.issued?.['date-parts']?.[0]?.[0] ? `${it.issued['date-parts'][0][0]}-01-01` : null,
            type: 'JOURNAL',
            credibility: 85,
          });
      });
    } catch (e) {
      console.warn('[crossref]', e);
    }
  }

  if (sources.includes('wiki') && out.length < need) {
    try {
      const u = new URL('https://en.wikipedia.org/w/api.php');
      u.searchParams.set('action', 'query');
      u.searchParams.set('prop', 'info|extracts');
      u.searchParams.set('inprop', 'url');
      u.searchParams.set('exintro', '1');
      u.searchParams.set('explaintext', '1');
      u.searchParams.set('format', 'json');
      u.searchParams.set('origin', '*');
      u.searchParams.set('generator', 'search');
      u.searchParams.set('gsrsearch', query);
      u.searchParams.set('gsrlimit', String(Math.max(need - out.length, 1)));
      const r = await fetch(u.toString());
      const j: any = await r.json().catch(() => ({}));
      Object.values(j?.query?.pages ?? {}).forEach((p: any) => {
        out.push({
          sectionKey: '',
          title: p?.title ?? '',
          url: p?.fullurl ?? '',
          source: 'Wikipedia',
          type: 'WIKI',
          credibility: 55,
        });
      });
    } catch (e) {
      console.warn('[wiki]', e);
    }
  }

  return out.slice(0, need);
}
