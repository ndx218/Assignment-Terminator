// /pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const { email, phone } = req.body;

  if (!email || !phone) {
    return res.status(400).json({ error: 'Missing email or phone number' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone },
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email or phone' });
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        phone,
      },
    });

    return res.status(200).json({ message: 'User registered successfully', user: newUser });
  } catch (error: any) {
    console.error('[Register Error]', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
}
