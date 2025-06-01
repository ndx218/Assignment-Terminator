// pages/api/admin/add-points.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthSession } from '@/lib/auth'; // ✅ 只要一行拿到 session
import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 直接用 getAuthSession()，內部 self‐contained 拿到 authOptions
  const session = (await getAuthSession()) as Session;
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權：僅限管理員操作' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '僅支援 POST 方法' });
  }

  const { email, amount } = req.body;
  if (!email || typeof amount !== 'number') {
    return res.status(400).json({ error: '請提供 email 與 amount' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: '使用者不存在' });
    }

    // 更新用戶點數
    const updated = await prisma.user.update({
      where: { email },
      data: { credits: user.credits + amount },
    });

    // 紀錄交易
    await prisma.transaction.create({
      data: {
        userId: updated.id,
        amount,
        type: 'ADMIN_TOPUP',
        description: `管理員手動加值 ${amount} 點`,
      },
    });

    return res.status(200).json({ message: `已為 ${email} 加值 ${amount} 點` });
  } catch (err) {
    console.error('[加點失敗]', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
}
