// ✅ 強化修正版：/pages/api/redeem-referral.ts
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

    // ⚠ 修正這裡：你只有 referredBy，沒有 referrerId
    const referrerCode = user.referredBy;
    if (!referrerCode) {
      return res.status(400).json({ error: 'No referrer linked' });
    }

    const referrer = await prisma.user.findUnique({
      where: { referralCode: referrerCode },
    });
    if (!referrer) {
      return res.status(404).json({ error: 'Referrer not found' });
    }

    // 檢查是否已領取推薦獎勵
    const alreadyRewarded = await prisma.referral.findFirst({
      where: { refereeId: userId, rewarded: true },
    });
    if (alreadyRewarded) {
      return res.status(400).json({ error: 'Referral reward already claimed' });
    }

    // 檢查是否有符合條件的首充紀錄
    const topup = await prisma.transaction.findFirst({
      where: {
        userId,
        amount: { gte: 10 },
        isFirstTopUp: true,
      },
    });
    if (!topup) {
      return res.status(400).json({ error: 'No eligible first top-up found' });
    }

    // ✅ 發放推薦獎勵並記錄
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: 25 } },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { credits: { increment: 25 } },
      }),
      prisma.referral.create({
        data: {
          referrerId: referrer.id,
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
