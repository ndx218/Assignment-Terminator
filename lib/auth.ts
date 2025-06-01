// lib/auth.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/authOptions';

// 封裝 session 取得邏輯，其他 API route 可直接使用
export function getAuthSession() {
  return getServerSession(authOptions);
}

// ❌ 刪除下面這行 export，不要把 authOptions 暴露給前端
// export const authOptions = serverAuthOptions;
