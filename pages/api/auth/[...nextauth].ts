import type { NextAuthOptions, Session } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import type { JWT } from 'next-auth/jwt';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

// ✅ 擴充型別
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
    GitHubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
    }),
  ],
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // 在 JWT 中加入 referredBy
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.referredBy = (user as any).referredBy || null;
      }
      return token;
    },

    // 將 JWT 中的 referredBy 傳進 session.user
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.referredBy = token.referredBy || null;
      }
      return session;
    },

    // 登入時查詢 DB，把 referredBy 放進 user 裡
    async signIn({ user }) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email ?? undefined },
      });
      if (dbUser) {
        (user as any).referredBy = dbUser.referredBy || null;
      }
      return true;
    },
  },
};
