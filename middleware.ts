import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const protectedPaths = ['/admin', '/recharge'];
  const isProtected = protectedPaths.some((path) => req.nextUrl.pathname.startsWith(path));

  if (isProtected && !token) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/recharge/:path*'], // 保護這些路徑
};
