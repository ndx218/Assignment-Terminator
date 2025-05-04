// ✅ 完整強化版：/pages/api/bind-phone.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 暫存驗證碼（如需正式環境請改用 Redis）
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { phone, otp, step, userId } = req.body;

  if (!phone || !step) {
    return res.status(400).json({ error: '缺少必要參數（phone 或 step）' });
  }

  if (step === 'send') {
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 分鐘有效
    otpStore.set(phone, { code: generatedOtp, expiresAt });

    // 模擬發送簡訊（正式環境應整合 Twilio / SMS API）
    console.log(`📲 發送驗證碼 ${generatedOtp} 至 ${phone}`);

    return res.status(200).json({ message: '驗證碼已發送' });
  }

  if (step === 'verify') {
    if (!otp || !userId) {
      return res.status(400).json({ error: '缺少驗證碼或 userId' });
    }

    const record = otpStore.get(phone);
    if (!record) {
      return res.status(400).json({ error: '驗證碼不存在，請重新發送' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ error: '驗證碼已過期，請重新發送' });
    }

    if (otp !== record.code) {
      return res.status(400).json({ error: '驗證碼錯誤' });
    }

    // 檢查該電話是否已被其他人綁定
    const exists = await prisma.user.findFirst({
      where: {
        phone,
        NOT: { id: userId }
      }
    });
    if (exists) {
      return res.status(400).json({ error: '此電話號碼已被其他帳戶綁定' });
    }

    // 綁定電話號碼到資料庫
    await prisma.user.update({
      where: { id: userId },
      data: { phone },
    });

    otpStore.delete(phone);
    return res.status(200).json({ message: '綁定成功' });
  }

  return res.status(400).json({ error: '無效的 step 參數' });
}
