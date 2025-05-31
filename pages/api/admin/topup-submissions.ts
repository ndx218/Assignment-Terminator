import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import authOptions from '../auth/[...nextauth]';
import type { Session } from 'next-auth'; // 👈 明確指定型別

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions) as Session; // 👈 型別斷言修復 Vercel 編譯錯誤

  if (!session || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const submissions = await prisma.topUpSubmission.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json(submissions);
}
