// /pages/api/me.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getTokenFromCookie } from '@/lib/auth-utils';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = getTokenFromCookie(req.headers.cookie);

  if (!token) {
    return res.status(401).json({ error: '未登入' });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            credits: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session || !session.user) {
      return res.status(401).json({ error: '無效的登入憑證' });
    }

    return res.status(200).json({ user: session.user });
  } catch (err) {
    console.error('[Me API Error]', err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
