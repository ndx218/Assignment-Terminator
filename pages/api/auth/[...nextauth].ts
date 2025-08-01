// /pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  /* Prisma Adapter */
  adapter: PrismaAdapter(prisma),

  /* OAuth Providers */
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
  ],

  /* JWT-based session */
  session: { strategy: 'jwt' },

  /* 把自訂欄位搬進 JWT，再回傳到 session */
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

  secret: process.env.NEXTAUTH_SECRET,
  debug : process.env.NODE_ENV !== 'production',
};

export default NextAuth(authOptions);
