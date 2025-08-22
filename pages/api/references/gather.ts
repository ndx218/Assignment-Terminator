/* /pages/api/references/gather.ts */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { callLLM } from '@/lib/ai';
import { gatherForSection } from '@/lib/gather'; // ← 多來源學術蒐集器（Crossref/S2/arXiv/PubMed/OpenAlex）

type GatherReq = {
  outlineId: string;
  /** 每段最多取幾筆（硬上限，避免爆量） */
  maxPerSection?: number;
  /** 固定每段取幾筆（覆寫 LLM 自動規劃），與 customPlan 擇一 */
  fixedPerSection?: number;
  /** 客製每段 key 需要幾筆，例如 { "一":2, "二":3 }，與 fixedPerSection 擇一 */
  customPlan?: Record<string, number>;
  /** 指定來源（預設多學術來源，不含 Wikipedia） */
  sources?: Array<'crossref' | 'semanticscholar' | 'arxiv' | 'pubmed' | 'openalex'>;
  /** 是否僅預覽（不扣點、不入庫） */
  preview?: boolean;

  /** 進階選項：開啟 LLM 查詢擴展、LLM 重排 */
  enableLLMQueryExpand?: boolean;
  enableLLMRerank?: boolean;
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
  summary?: string | null;     // 為何可用（給使用者看的說明）
  credibility?: number;        // 綜合可信度/相關度分數
};

type ResBody =
  | { saved: RefItem[]; spent: number; remainingCredits: number; preview?: true }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: '未登入' });

  const {
    outlineId,
    maxPerSection = 3,
    fixedPerSection,
    customPlan,
    // 預設走純學術來源（不含 wiki）
    sources = ['crossref', 'semanticscholar', 'arxiv', 'pubmed', 'openalex'],
    preview = false,
    enableLLMQueryExpand = true,
    enableLLMRerank = true,
  } = (req.body || {}) as GatherReq;

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

  // 依使用者指定或 LLM 規劃，決定每段要抓幾筆
  let plan: Record<string, number> = {};
  if (customPlan && Object.keys(customPlan).length) {
    plan = clampPlan(customPlan, maxPerSection);
  } else if (fixedPerSection && fixedPerSection > 0) {
    // 取大綱中所有章節 key，通通固定同一數量
    plan = makeFlatPlan(outline.content, Math.min(fixedPerSection, maxPerSection));
  } else {
    plan = await getPlanByLLM(outline.content, maxPerSection);
  }

  const totalNeed = Object.values(plan).reduce((a, b) => a + b, 0);

  if (!preview && user.credits < totalNeed) {
    return res.status(402).json({ error: `點數不足：需 ${totalNeed} 點，剩餘 ${user.credits} 點` });
  }

  // 逐段抓取 → 產製「為何可引用」摘要 → 累積
  const toSave: RefItem[] = [];
  for (const [sectionKey, need] of Object.entries(plan)) {
    const cands = await gatherForSection(outline.title, outline.content, sectionKey, {
      need,
      sources,
      enableLLMQueryExpand,
      enableLLMRerank,
    });

    for (const c of cands) {
      const summary = await explainReference(c.title, outline.title, sectionKey);
      toSave.push({ ...c, sectionKey, summary });
    }
  }

  // 預覽模式：不寫庫、不扣點
  if (preview) {
    return res.status(200).json({
      saved: toSave,
      spent: 0,
      remainingCredits: user.credits,
      preview: true,
    });
  }

  // 入庫 + 扣點
  const data = toSave.map((c) => ({
    userId: user.id,
    outlineId: outline.id,
    sectionKey: c.sectionKey,
    title: c.title,
    url: c.url,
    doi: c.doi ?? null,
    source: c.source ?? null,
    authors: c.authors ?? null,
    publishedAt: c.publishedAt ? new Date(safeDate(c.publishedAt)) : undefined,
    type: c.type ?? 'OTHER',
    summary: c.summary ?? null,
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
    return { spent, remain: (user.credits ?? 0) - spent };
  });

  // 回傳目前所有引用（排序：段落→可信度→建立時間）
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

/* ======================= 工具函式 ======================= */

/** 夾在 1..cap，且過濾 <=0 的值 */
function clampPlan(raw: Record<string, number>, cap: number) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Math.max(1, Math.min(cap, Number(v) || 0));
    if (n) out[k] = n;
  }
  return Object.keys(out).length ? out : { I: 1 };
}

/** 從大綱抓全部章節 key，做一個「固定每段 n 筆」的平面規劃 */
function makeFlatPlan(outline: string, n: number) {
  const keys = extractSectionKeys(outline);
  const out: Record<string, number> = {};
  keys.forEach((k) => (out[k] = Math.max(1, n)));
  return Object.keys(out).length ? out : { I: n };
}

/** 讓 LLM 看整份大綱，回傳 JSON 物件：{ '一、':2, '二、':1, ... } */
async function getPlanByLLM(outline: string, cap: number): Promise<Record<string, number>> {
  const prompt =
    `下面的大綱，請輸出 JSON 形式（鍵=段落 key，值=建議引用數 1~${cap}）。` +
    `鍵名務必保持原文的章節起頭編號（例如「一、」「2.」「III.」）：\n\n${outline}\n\n只輸出純 JSON。`;
  try {
    const raw = await callLLM(
      [{ role: 'user', content: prompt }],
      { model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo', temperature: 0.2, timeoutMs: 30_000 }
    );
    return clampPlan(JSON.parse(raw), cap);
  } catch {
    // 失敗時退回「引言 2 筆」
    return { '一、': 2 };
  }
}

/** 從大綱字串抽出所有「章節 key」：支援中文一二三、阿拉伯 1.、羅馬數字 I. */
function extractSectionKeys(outline: string): string[] {
  const lines = outline.split(/\r?\n/).map((l) => l.trim());
  const headerRe = /^((?:[一二三四五六七八九十]+、)|(?:\d+\.)|(?:[IVXLCDMivxlcdm]+\.))\s+/;
  const keys: string[] = [];
  for (const ln of lines) {
    const m = ln.match(headerRe);
    if (m) keys.push(m[1]);
  }
  // 去重保序
  const seen = new Set<string>();
  return keys.filter(k => (seen.has(k) ? false : (seen.add(k), true)));
}

/** 產生「為何可引用」的三段式說明（值給 UI 顯示） */
async function explainReference(title: string, paperTitle: string, sectionKey: string): Promise<string> {
  const prompt =
    `以下是學生寫作主題《${paperTitle}》的第 ${sectionKey} 段落主題，請說明下面這篇文獻的價值：\n\n` +
    `文獻標題：「${title}」\n\n` +
    `請輸出三段：\n` +
    `1) 此文獻哪一句最具價值（可引用的核心發現/定義/方法論，<= 40 字）？\n` +
    `2) 可信度或特點（期刊/會議/樣本量/資料集/方法等，<= 50 字）。\n` +
    `3) 建議把它放在本文哪一句旁邊（寫出 1 句建議用法，<= 40 字）。`;
  const out = await callLLM([{ role: 'user', content: prompt }], {
    model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
    temperature: 0.4,
    timeoutMs: 15_000,
  });
  return out.trim();
}

/** 安全處理 publishedAt 欄位（只留 YYYY-MM-DD 或 YYYY） */
function safeDate(s?: string | null) {
  if (!s) return undefined;
  const m = String(s).match(/\d{4}(-\d{2}-\d{2})?/);
  return m ? m[0] : undefined;
}
