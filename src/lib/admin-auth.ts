import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

/**
 * タイミング攻撃を防ぐ定数時間の文字列比較
 * 両方の文字列をUTF-8バイト列に変換し、長さが異なる場合でも一定時間で比較する
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    // 長さが異なる場合でもタイミングを一定にするためダミー比較を行う
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * 管理画面APIの簡易認証チェック
 * Authorization: Bearer <token> または Cookie: admin_token=<token> を検証
 * ADMIN_API_TOKEN 環境変数が未設定の場合は認証をスキップ（開発環境向け）
 */
export function verifyAdminAuth(request: NextRequest): { ok: boolean; error?: string } {
  // skip auth only in development when ADMIN_API_TOKEN is not set
  if (!ADMIN_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, error: 'サーバー設定エラー' };
    }
    return { ok: true };
  }

  // Authorization ヘッダーチェック
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token.length > 0 && safeCompare(token, ADMIN_TOKEN)) {
      return { ok: true };
    }
  }

  // Cookie チェック
  const cookieToken = request.cookies.get('admin_token')?.value;
  if (cookieToken && cookieToken.length > 0 && safeCompare(cookieToken, ADMIN_TOKEN)) {
    return { ok: true };
  }

  return { ok: false, error: '認証が必要です' };
}
