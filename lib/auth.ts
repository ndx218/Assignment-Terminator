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
    signIn: '/login', // ✅ 小寫
  },

  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60, // 1年
    updateAge: 30 * 24 * 60 * 60,
  },

  // ✅ 整合後的完整 callbacks
  callbacks: {
    async jwt({ token, user, account }) {
      console.log('🔥 jwt callback triggered', { token, user, account });

      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.phone = (user as any).phone ?? null;
        token.referredBy = (user as any).referredBy ?? null;
        token.referralCode = (user as any).referralCode ?? null;
      }

      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      console.log('🧠 session callback triggered', { session, token });

      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.phone = token.phone ?? null;
        session.user.referredBy = token.referredBy ?? null;
        session.user.referralCode = token.referralCode ?? null;
      }

      return session;
    },

    async signIn({ user }) {
      console.log('✅ signIn callback triggered', { user });

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

    redirect({ url, baseUrl }) {
      console.log('🚨 redirect callback triggered', { url, baseUrl });

      // 防止大小寫錯誤 fallback 到 login 頁
      if (url.toLowerCase().includes('/login')) {
        return baseUrl;
      }

      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },

  // ✅ 防止 cookie 在 Vercel 被擋掉
  useSecureCookies: true,
};

export default authOptions;
