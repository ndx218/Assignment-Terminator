import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
// 您需要从 '@/lib/auth' 导入 authOptions，而不是 'auth/[...nextauth]'
// 因为您在 pages/api/auth/[...nextauth].ts 中已经将配置模块化了
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth';
// 如果您想在这里使用 UserRole 类型，也可以导入它，但不是必须的
// import type { UserRole } from '../../../types/next-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 获取会话。getServerSession 的第三个参数是 authOptions
  const session: Session | null = await getServerSession(req, res, authOptions);

  // ✅ 关键修改：检查用户角色
  if (!session || !session.user || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權：僅限管理員操作' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '僅支援 POST 方法' });
  }

  const { email, amount } = req.body;

  // 更好的输入验证：确保 amount 是一个正数
  if (!email || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: '請提供有效的 email 與正數點數' });
  }

  try {
    // 查找目标用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ error: '找不到該使用者 Email' });
    }

    // 更新使用者點數
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        credits: { increment: amount },
      },
    });

    // 建立交易記錄
    // isFirstTopUp 逻辑可以稍微修改，确保只在没有其他记录时为 true
    const existingTransactions = await prisma.transaction.count({
      where: { userId: user.id },
    });

    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount,
        type: 'ADMIN_TOPUP', // 明确指出是管理员加点
        description: `Admin added ${amount} points`,
        isFirstTopUp: existingTransactions === 0, // 如果之前没有交易，则为首充
      },
    });

    return res.status(200).json({ message: `✅ 成功為 ${email} 增加 ${amount} 點，目前共 ${updatedUser.credits} 點` });
  } catch (err) {
    console.error('[加點失敗]', err);
    // 更具体的错误信息，避免暴露内部错误
    return res.status(500).json({ error: '加點失敗，請檢查 Email 是否存在或聯繫管理員' });
  }
}
