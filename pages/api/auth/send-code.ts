import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { randomInt } from 'crypto';
import { sendSMS } from '@/lib/sms';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { phone } = req.body;

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid phone number' });
  }

  const code = randomInt(100000, 999999).toString(); // 產生 6 位數字驗證碼

  try {
    await prisma.verificationCode.upsert({
      where: { phone },
      update: {
        code,
        createdAt: new Date(),
      },
      create: {
        phone,
        code,
        createdAt: new Date(),
      },
    });

    await sendSMS(phone, `你的驗證碼是 ${code}`); // 模擬簡訊

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ 發送驗證碼錯誤：', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試。' });
  }
}
