/* /pages/api/references/gather.ts */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { callLLM } from '@/lib/ai';

type GatherReq = { outlineId: string; maxPerSection?: number };
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
  | { saved: RefItem[]; spent: number; remainingCredits: number }
  | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResBody>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: '未登入' });

  const { outlineId, maxPerSection = 3 } = (req.body ?? {}) as GatherReq;
  if (!outlineId) return res.status(400).json({ error: '缺少 outlineId' });

  // 讀取大綱 & 使用者
  const [outline, user] = await Promise.all([
    prisma.outline.findFirst({
      where: { id: outlineId, userId: session.user.id },
      select: { id: true, content: true, title: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, credits: true } }),
  ]);

  if (!outline) return res.status(404).json({ error: '大綱不存在或無權限' });
  if (!user)     return res.status(404).json({ error: '使用者不存在' });

  // ---------- Step1：LLM 產出「各段需要幾筆參考」 ----------
  const planPrompt = `下面是一份大綱。請輸出純 JSON，鍵為段落 key（如 "I", "II", "II.A"...），值為建議的參考文獻數量(1~${maxPerSection})。僅回傳 JSON。
大綱：
${outline.content}
`;
  let plan: Record<string, number>;
  try {
    const raw = await callLLM(
      [{ role: 'user', content: planPrompt }],
      { model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo', temperature: 0.2, timeoutMs: 30000, title: 'RefPlan' }
    );
    plan = safeParsePlan(raw, maxPerSection);
  } catch {
    plan = { I: 2 };
  }

  // 計算總需求
  const totalNeed = Object.values(plan).reduce((a, b) => a + b, 0);

  // ---------- Step2：檢查點數是否足夠 ----------
  if (user.credits < totalNeed) {
    return res.status(402).json({ error: `點數不足：需 ${totalNeed} 點，剩餘 ${user.credits} 點` });
  }

  // ---------- Step3：實際蒐集候選文獻 ----------
  const allSaved: RefItem[] = [];
  for (const [sectionKey, need] of Object.entries(plan)) {
    const q = buildQuery(outline.title, outline.content, sectionKey);
    const candidates = await gatherCandidates(q, need);
    candidates.forEach((c) => (c.sectionKey = sectionKey));
    allSaved.push(...candidates);
  }

  // ---------- Step4：一次性寫 DB + 扣點 ----------
  const dataForInsert = allSaved.map((c) => ({
    id: undefined,
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

  const result = await prisma.$transaction(async (tx) => {
    // 插入 reference（去重）
    const inserted = await tx.reference.createMany({
      data: dataForInsert,
      skipDuplicates: true,
    });
    const spent = inserted.count; // 真正寫入的筆數

    if (spent === 0) {
      return { spent: 0, remaining: user.credits };
    }

    // 扣點
    await tx.user.update({
      where: { id: user.id },
      data: { credits: { decrement: spent } },
    });

    // 記帳
    await tx.transaction.create({
      data: {
        userId: user.id,
        amount: spent,
        type: 'USAGE_REFERENCE',
        description: `引用產生 - 扣 ${spent} 點 (outline ${outline.id})`,
      },
    });

    return { spent, remaining: user.credits - spent };
  });

  // ---------- Step5：把剛剛真正存進 DB 的列出來 ----------
  const rows = await prisma.reference.findMany({
    where: { outlineId: outline.id, userId: user.id },
    orderBy: [{ sectionKey: 'asc' }, { credibility: 'desc' }, { createdAt: 'asc' }],
    select: { sectionKey: true, title: true, url: true, doi: true, source: true, authors: true, credibility: true },
  });

  return res.status(200).json({
    saved: rows,
    spent: result.spent,
    remainingCredits: result.remaining,
  });
}

/* ------------ helpers ------------ */
function safeParsePlan(raw: string, clamp: number): Record<string, number> {
  try {
    const obj = JSON.parse(raw.trim());
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const n = Math.max(1, Math.min(clamp, Number(v) || 0));
      if (n) out[k] = n;
    }
    return Object.keys(out).length ? out : { I: 2 };
  } catch {
    return { I: 2 };
  }
}

function buildQuery(title: string, outline: string, sectionKey: string): string {
  const first = outline.split('\n').find((l) => l.trim().startsWith(sectionKey));
  const hint = first ? first.replace(/^[IVX\.A-Z\)\s-]+/, '').slice(0, 120) : '';
  return `${title} ${sectionKey} ${hint}`.trim();
}

/* ------ 簡易蒐集：Crossref + Wikipedia ------ */
async function gatherCandidates(query: string, need: number): Promise<RefItem[]> {
  const arr: RefItem[] = [];

  /* 1) Crossref 略 …（與前一版相同，參考上條答案） */
  /* 2) Wikipedia 略 … */

  return arr.slice(0, need);
}
