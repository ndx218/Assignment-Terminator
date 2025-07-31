// /pages/api/auth/[...nextauth].ts
import NextAuth, {
  type DefaultSession,
  type User as NextAuthUser,
  type JWT as NextAuthJWT,
  type NextAuthOptions,
} from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

/* ------------------------------------------------------------------ */
/** 型別擴充：讓 session.user / token / user 有 id, role, credits */
declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id?: string;
      role?: 'ADMIN' | 'USER';
      credits?: number;
    };
  }
  interface User extends NextAuthUser {
    role?: 'ADMIN' | 'USER';
    credits?: number;
  }
  interface JWT extends NextAuthJWT {
    id?: string;
    role?: 'ADMIN' | 'USER';
    credits?: number;
  }
}

/* ------------------------------------------------------------------ */
/** NextAuth 設定 */
export const authOptions: NextAuthOptions = {
  /* ===== Adapter (可依需求刪除) ===== */
  adapter: PrismaAdapter(prisma),

  /* ===== Providers ===== */
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
    // 👉 其他 provider 依需求加入
  ],

  /* ===== Session 使用 JWT ===== */
  session: { strategy: 'jwt' },

  /* ===== Callbacks ===== */
  callbacks: {
    /** 🔐 把自訂欄位存進 JWT */
    async jwt({ token, user }) {
      if (user) {
        token.id      = user.id;
        token.role    = user.role;
        token.credits = user.credits;
      }
      return token;
    },

    /** 💾 再把欄位塞回 session，前端就能拿到 */
    async session({ session, token }) {
      if (session.user) {
        session.user.id      = token.id as string | undefined;
        session.user.role    = token.role as 'ADMIN' | 'USER' | undefined;
        session.user.credits = token.credits as number | undefined;
      }
      return session;
    },

    /** ⛔ 範例：限制只有 email Verify 的人才能登入（沒有需要可刪） */
    // async signIn({ user }) {
    //   return !!user.emailVerified;
    // },
  },

  /* ===== 其他設定 ===== */
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,                         // 允許 *.vercel.app preview domain
  debug: process.env.NODE_ENV !== 'production',
};

export default NextAuth(authOptions);
