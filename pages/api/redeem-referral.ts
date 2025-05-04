// ✅ 完整強化版：/pages/api/redeem-referral.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { userId } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid userId' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.referrerId) return res.status(400).json({ error: 'No referrer linked' });

    // 檢查是否已領取推薦獎勵
    const alreadyRewarded = await prisma.referral.findFirst({
      where: { refereeId: userId, rewarded: true },
    });
    if (alreadyRewarded) return res.status(400).json({ error: 'Referral reward already claimed' });

    // 確認是否有符合條件的首充紀錄
    const topup = await prisma.transaction.findFirst({
      where: {
        userId,
        amount: { gte: 10 },
        isFirstTopUp: true,
      },
    });
    if (!topup) return res.status(400).json({ error: 'No eligible first top-up found' });

    // 進行獎勵與紀錄新增
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: 25 } },
      }),
      prisma.user.update({
        where: { id: user.referrerId },
        data: { credits: { increment: 25 } },
      }),
      prisma.referral.create({
        data: {
          referrerId: user.referrerId,
          refereeId: userId,
          rewarded: true,
          createdAt: new Date(),
        },
      }),
    ]);

    return res.status(200).json({ success: true, message: 'Referral bonus granted' });
  } catch (err) {
    console.error('[Referral Error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
