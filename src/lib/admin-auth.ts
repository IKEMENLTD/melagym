import { NextRequest } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

/**
 * 管理画面APIの簡易認証チェック
 * Authorization: Bearer <token> または Cookie: admin_token=<token> を検証
 * ADMIN_API_TOKEN 環境変数が未設定の場合は認証をスキップ（開発環境向け）
 */
export function verifyAdminAuth(request: NextRequest): { ok: boolean; error?: string } {
  // skip auth only in development when ADMIN_API_TOKEN is not set
  if (!ADMIN_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, error: 'ADMIN_API_TOKEN is not configured' };
    }
    return { ok: true };
  }

  // Authorization ヘッダーチェック
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === ADMIN_TOKEN) {
      return { ok: true };
    }
  }

  // Cookie チェック
  const cookieToken = request.cookies.get('admin_token')?.value;
  if (cookieToken === ADMIN_TOKEN) {
    return { ok: true };
  }

  return { ok: false, error: '認証が必要です' };
}
