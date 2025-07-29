import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options'; // 你專案裡的 NextAuth 設定
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const BodySchema = z.object({
  userId: z.string().min(1, 'userId 必填'),
  amount: z.number().int('必須為整數').positive('必須為正整數').max(1_000_000),
  idempotencyKey: z.string().max(128).optional(), // 可選
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權：僅限管理員操作' });
  }

  const parse = BodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten().fieldErrors });
  }
  const { userId, amount, idempotencyKey } = parse.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 若你有冪等表，先查是否已處理過（可選）
      if (idempotencyKey) {
        const existed = await tx.idempotency.findUnique({ where: { key: idempotencyKey } }).catch(() => null);
        if (existed) {
          // 已處理過，直接返回上次結果（需要你把結果也保存）
          const last = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, credits: true } });
          if (!last) throw new Error('USER_NOT_FOUND');
          return { user: last, reused: true };
        }
      }

      // 檢查用戶
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, credits: true },
      });
      if (!user) throw new Error('USER_NOT_FOUND');

      // 實際更新（若允許負數，請移除 Math.max）
      const nextCredits = Math.max(0, user.credits + amount);

      const updated = await tx.user.update({
        where: { id: userId },
        data: { credits: nextCredits },
        select: { id: true, email: true, credits: true, phone: true },
      });

      // 記錄交易流水（假設你有 transaction 表）
      await tx.transaction.create({
        data: {
          userId: userId,
          amount,
          type: 'ADMIN_TOPUP',
          description: `管理員 ${session.user.email ?? session.user.id} 加值 ${amount} 點，餘額 ${updated.credits}`,
          performedBy: session.user.id, // 若有此欄位
        },
      });

      // 保存冪等 key（可選）
      if (idempotencyKey) {
        await tx.idempotency.create({ data: { key: idempotencyKey, note: `add-credits:${userId}:${amount}` } });
      }

      return { user: updated, reused: false };
    });

    return res.status(200).json({
      message: result.reused ? '重複請求（已套用冪等）' : 'Credits added successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        phone: result.user.phone,
        credits: result.user.credits,
      },
    });
  } catch (err: any) {
    if (err?.message === 'USER_NOT_FOUND') return res.status(404).json({ error: '使用者不存在' });
    console.error('[add-credits] 失敗', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
