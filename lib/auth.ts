// ✅ lib/auth.ts（Email 登入 + referredBy 傳遞支援）
import type { NextAuthOptions, Session } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import type { JWT } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

// ✅ 擴充型別：加入 referredBy 支援
declare module 'next-auth' {
  interface User {
    id: string;
    referredBy?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      referredBy?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    referredBy?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // ✅ 把 DB 中的 referredBy 讀進 JWT
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.referredBy = (user as any).referredBy ?? null;
      }
      return token;
    },

    // ✅ 把 JWT 中的 referredBy 放進 session.user
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.referredBy = token.referredBy ?? null;
      }
      return session;
    },

    // ✅ 登入時從資料庫抓 user.referredBy
    async signIn({ user }) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email ?? undefined },
      });

      if (dbUser) {
        (user as any).referredBy = dbUser.referredBy ?? null;
      }

      return true;
    },
  },
};
