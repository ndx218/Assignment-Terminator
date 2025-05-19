import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { prisma } from '@/lib/prisma';
import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],

  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: '/login', // ✅ 確保為小寫
  },

  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60, // 1年
    updateAge: 30 * 24 * 60 * 60, // 每30天更新一次
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.phone = (user as any).phone ?? null;
        token.referredBy = (user as any).referredBy ?? null;
        token.referralCode = (user as any).referralCode ?? null;
      }
      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.phone = token.phone ?? null;
        session.user.referredBy = token.referredBy ?? null;
        session.user.referralCode = token.referralCode ?? null;
      }
      return session;
    },

    async signIn({ user }) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email ?? undefined },
      });

      if (dbUser) {
        (user as any).phone = dbUser.phone ?? null;
        (user as any).referredBy = dbUser.referredBy ?? null;
        (user as any).referralCode = dbUser.referralCode ?? null;
      }

      return true;
    },

    // ✅ 解決大小寫錯誤的 callbackUrl 問題
    redirect({ url, baseUrl }) {
      // 如果 callback URL 包含大小寫錯誤的 /Login → 修正為首頁
      if (url.toLowerCase().includes('/login')) {
        return baseUrl;
      }
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
};

export default authOptions;
