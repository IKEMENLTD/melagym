import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';

/**
 * POST: 管理者トークンの検証
 * ログイン時にクライアント側でトークンが正しいかサーバー側で確認する
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ valid: false, error: auth.error }, { status: 401 });
  }
  return NextResponse.json({ valid: true });
}
