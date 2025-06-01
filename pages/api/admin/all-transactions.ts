// pages/api/admin/all-transactions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthSession } from '@/lib/auth'; // 只用封裝好的 getAuthSession
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '僅支援 GET' });
  }

  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(transactions);
  } catch (err) {
    console.error('[查詢失敗]', err);
    return res.status(500).json({ error: '查詢失敗' });
  }
}
