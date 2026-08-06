import { NextResponse } from 'next/server';
import { SITE_AUTH_COOKIE, hashSitePassword } from '@/lib/siteAuth';

export async function POST(request) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.json({ error: 'SITE_PASSWORD chua duoc cau hinh tren server.' }, { status: 500 });
  }

  const { password } = await request.json().catch(() => ({}));
  if (password !== sitePassword) {
    return NextResponse.json({ error: 'Sai mat khau.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SITE_AUTH_COOKIE, await hashSitePassword(sitePassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 ngay
  });
  return res;
}
