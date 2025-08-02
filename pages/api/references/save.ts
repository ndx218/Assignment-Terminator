// pages/api/references/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCost } from '@/lib/points';

type Item = {
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

type Res = { error: string } | { spent: number; remainingCredits: number; saved: any[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Res>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: '未登入' });

  const { outlineId, items, mode = 'web' } = (req.body || {}) as { outlineId: string; items: Item[]; mode?: string };
  if (!outlineId || !Array.isArray(items) || items.length === 0 || items.length > 3)
    return res.status(400).json({ error: '請提供 1~3 筆要儲存的文獻' });

  const outline = await prisma.outline.findFirst({ where: { id: outlineId, userId: session.user.id }, select: { id: true }});
  if (!outline) return res.status(404).json({ error: '大綱不存在' });

  const spent = getCost('refs', mode) || 1; // 預設 1 點

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 扣點
      const me = await tx.user.update({
        where: { id: session.user.id },
        data: { credits: { decrement: spent } },
        select: { credits: true },
      });

      const saved = [];
      for (const it of items) {
        const rec = await tx.reference.create({
          data: {
            userId: session.user.id,
            outlineId,
            sectionKey: it.sectionKey,
            title: it.title.slice(0, 512),
            url: it.url,
            doi: it.doi ?? null,
            source: it.source ?? null,
            authors: it.authors ?? null,
            publishedAt: it.publishedAt ? new Date(it.publishedAt) : null,
            type: it.type ?? 'OTHER',
            summary: it.summary ?? null,
            credibility: typeof it.credibility === 'number' ? it.credibility : 0,
          },
        });
        saved.push(rec);
      }

      await tx.transaction.create({
        data: {
          userId: session.user.id,
          amount: -spent,
          type: 'USAGE',
          description: `段落參考文獻加入（${items.length} 筆）`,
          performedBy: session.user.id,
        },
      });

      return { remainingCredits: me.credits, saved };
    });

    return res.status(200).json({ spent, remainingCredits: result.remainingCredits, saved: result.saved });
  } catch (e) {
    console.error('[refs/save]', e);
    return res.status(500).json({ error: '儲存失敗，請稍後再試' });
  }
}
