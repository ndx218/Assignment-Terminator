// /pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

/* ──────────────────────────────────────────── */
/* NextAuth 設定                                */
/* ──────────────────────────────────────────── */
export const authOptions: NextAuthOptions = {
  /* ----- Adapter（若用 Prisma） ----- */
  adapter: PrismaAdapter(prisma),

  /* ----- Providers ----- */
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
    // 其他 provider 需要再加
  ],

  /* ----- Session → JWT ----- */
  session: { strategy: 'jwt' },

  /* ----- Callbacks：把自訂欄位塞進 JWT，再回 Session ----- */
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id      = (user as any).id;
        token.role    = (user as any).role;
        token.credits = (user as any).credits;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id      = token.id;
        (session.user as any).role    = token.role;
        (session.user as any).credits = token.credits;
      }
      return session;
    },
  },

  /* ----- 其他 ----- */
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,                           // 允許 *.vercel.app preview domain
  debug: process.env.NODE_ENV !== 'production',
};

export default NextAuth(authOptions);
