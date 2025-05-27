import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma'; // 确保导入您的 Prisma 客户端

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. 验证请求方法
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 2. 身份验证和授权 (重要!)
  // 这只是一个示例，您需要实现真正的管理员身份验证和授权逻辑。
  // 例如，检查 session、检查用户角色、或使用 API Key。
  // const session = await getServerSession(req, res, authOptions); // 如果使用NextAuth.js
  // if (!session || session.user.role !== 'admin') { // 假设用户有 'role' 字段
  //   return res.status(403).json({ message: 'Forbidden' });
  // }
  // 或者，使用一个简单的API Key作为初始测试（不推荐用于生产环境）
  const adminApiKey = req.headers['x-admin-api-key'];
  if (adminApiKey !== process.env.ADMIN_API_KEY) { // 确保在.env中设置 ADMIN_API_KEY
    return res.status(403).json({ message: 'Unauthorized API Key' });
  }


  // 3. 解析请求体
  const { userId, amount } = req.body;

  if (!userId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ message: 'User ID and a positive amount are required.' });
  }

  try {
    // 4. 更新用户积分
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          increment: amount, // 使用 increment 确保原子操作
        },
      },
    });

    return res.status(200).json({
      message: 'Credits added successfully',
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        credits: updatedUser.credits,
      },
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
