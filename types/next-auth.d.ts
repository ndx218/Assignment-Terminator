// types/next-auth.d.ts
import NextAuth from 'next-auth';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
    credits?: number; // ✅ 已納入點數屬性
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone?: string | null;
      referredBy?: string | null;
      referralCode?: string | null;
      credits?: number; // ✅ 已納入點數屬性
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
    credits?: number; // ✅ 已納入點數屬性
  }
}
