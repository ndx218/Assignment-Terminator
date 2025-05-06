// lib/auth-utils.ts
import { parse } from 'cookie';

/**
 * 從 Cookie Header 中提取 session-token
 */
export function getTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  return cookies['session-token'] || null;
}
