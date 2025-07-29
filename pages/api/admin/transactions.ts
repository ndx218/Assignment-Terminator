// /pages/api/admin/transactions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 只允許 GET 查詢交易紀錄
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ✅ 必須帶 req,res 才能在 Pages API 解析 session
  const session = await getAuthSession(req, res);
  if (!session || session.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權：僅限管理員操作' });
  }

  // ---- 解析查詢參數（page、pageSize、userId、email、type、since、until）----
  const q = req.query;
  const page = Math.max(1, parseInt(String(q.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(q.pageSize ?? '20'), 10) || 20));

  const userId = typeof q.userId === 'string' ? q.userId : undefined;
  const email = typeof q.email === 'string' ? q.email : undefined;
  const type = typeof q.type === 'string' ? q.type : undefined;

  const sinceRaw = typeof q.since === 'string' ? new Date(q.since) : undefined;
  const untilRaw = typeof q.until === 'string' ? new Date(q.until) : undefined;
  const since = sinceRaw && !Number.isNaN(+sinceRaw) ? sinceRaw : undefined;
  const until = untilRaw && !Number.isNaN(+untilRaw) ? untilRaw : undefined;

  const where: Prisma.TransactionWhereInput = {};
  if (userId) where.userId = userId;
  if (email) where.user = { email };                  // 關聯條件
  if (type) where.type = type;
  if (since || until) where.createdAt = { gte: since, lte: until };

  try {
    const [total, data] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },               // 依時間倒序
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          description: true,
          performedBy: true,                          // 你的 schema 有這欄位
          idempotencyKey: true,                       // 若你已加冪等鍵
          createdAt: true,
          user: { select: { email: true, phone: true } },
        },
      }),
    ]);

    return res.status(200).json({
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      data,
    });
  } catch (err) {
    console.error('[admin/transactions] 失敗', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
