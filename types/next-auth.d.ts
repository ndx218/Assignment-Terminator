// ✅ types/next-auth.d.ts
import NextAuth from 'next-auth';

// 擴展 next-auth 中的 User 和 Session 型別
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

// 擴展 JWT token 型別
declare module 'next-auth/jwt' {
  interface JWT {
    phone?: string | null;
    referredBy?: string | null;
  }
}
