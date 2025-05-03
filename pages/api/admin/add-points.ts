// /pages/api/admin/add-points.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// 模擬一個簡單的點數資料庫（正式版應該接 DB）
let fakeUserPoints: Record<string, number> = {
  'example@gmail.com': 10,
  'test@demo.com': 5,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { email, amount } = req.body;

  if (!email || typeof email !== 'string' || !amount || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Invalid request: email and amount required' });
  }

  // 加點
  fakeUserPoints[email] = (fakeUserPoints[email] || 0) + amount;

  return res.status(200).json({
    message: `✅ 成功為 ${email} 加上 ${amount} 點，目前總點數為 ${fakeUserPoints[email]} 點`,
    currentPoints: fakeUserPoints[email],
  });
}
