// /pages/api/auth/login.ts
import { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Missing phone or code' });
  }

  try {
    // 找出該電話的驗證碼記錄（可設定過期邏輯）
    const record = await prisma.verificationCode.findFirst({
      where: { phone, code },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(401).json({ error: '驗證碼錯誤或已過期' });
    }

    // 確保使用者存在（若未註冊則可自動註冊 or 返回錯誤）
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ error: '使用者不存在，請先註冊' });
    }

    // 模擬產生一個 JWT token（這裡請換成你真正的 JWT 實作）
    const fakeJwt = Buffer.from(`${user.id}:${user.phone}`).toString('base64');

    return res.status(200).json({
      token: fakeJwt,
      user: {
        id: user.id,
        phone: user.phone,
        credits: user.credits,
      },
    });
  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ error: '登入失敗' });
  }
}
