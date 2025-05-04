// ✅ /api/auth/send-code.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { randomInt } from 'crypto';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Missing phone number' });
  }

  const code = randomInt(100000, 999999).toString();

  try {
    // 保存驗證碼
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

    // 模擬簡訊發送（實際應該整合 SMS API）
    console.log(`✅ 發送驗證碼到 ${phone}: ${code}`);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ 發送驗證碼錯誤：', err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
