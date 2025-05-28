import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
// 您需要从 '@/lib/auth' 导入 authOptions，而不是 '../auth/[...nextauth]'
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 获取会话。getServerSession 的第三个参数是 authOptions
  const session: Session | null = await getServerSession(req, res, authOptions);

  // ✅ 关键修改：检查用户角色
  if (!session || !session.user || session.user.role !== 'ADMIN') {
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
      credits: user.credits, // 也可以返回积分信息
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
