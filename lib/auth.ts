// ✅ lib/auth.ts（Email 登入設定）
import type { NextAuthOptions, Session } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER, // 例如 SMTP
      from: process.env.EMAIL_FROM      // 寄信的 Email
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

// ✅ /pages/api/bind-phone.ts（電話綁定）
import type { NextApiRequest, NextApiResponse } from 'next';

const phoneOtpMap = new Map<string, string>(); // demo 用暫存，可換成 Redis

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  if (method === 'POST') {
    const { phone, otp, step, userId } = req.body;

    if (!phone || !step) return res.status(400).json({ error: '缺少參數' });

    if (step === 'send') {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      phoneOtpMap.set(phone, generatedOtp);
      console.log(`📲 發送驗證碼 ${generatedOtp} 至 ${phone}`);
      return res.status(200).json({ message: '驗證碼已發送' });
    }

    if (step === 'verify') {
      if (otp === phoneOtpMap.get(phone)) {
        // 在這裡將 phone 綁定至資料庫中的 userId
        phoneOtpMap.delete(phone);
        return res.status(200).json({ message: '綁定成功' });
      } else {
        return res.status(400).json({ error: '驗證碼錯誤' });
      }
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
