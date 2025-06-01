// lib/auth.ts
import { getServerSession } from 'next-auth';
import { authOptions as serverAuthOptions } from '@/server/authOptions';

// 封裝 session 取得邏輯，其他 API route 可直接使用
export function getAuthSession() {
  return getServerSession(serverAuthOptions);
}

// ✅ 重點：重新導出 authOptions 給其他地方用
export const authOptions = serverAuthOptions;
