// /pages/api/auth/verify-code.ts
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Missing phone or code' });
  }

  const record = await prisma.verificationCode.findUnique({
    where: { phone },
  });

  if (!record || record.code !== code || record.expiresAt < new Date()) {
    return res.status(401).json({ error: '驗證碼錯誤或已過期' });
  }

  // 驗證成功，建立 session（這裡用 cookie 簡化示範）
  const sessionToken = randomUUID();
  await prisma.session.create({
    data: {
      token: sessionToken,
      phone,
    },
  });

  res.setHeader('Set-Cookie', serialize('session-token', sessionToken, {
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  }));

  return res.status(200).json({ success: true });
}
