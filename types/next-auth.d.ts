// types/next-auth.d.ts

declare module "next-auth" {
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
  }
}
