import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getAuthSession();

  if (!session || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權' });
  }

  const submissions = await prisma.topUpSubmission.findMany({
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(submissions);
}
