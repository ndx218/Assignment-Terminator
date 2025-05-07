// types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;      email?: string | null;
      image?: string | null;
      phone?: string | null;
      referredBy?: string | null;
      referralCode?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
  }
}
