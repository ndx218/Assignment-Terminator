import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { phone, code } = req.body;

  if (!phone || !code || typeof phone !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid phone or code' });
  }

  try {
    const record = await prisma.verificationCode.findUnique({
      where: { phone },
    });

    if (!record) {
      return res.status(400).json({ error: '驗證碼不存在，請重新獲取' });
    }

    const now = new Date();
    const expired = new Date(record.createdAt);
    expired.setMinutes(expired.getMinutes() + 10); // 驗證碼 10 分鐘有效

    if (record.code !== code) {
      return res.status(400).json({ error: '驗證碼錯誤' });
    }

    if (now > expired) {
      return res.status(400).json({ error: '驗證碼已過期，請重新獲取' });
    }

    // 通過驗證，接下來可以登入或綁定帳戶
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ 驗證錯誤：', err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
