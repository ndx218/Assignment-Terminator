// pages/api/admin/topup-submissions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthSession } from '@/lib/auth';
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
    const submissions = await prisma.topUpSubmission.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(submissions);
  } catch (err) {
    console.error('[查詢失敗]', err);
    return res.status(500).json({ error: '查詢失敗' });
  }
}
