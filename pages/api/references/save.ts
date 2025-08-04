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

  console.log("📦 儲存參考文獻 req.body:", { outlineId, userId, itemsLength: items.length });

  const outline = await prisma.outline.findFirst({
    where: { id: outlineId, userId },
    select: { id: true },
  });

  if (!outline) {
    console.warn("⚠️ 找不到 Outline，可能是 userId 不符或資料不存在", { outlineId, userId });
    return res.status(404).json({ error: '找不到對應的大綱，請重新產生後再試' });
  }

  const spent = Number(getCost('refs', mode) ?? 1) || 1;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 扣點數
      const me = await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: spent } },
        select: { credits: true },
      });

      const saved: any[] = [];

      for (const it of items) {
        // 防呆：缺 URL 或格式錯
        if (!it.url || typeof it.url !== 'string') {
          console.warn("❌ 無效的 URL:", it);
          continue;
        }

        // 防止重複：同一 outline + 段落 + URL 不重複儲存
        const exists = await tx.reference.findFirst({
          where: {
            outlineId,
            sectionKey: it.sectionKey,
            url: it.url,
          },
        });
        if (exists) {
          console.log("🔁 文獻已存在，略過:", it.url);
          continue;
        }

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
      }

      // 建立扣點紀錄
      await tx.transaction.create({
        data: {
          userId,
          amount: -spent,
          type: 'USAGE',
          description: `段落參考文獻加入（${items.length} 筆）`,
          performedBy: userId,
        },
      });

      return { remainingCredits: me.credits, saved };
    });

    return res.status(200).json({
      spent,
      remainingCredits: result.remainingCredits,
      saved: result.saved ?? [],
    });
  } catch (err: any) {
    console.error('❌ 儲存失敗 [refs/save]', err);
    return res.status(500).json({ error: '儲存失敗：' + (err.message || '未知錯誤') });
  }
}
