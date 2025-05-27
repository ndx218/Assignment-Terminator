// types/next-auth.d.ts
import NextAuth from 'next-auth';
import type { DefaultSession } from 'next-auth';

// 首先定义您的用户角色枚举，与 Prisma schema 中的 UserRole 保持一致
// 假设您的 Prisma enum 是：
// enum UserRole {
//   USER
//   ADMIN
// }
export type UserRole = 'USER' | 'ADMIN';

declare module 'next-auth' {
  /**
   * 扩展 NextAuth 的 User 接口，以包含自定义属性。
   */
  interface User {
    id: string;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
    credits?: number;
    role?: UserRole; // ✅ 新增：添加 role 属性
  }

  /**
   * 扩展 NextAuth 的 Session 接口，以包含自定义属性。
   */
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone?: string | null;
      referredBy?: string | null;
      referralCode?: string | null;
      credits?: number;
      role?: UserRole; // ✅ 新增：添加 role 属性
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  /**
   * 扩展 NextAuth 的 JWT 接口，以包含自定义属性。
   */
  interface JWT {
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
    credits?: number;
    role?: UserRole; // ✅ 新增：添加 role 属性
  }
}
