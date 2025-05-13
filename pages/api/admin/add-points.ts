import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import authOptions from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth'; // ✅ 加上這行

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session: Session | null = await getServerSession(req, res, authOptions); // ✅ 明確加上型別

  // ✅ 修改為你自己的管理員帳號
  if (!session || session.user?.email !== 'ndx218@gmail.com') {
    return res.status(403).json({ error: '未授權：僅限管理員操作' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '僅支援 POST 方法' });
  }

  const { email, amount } = req.body;

  if (!email || typeof amount !== 'number') {
    return res.status(400).json({ error: '請提供有效的 email 與點數' });
  }

  try {
    // ✅ 更新使用者點數
    const user = await prisma.user.update({
      where: { email },
      data: {
        credits: { increment: amount },
      },
    });

    // ✅ 建立交易記錄
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount,
        isFirstTopUp: !(await prisma.transaction.findFirst({ where: { userId: user.id } })),
      },
    });

    return res.status(200).json({ message: `✅ 成功為 ${email} 增加 ${amount} 點，目前共 ${user.credits} 點` });
  } catch (err) {
    console.error('[加點失敗]', err);
    return res.status(500).json({ error: '加點失敗，請確認使用者 Email 是否存在' });
  }
}
