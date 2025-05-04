// /pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { phone, name, referralCode } = req.body;

  if (!phone || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const newUser = await prisma.user.create({
      data: {
        phone,
        name,
        credits: 25, // 首充送 25 點
        referredBy: referralCode || null,
      },
    });

    // 若填入推薦碼，查詢推薦人並加點
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) {
        await prisma.user.update({
          where: { id: referrer.id },
          data: { credits: { increment: 25 } },
        });
      }
    }

    return res.status(201).json({ message: '註冊成功', user: newUser });
  } catch (err) {
    console.error('[Register Error]', err);
    return res.status(500).json({ error: '註冊失敗' });
  }
}
