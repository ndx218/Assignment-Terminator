// lib/auth-utils.ts
import { parse } from 'cookie';
import type { NextApiRequest } from 'next';

export function getTokenFromCookie(req: NextApiRequest): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;

  const parsed = parse(cookies);
  return parsed['session-token'] || null;
}
