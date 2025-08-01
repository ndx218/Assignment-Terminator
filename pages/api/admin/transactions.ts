import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/server/authOptions';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

type Res =
  | { error: string }
  | {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
      data: any[];
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Res>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權：僅限管理員操作' });
  }

  /* ---------- 解析 query ---------- */
  const { page = '1', pageSize = '20', userId, email, type, since, until } =
    req.query;

  const p  = Math.max(1, parseInt(String(page), 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 20));

  const where: Prisma.TransactionWhereInput = {};
  if (typeof userId === 'string') where.userId = userId;
  if (typeof email === 'string')  where.user = { email };
  if (typeof type  === 'string')  where.type = type;

  const gte = typeof since === 'string' ? new Date(since)  : undefined;
  const lte = typeof until === 'string' ? new Date(until)  : undefined;
  if (gte || lte) where.createdAt = { gte, lte };

  /* ---------- 查詢 ---------- */
  try {
    const [total, data] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          description: true,
          performedBy: true,
          idempotencyKey: true,
          createdAt: true,
          user: { select: { email: true, phone: true } },
        },
      }),
    ]);

    return res.status(200).json({
      page: p,
      pageSize: ps,
      total,
      hasMore: p * ps < total,
      data,
    });
  } catch (err) {
    console.error('[admin/transactions] 失敗', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
