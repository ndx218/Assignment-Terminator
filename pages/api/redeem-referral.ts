// /pages/api/redeem-referral.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const db = await connectToDatabase();
    const users = db.collection('users');
    const referrals = db.collection('referrals');
    const transactions = db.collection('transactions');

    const user = await users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.referrerId) return res.status(400).json({ error: 'No referrer linked' });

    const alreadyRewarded = await referrals.findOne({ refereeId: userId, rewarded: true });
    if (alreadyRewarded) return res.status(400).json({ error: 'Referral reward already claimed' });

    const firstTopUp = await transactions.findOne({ userId, amount: { $gte: 10 }, isFirstTopUp: true });
    if (!firstTopUp) return res.status(400).json({ error: 'No eligible first top-up found' });

    // Award points
    await users.updateOne({ _id: userId }, { $inc: { points: 25 } });
    await users.updateOne({ _id: user.referrerId }, { $inc: { points: 25 } });
    await referrals.insertOne({ referrerId: user.referrerId, refereeId: userId, rewarded: true, createdAt: new Date() });

    return res.status(200).json({ success: true, message: 'Referral bonus granted' });
  } catch (err) {
    console.error('[Referral Error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
