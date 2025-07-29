// /lib/auth.ts
import { getServerSession } from 'next-auth/next';
import type { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from '@/pages/api/auth/[...nextauth]'; // 確保這裡有具名匯出

/** Pages Router 的 API Route：一定要帶 req/res 才能解析 cookie */
export function getAuthSession(req: NextApiRequest, res: NextApiResponse) {
  return getServerSession(req, res, authOptions);
}

/** App Router（如有用到）才會用到這個無參數版本 */
export function getAuthSessionApp() {
  return getServerSession(authOptions);
}
