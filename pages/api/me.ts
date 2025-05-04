// ✅ /api/me.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getTokenFromCookie } from '@/lib/auth-utils';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = getTokenFromCookie(req);

  if (!token) {
    return res.status(401).json({ error: '未登入' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { token },
      select: {
        id: true,
        phone: true,
        points: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: '無效的登入憑證' });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error('[Me API Error]', err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
