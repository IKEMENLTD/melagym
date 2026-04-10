import { NextResponse } from 'next/server';

/**
 * POST: 管理者ログアウト
 * HttpOnly cookieを削除する
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
