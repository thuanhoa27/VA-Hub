import { NextResponse } from 'next/server';
import { SITE_AUTH_COOKIE, hashSitePassword } from '@/lib/siteAuth';

/**
 * Cong mat khau don gian cho toan app (khong phai auth that su).
 * Xem README.md muc Bao mat truoc khi doi/go bo.
 */
export async function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next(); // chua cau hinh -> khong chan gi

  const cookie = request.cookies.get(SITE_AUTH_COOKIE)?.value;
  const expected = await hashSitePassword(password);
  if (cookie === expected) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!api/login|login|_next/static|_next/image|favicon.ico).*)'],
};
