// pages/api/admin/recharges.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  // ✅ 僅允許特定管理員帳號查看（可自定義 email 白名單）
  const allowedAdmins = ['44444death@gmail.com'];
  if (!session || !allowedAdmins.includes(session.user?.email || '')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // ✅ 僅允許 GET 方法
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const records = await prisma.paymentRecord.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(records);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
