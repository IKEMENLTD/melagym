import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';

/**
 * GET: 管理者セッション確認
 * HttpOnly cookieからログイン状態を返す
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  return NextResponse.json({ authenticated: auth.ok });
}
