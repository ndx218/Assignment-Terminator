// pages/api/admin/topup‐submissions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/authOptions';  // ✅ 從 /server/authOptions 拿
import { prisma } from '@/lib/prisma';               // ✅ 千萬別忘了 import prisma

type TopUpData =
  | { error: string }
  | Array<{
      id: string;
      name: string;
      phone: string;
      referralCode: string | null;
      imageUrl: string;
      createdAt: Date;
    }>;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TopUpData>
) {
  // 1) 僅支援 GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed — 只接受 GET' });
  }

  // 2) 驗證 session & 權限必須是 ADMIN
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: '未授權：僅限管理員操作' });
    }
  } catch (err) {
    console.error('[topup‐submissions] 取 Session 錯誤：', err);
    return res.status(500).json({ error: '伺服器無法驗證身分，稍後再試' });
  }

  // 3) 抓出所有 TopUpSubmission
  try {
    const subs = await prisma.topUpSubmission.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(subs);
  } catch (dbErr) {
    console.error('[topup‐submissions] DB 查詢失敗：', dbErr);
    return res.status(500).json({ error: '伺服器錯誤，查詢失敗' });
  }
}
