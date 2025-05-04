import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CODE_EXPIRY_MINUTES = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { phone, code } = req.body;

  if (!phone || !code || typeof phone !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid phone or code' });
  }

  try {
    const record = await prisma.verificationCode.findUnique({ where: { phone } });

    if (!record) {
      return res.status(400).json({ error: '未找到驗證碼，請重新獲取' });
    }

    const now = new Date();
    const expiry = new Date(record.createdAt);
    expiry.setMinutes(expiry.getMinutes() + CODE_EXPIRY_MINUTES);

    if (now > expiry) {
      return res.status(400).json({ error: '驗證碼已過期，請重新獲取' });
    }

    if (record.code !== code) {
      return res.status(400).json({ error: '驗證碼錯誤' });
    }

    // 驗證成功後，清除驗證碼（選擇性）
    await prisma.verificationCode.delete({ where: { phone } });

    // TODO: 可以在這裡建立或登入使用者
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ 驗證碼處理失敗：', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
}
