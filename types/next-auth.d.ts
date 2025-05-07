// types/next-auth.d.ts
import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null; // ✅ 加這行
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone?: string | null;
      referredBy?: string | null;
      referralCode?: string | null; // ✅ 加這行
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null; // ✅ 加這行
  }
}
