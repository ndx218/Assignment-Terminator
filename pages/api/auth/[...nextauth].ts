// /pages/api/auth/[...nextauth].ts
import NextAuth, {
  type DefaultSession,
  type NextAuthOptions,
} from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

/* ────────── 型別擴充 ────────── */
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: DefaultSession['user'] & {
      id: string;
      role: 'ADMIN' | 'USER';
      credits: number;
    };
  }
  interface User {
    id: string;
    role: 'ADMIN' | 'USER';
    credits: number;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'ADMIN' | 'USER';
    credits: number;
  }
}

/* ────────── NextAuth 設定 ────────── */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    /** 把自訂欄位塞進 JWT */
    async jwt({ token, user }) {
      if (user) {
        token.id      = user.id;
        token.role    = (user as any).role;
        token.credits = (user as any).credits;
      }
      return token;
    },

    /** 再把欄位塞回 session，前端就能拿到 */
    async session({ session, token }) {
      if (session.user) {
        session.user.id      = token.id as string;
        session.user.role    = token.role as 'ADMIN' | 'USER';
        session.user.credits = token.credits as number;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug : process.env.NODE_ENV !== 'production',
};

export default NextAuth(authOptions);
