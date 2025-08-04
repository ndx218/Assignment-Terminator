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
  publishedAt?: string | null | Date;
  type?: string | null;
  credibility?: number | null;
  summary?: string | null;
};

type Res =
  | { error: string }
  | { spent: number; remainingCredits: number; saved: any[] };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Res>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: '尚未登入，請先登入再操作' });
  }

  const userId = session.user.id;
  const { outlineId, items, mode = 'web' } = req.body as {
    outlineId?: string;
    items?: Item[];
    mode?: string;
  };

  if (!outlineId || !Array.isArray(items) || items.length < 1 || items.length > 3) {
    return res.status(400).json({ error: '請提供 1~3 筆有效的參考文獻' });
  }

  // 確認 outline 存在且屬於 user
  const outline = await prisma.outline.findFirst({ where: { id: outlineId, userId } });
  if (!outline) {
    return res.status(404).json({ error: '找不到對應的大綱，請重新產生後再試' });
  }

  // 計算費用
  const spent = Number(getCost('refs', mode) ?? 1) || 1;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 扣點
      const me = await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: spent } },
        select: { credits: true },
      });

      const saved: any[] = [];
      for (const it of items) {
        // URL 必要
        if (!it.url || typeof it.url !== 'string') continue;

        // 檢查重複：outline+section+url OR 全域 doi
        const orConditions: any[] = [
          { outlineId, sectionKey: it.sectionKey, url: it.url }
        ];
        if (it.doi) {
          orConditions.push({ doi: it.doi });
        }
        const exists = await tx.reference.findFirst({ where: { OR: orConditions } });
        if (exists) continue;

        try {
          const rec = await tx.reference.create({
            data: {
              userId,
              outlineId,
              sectionKey: it.sectionKey,
              title: it.title.slice(0, 512),
              url: it.url,
              doi: it.doi ?? null,
              source: it.source ?? null,
              authors: it.authors ?? null,
              publishedAt: it.publishedAt ? new Date(it.publishedAt as any) : null,
              type: it.type ?? 'OTHER',
              summary: it.summary ?? null,
              credibility: typeof it.credibility === 'number' ? it.credibility : 0,
            },
          });
          saved.push(rec);
        } catch (e: any) {
          // 如果是 doi 重複，跳過
          if (e.code === 'P2002' && e.meta?.target?.includes('doi')) {
            console.warn('跳過重複 DOI', it.doi);
            continue;
          }
          throw e;
        }
      }

      // 紀錄交易，只為實際儲存數量扣點
      await tx.transaction.create({
        data: {
          userId,
          amount: -saved.length * spent,
          type: 'USAGE',
          description: `段落參考文獻加入（${saved.length} 筆）`,
          performedBy: userId,
        },
      });

      return { remainingCredits: me.credits, saved };
    });

    return res.status(200).json({
      spent,
      remainingCredits: result.remainingCredits,
      saved: result.saved,
    });
  } catch (err: any) {
    console.error('❌ 儲存失敗 [refs/save]', err);
    return res.status(500).json({ error: '儲存失敗：' + (err.message || '未知錯誤') });
  }
}
