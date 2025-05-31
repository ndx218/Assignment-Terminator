// types/next-auth.d.ts
import NextAuth, { DefaultSession } from 'next-auth';

export type UserRole = 'USER' | 'ADMIN';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      phone?: string | null;
      referredBy?: string | null;
      referralCode?: string | null;
      credits?: number;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
    credits?: number;
    role: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
    credits?: number;
    role: UserRole;
  }
}
