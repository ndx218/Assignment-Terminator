import type { Session } from 'next-auth';
import type { NextAuthOptions } from 'next-auth/react';
import EmailProvider from 'next-auth/providers/email';
import type { JWT } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

// 型別擴充
declare module 'next-auth' {
  interface User {
    id: string;
    phone?: string | null;
    referredBy?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone?: string | null;
      referredBy?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    phone?: string | null;
    referredBy?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.phone = (user as any).phone ?? null;
        token.referredBy = (user as any).referredBy ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.phone = token.phone ?? null;
        session.user.referredBy = token.referredBy ?? null;
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
      }
      return true;
    },
  },
};
