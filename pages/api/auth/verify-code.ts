import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { serialize } from 'cookie';

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

    // 驗證成功後刪除驗證碼紀錄
    await prisma.verificationCode.delete({ where: { phone } });

    // 檢查用戶是否已存在
    let user = await prisma.user.findUnique({ where: { phone } });

    // 若無帳戶則自動註冊
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          credits: 25, // 首次註冊送點（可調整）
        },
      });
    }

    // 建立 Session Token（簡易版）
    const sessionToken = nanoid();
    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        createdAt: new Date(),
      },
    });

    // 設定 cookie
    res.setHeader('Set-Cookie', serialize('session-token', sessionToken, {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 1 week
    }));

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('❌ 驗證碼處理失敗：', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
}
