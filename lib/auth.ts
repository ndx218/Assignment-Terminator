import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { prisma } from '@/lib/prisma';
import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
// 导入您自定义的 UserRole 类型
import type { UserRole } from '../types/next-auth'; // 请根据您的实际文件路径调整

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
    signIn: '/login', // ✅ 小寫 login 頁面
  },

  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60, // 1年
    updateAge: 30 * 24 * 60 * 60, // 每30天刷新
  },

  useSecureCookies: true, // ✅ 生效 __Secure- cookie 名稱

  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // console.log('🔥 jwt callback triggered', { token, user, account }); // 调试用，可以保留或删除

      // 用户对象 (user) 仅在第一次登录或用户数据更新时可用
      if (user) {
        token.id = user.id;
        token.email = user.email;
        // ✅ 关键：将 role 属性从 user 对象添加到 token
        token.role = (user as any).role as UserRole; // 使用类型断言
        // ✅ 关键：将 credits 属性从 user 对象添加到 token
        token.credits = (user as any).credits as number; // 使用类型断言

        // 添加其他您需要的属性
        token.phone = (user as any).phone ?? null;
        token.referredBy = (user as any).referredBy ?? null;
        token.referralCode = (user as any).referralCode ?? null;
      }

      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      // console.log('🧠 session callback triggered', { session, token }); // 调试用，可以保留或删除

      // 从 token 中获取数据，并将其添加到 session.user 中
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        // ✅ 关键：将 role 属性从 token 添加到 session.user
        session.user.role = token.role as UserRole; // 使用类型断言
        // ✅ 关键：将 credits 属性从 token 添加到 session.user
        session.user.credits = token.credits as number; // 使用类型断言

        // 添加其他您需要的属性
        session.user.phone = token.phone ?? null;
        session.user.referredBy = token.referredBy ?? null;
        session.user.referralCode = token.referralCode ?? null;
      }

      return session;
    },

    // 您的 signIn 和 redirect 回调保持不变
    async signIn({ user }) {
      // console.log('✅ signIn callback triggered', { user }); // 调试用，可以保留或删除

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email ?? undefined },
      });

      if (dbUser) {
        (user as any).phone = dbUser.phone ?? null;
        (user as any).referredBy = dbUser.referredBy ?? null;
        (user as any).referralCode = dbUser.referralCode ?? null;
        // 注意：signIn 回调中的 user 对象是临时的，不会持久化到 session 中
        // 我们需要在 jwt 回调中从 dbUser（通过 user 参数）获取 role 和 credits
        // 所以这里不需要将 role 和 credits 赋给 (user as any)
      }

      return true;
    },

    redirect({ url, baseUrl }) {
      // console.log('🚨 redirect callback triggered', { url, baseUrl }); // 调试用，可以保留或删除

      // 防止大小寫錯誤 fallback 到 login 頁
      if (url.toLowerCase().includes('/login')) {
        return baseUrl;
      }

      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
};

export default authOptions;
