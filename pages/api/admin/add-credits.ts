import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { z } from 'zod';

const BodySchema = z.object({
  userId: z.string().min(1, 'userId 必填'),
  amount: z.number().int('必須為整數').positive('必須為正整數').max(1_000_000),
  idempotencyKey: z.string().max(128).optional(), // 可選
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // ✅ 使用你封裝好的 helper，務必傳入 req/res
  const session = await getAuthSession(req, res);
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
      // 👉 冪等：同一 idempotencyKey 僅處理一次（若你有此表）
      if (idempotencyKey) {
        const existed = await tx.idempotency
          .findUnique({ where: { key: idempotencyKey } })
          .catch(() => null);
        if (existed) {
          const last = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, phone: true, credits: true },
          });
          if (!last) throw new Error('USER_NOT_FOUND');
          return { user: last, reused: true };
        }
      }

      // 檢查用戶
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, phone: true, credits: true },
      });
      if (!user) throw new Error('USER_NOT_FOUND');

      // 計算新餘額（若允許負數就移除 Math.max）
      const nextCredits = Math.max(0, user.credits + amount);

      // 更新餘額
      const updated = await tx.user.update({
        where: { id: userId },
        data: { credits: nextCredits },
        select: { id: true, email: true, phone: true, credits: true },
      });

      // 交易流水（確保有 transaction 表）
      await tx.transaction.create({
        data: {
          userId,
          amount,
          type: amount >= 0 ? 'ADMIN_TOPUP' : 'ADMIN_DEDUCT',
          description: `管理員 ${session.user.email ?? session.user.id} 調整 ${amount} 點（新餘額 ${updated.credits}）`,
          performedBy: session.user.id, // 若 Schema 有此欄位
        },
      });

      // 記錄冪等 key（若有該表）
      if (idempotencyKey) {
        await tx.idempotency.create({
          data: { key: idempotencyKey, note: `add-credits:${userId}:${amount}` },
        });
      }

      return { user: updated, reused: false };
    });

    return res.status(200).json({
      message: result.reused ? '重複請求（已套用冪等）' : 'Credits added successfully',
      user: result.user,
    });
  } catch (err: any) {
    if (err?.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: '使用者不存在' });
    }
    console.error('[add-credits] 失敗', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
