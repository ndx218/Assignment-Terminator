// /pages/api/admin/recharges.ts
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const records = await prisma.topUpSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        imageUrl: true,
        referralCode: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ data: records });
  } catch (error) {
    console.error('獲取充值記錄時出錯：', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
