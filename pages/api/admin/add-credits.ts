import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { z } from 'zod';

const BodySchema = z.object({
  userId: z.string().min(1, 'userId 必填'),
  amount: z.number().int('必須為整數').positive('必須為正整數').max(1_000_000),
  idempotencyKey: z.string().max(128).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const session = await getAuthSession(req, res);
  if (!session || session.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權：僅限管理員操作' });
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }
  const { userId, amount, idempotencyKey } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 冪等：同一 key 二次請求直接返回最新用戶餘額
      if (idempotencyKey) {
        const existed = await tx.transaction.findUnique({ where: { idempotencyKey } }).catch(() => null);
        if (existed) {
          const last = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, phone: true, credits: true },
          });
          if (!last) throw new Error('USER_NOT_FOUND');
          return { user: last, reused: true };
        }
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, phone: true, credits: true },
      });
      if (!user) throw new Error('USER_NOT_FOUND');

      const nextCredits = Math.max(0, user.credits + amount);

      const updated = await tx.user.update({
        where: { id: userId },
        data: { credits: nextCredits },
        select: { id: true, email: true, phone: true, credits: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount,
          type: amount >= 0 ? 'ADMIN_TOPUP' : 'ADMIN_DEDUCT', // 你目前 type 是 string，直接傳字串
          description: `管理員 ${session.user.email ?? session.user.id} 調整 ${amount} 點（新餘額 ${updated.credits}）`,
          performedBy: session.user.id,
          idempotencyKey: idempotencyKey ?? null,
        },
      });

      return { user: updated, reused: false };
    });

    return res.status(200).json({
      message: result.reused ? '重複請求（冪等命中）' : 'Credits added successfully',
      user: result.user,
    });
  } catch (err: any) {
    if (err?.message === 'USER_NOT_FOUND') return res.status(404).json({ error: '使用者不存在' });
    // 競態下第二次插入相同 idempotencyKey，會撞 unique，視為冪等命中
    if (err?.code === 'P2002' && err?.meta?.target?.includes('idempotencyKey')) {
      const u = await prisma.user.findUnique({
        where: { id: parsed.data.userId },
        select: { id: true, email: true, phone: true, credits: true },
      });
      if (u) return res.status(200).json({ message: '重複請求（冪等命中）', user: u });
    }
    console.error('[add-credits] 失敗', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
