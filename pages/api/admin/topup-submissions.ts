// /pages/api/admin/topup-submissions.ts
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]'; // 根據你實際路徑調整

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const submissions = await prisma.topUpSubmission.findMany({
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(submissions);
}

