import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import authOptions from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user?.email !== 'ndx218@gmail.com') {
    return res.status(403).json({ error: '未授權：僅限管理員操作' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '僅支援 GET 方法' });
  }

  const email = req.query.email as string;

  if (!email) {
    return res.status(400).json({ error: '請提供 email' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: '使用者不存在' });
    }

    return res.status(200).json({
      email: user.email,
      credits: user.credits,
      transactions: user.transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        isFirstTopUp: t.isFirstTopUp,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    console.error('[查詢失敗]', err);
    return res.status(500).json({ error: '查詢失敗' });
  }
}
