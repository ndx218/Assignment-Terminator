// pages/api/admin/all-transactions.ts
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Session } from 'next-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions) as Session;

  if (!session || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權' });
  }

  const transactions = await prisma.transaction.findMany({
    include: {
      user: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(transactions);
}
