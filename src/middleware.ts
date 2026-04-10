import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  getClientIp,
  findRateLimitConfig,
} from '@/lib/rate-limit';

/**
 * Next.js Middleware
 *
 * 全APIルートに対して以下のセキュリティチェックを実行:
 * 1. Originヘッダー検証 (CSRF対策)
 * 2. IPベースのレート制限
 */

/** 許可するOriginのリスト (環境変数から取得、カンマ区切り) */
function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // 環境変数から明示的に許可するオリジンを追加
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    for (const origin of envOrigins.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  // Vercelの自動デプロイURLを許可
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    origins.add(`https://${vercelUrl}`);
  }

  // Netlifyの自動デプロイURLを許可
  const netlifyUrl = process.env.URL;
  if (netlifyUrl) {
    origins.add(netlifyUrl);
  }

  return origins;
}

/**
 * Originヘッダーを検証する
 * - GETリクエストはOriginチェックをスキップ (ブラウザがOriginを付けないケースがある)
 * - 状態変更メソッド (POST/PATCH/PUT/DELETE) のみ検証
 */
function isOriginAllowed(request: NextRequest): boolean {
  const method = request.method.toUpperCase();

  // GETとHEADはOriginチェック不要
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const origin = request.headers.get('origin');

  // Originヘッダーがない場合:
  // - サーバー間通信やcurl等ではOriginが付かない
  // - ブラウザからのfetch/XHRでは通常付く
  // 開発環境では許可、本番では厳格にチェック
  if (!origin) {
    return process.env.NODE_ENV !== 'production';
  }

  const allowedOrigins = getAllowedOrigins();

  // 許可リストに含まれているか
  if (allowedOrigins.has(origin)) {
    return true;
  }

  // 開発環境ではlocalhostを許可
  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return true;
      }
    } catch {
      // 不正なOriginの場合はfalse
    }
  }

  return false;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // APIルート以外はスルー
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // --- 1. Originヘッダー検証 (CSRF対策) ---
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { error: '不正なリクエスト元です' },
      { status: 403 }
    );
  }

  // --- 2. レート制限 ---
  const clientIp = getClientIp(request.headers);
  const method = request.method.toUpperCase();
  const config = findRateLimitConfig(pathname, method);
  const identifier = `${clientIp}:${pathname}:${method}`;

  const result = checkRateLimit(identifier, config);

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'リクエスト回数の上限に達しました。しばらくしてからお試しください。' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  // レート制限情報をレスポンスヘッダーに付与
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  return response;
}

/**
 * ミドルウェアの適用範囲
 * /api/ 配下の全ルートに適用
 */
export const config = {
  matcher: '/api/:path*',
};
