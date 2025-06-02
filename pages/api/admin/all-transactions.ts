// pages/api/admin/all‐transactions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/authOptions';  // ✅ 這裡改成從 /server/authOptions 拿
import { prisma } from '@/lib/prisma';               // ✅ 一定要 import prisma

type TransactionRecord = {
  id: string;
  amount: number;
  isFirstTopUp: boolean;
  type: string;
  description: string | null;
  createdAt: Date;
  user: { email: string };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | TransactionRecord[]>
) {
  // 1) 僅允許 GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed — 只接受 GET' });
  }

  // 2) 驗證 Session 以及是否為 ADMIN
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: '未授權：僅限管理員操作' });
    }
  } catch (err) {
    console.error('[all‐transactions] 取 Session 錯誤：', err);
    return res.status(500).json({ error: '伺服器無法驗證身分，稍後再試' });
  }

  // 3) 從 DB 抓所有 transaction，加上 user.email
  try {
    const txs = await prisma.transaction.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(txs as TransactionRecord[]);
  } catch (dbErr) {
    console.error('[all‐transactions] DB 查詢失敗：', dbErr);
    return res.status(500).json({ error: '伺服器錯誤，查詢失敗' });
  }
}
