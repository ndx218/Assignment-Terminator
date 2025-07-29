// /lib/auth.ts
import 'server-only'; // 防止被客戶端引入
import { getServerSession } from 'next-auth/next';
import type { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

/** 在 Pages API Route 內使用（必須傳 req/res） */
export function getAuthSession(req: NextApiRequest, res: NextApiResponse) {
  return getServerSession(req, res, authOptions);
}

/** 在 App Router (server component / route handlers) 可用這個 */
export function getAuthSessionApp() {
  return getServerSession(authOptions);
}
