// /pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { sendVerificationCode, verifyCode } from '@/lib/phoneAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method === 'POST') {
    const { phone, code, action } = req.body;

    if (!phone) {
      return res.status(400).json({ error: '請提供電話號碼' });
    }

    if (action === 'request') {
      // 發送驗證碼
      try {
        await sendVerificationCode(phone);
        return res.status(200).json({ message: '驗證碼已發送' });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || '驗證碼發送失敗' });
      }
    }

    if (action === 'verify') {
      if (!code) {
        return res.status(400).json({ error: '請提供驗證碼' });
      }

      const isValid = await verifyCode(phone, code);
      if (!isValid) {
        return res.status(401).json({ error: '驗證碼錯誤或已過期' });
      }

      // 確認用戶是否存在
      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        return res.status(404).json({ error: '找不到用戶，請先註冊' });
      }

      return res.status(200).json({ message: '登入成功', user });
    }

    return res.status(400).json({ error: '無效的請求動作' });
  }

  return res.status(405).json({ error: '只接受 POST 請求' });
}
