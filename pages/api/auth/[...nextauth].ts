// /pages/api/auth/[...nextauth].ts
import NextAuth, { type DefaultSession, type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';   // ← 依實際 provider
// ... 其他 provider

/* ------------------------------------------------------------------ */
/** 1) 擴充型別：讓 session.user 有 role / credits 不再紅線 */
declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      role?: 'ADMIN' | 'USER';
      credits?: number;
    };
  }
  interface User {
    role?: 'ADMIN' | 'USER';
    credits?: number;
  }
  interface JWT {
    role?: 'ADMIN' | 'USER';
    credits?: number;
  }
}

/* ------------------------------------------------------------------ */
export const authOptions: NextAuthOptions = {
  /** 2) provider 照舊 */
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
    // … 其他 provider
  ],

  /** 3) 全站改 JWT strategy 最簡單 */
  session: { strategy: 'jwt' },

  /** 4) callbacks：把 role / credits 寫進 JWT，再回 Session */
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role    = user.role;
        token.credits = user.credits;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role    = token.role;
        session.user.credits = token.credits;
      }
      return session;
    },
  },

  /** 5) 避免 Preview 網域驗簽失敗 */
  trustHost: true,                       // ← NextAuth v4.24+ 有提供
  secret: process.env.NEXTAUTH_SECRET,   // ← 必填
  debug : process.env.NODE_ENV !== 'production',
};

export default NextAuth(authOptions);
