// /pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from 'next-auth';
// ...providers, callbacks 等

export const authOptions: NextAuthOptions = {
  providers: [/* 你原本的 providers */],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      // 若你有 role / credits，要在這裡塞回 token（user 只在登入當下有值）
      if (user) {
        token.role = (user as any).role;
        token.credits = (user as any).credits;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).credits = token.credits;
      }
      return session;
    },
    // 其他 callbacks 照舊
  },
  // 其他設定照舊
};

export default NextAuth(authOptions);
