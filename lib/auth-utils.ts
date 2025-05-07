// lib/auth-utils.ts
import { parse } from 'cookie';

export function getTokenFromCookie(cookie: string): string | null {
  const parsed = parse(cookie);
  return parsed['session-token'] || null;
}
