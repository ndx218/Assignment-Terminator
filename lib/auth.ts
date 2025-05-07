import type { Session, NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import type { JWT } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // 將 user 資訊寫入 JWT
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.phone = (user as any).phone ?? null;
        token.referredBy = (user as any).referredBy ?? null;
      }
      return token;
    },

    // 將 JWT 資訊同步到 session
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.phone = token.phone ?? null;
        session.user.referredBy = token.referredBy ?? null;
      }
      return session;
    },

    // 登入時從 DB 讀取 user 補充資料
    async signIn({ user }) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email ?? undefined },
      });

      if (dbUser) {
        (user as any).phone = dbUser.phone ?? null;
        (user as any).referredBy = dbUser.referredBy ?? null;
      }

      return true;
    },
  },
};
