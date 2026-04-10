import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30日

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * POST: 管理者ログイン
 * トークンを検証し、HttpOnly cookieを設定する
 */
export async function POST(request: NextRequest) {
  if (!ADMIN_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'サーバー設定エラー' }, { status: 500 });
    }
    // 開発環境: トークン未設定でもログイン可
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_token', 'dev-token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    return response;
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 });
  }

  const token = body.token;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ success: false, error: 'トークンは必須です' }, { status: 400 });
  }

  if (!safeCompare(token, ADMIN_TOKEN)) {
    return NextResponse.json({ success: false, error: 'パスワードが正しくありません' }, { status: 401 });
  }

  const isSecure = request.url.startsWith('https');
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
