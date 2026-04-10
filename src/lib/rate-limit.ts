/**
 * インメモリ レート制限ユーティリティ
 *
 * Vercel Serverless環境ではインスタンス間でメモリが共有されないため、
 * 完全な防御にはならないが、同一インスタンスへの連続アクセスは制限できる。
 * 本格的なレート制限にはRedis/Upstash等の外部ストアを推奨。
 *
 * LRU的なクリーンアップ: エントリ数がMAX_ENTRIESを超えたら期限切れを一掃する。
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp (ms)
}

interface RateLimitConfig {
  /** ウィンドウ内の最大リクエスト数 */
  maxRequests: number;
  /** ウィンドウのミリ秒 */
  windowMs: number;
}

/** 各ルートパターンごとの設定 */
export interface RateLimitRule {
  /** URLパスのパターン (完全一致 or startsWith) */
  pattern: string;
  /** HTTPメソッド (省略時は全メソッド) */
  method?: string;
  config: RateLimitConfig;
}

const MAX_ENTRIES = 10000;

// ルートパターン + IPをキーとしたMap
const store = new Map<string, RateLimitEntry>();

/**
 * 期限切れエントリの一括削除
 * エントリ数がMAX_ENTRIESを超えた場合に実行
 */
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * レート制限チェック
 *
 * @param identifier - 識別子 (通常はIPアドレス + ルートパターン)
 * @param config - レート制限設定
 * @returns チェック結果
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(identifier);

  // エントリ数超過時にクリーンアップ
  if (store.size > MAX_ENTRIES) {
    cleanup();
  }

  if (!existing || existing.resetAt <= now) {
    // 新規ウィンドウ開始
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(identifier, entry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
      limit: config.maxRequests,
    };
  }

  // 既存ウィンドウ内
  existing.count += 1;

  if (existing.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      limit: config.maxRequests,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetAt: existing.resetAt,
    limit: config.maxRequests,
  };
}

/**
 * IPアドレスをリクエストヘッダーから取得
 * Vercel/Cloudflare等のプロキシ環境に対応
 */
export function getClientIp(headers: Headers): string {
  // Vercel
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // 最初のIPがクライアントIP (プロキシチェーンの先頭)
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  // Cloudflare
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  // X-Real-IP (nginx等)
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp;

  return 'unknown';
}

/**
 * 事前定義されたレート制限ルール
 */
export const RATE_LIMIT_RULES: RateLimitRule[] = [
  // 管理者トークン検証: ブルートフォース対策 (1分間に5回)
  {
    pattern: '/api/admin/verify',
    method: 'POST',
    config: { maxRequests: 5, windowMs: 60_000 },
  },
  // 予約作成: DoS対策 (1分間に3回)
  {
    pattern: '/api/booking',
    method: 'POST',
    config: { maxRequests: 3, windowMs: 60_000 },
  },
  // トレーナー新規登録: スパム対策 (1時間に5回)
  {
    pattern: '/api/trainer/register',
    method: 'POST',
    config: { maxRequests: 5, windowMs: 3_600_000 },
  },
  // トレーナー認証: ブルートフォース対策 (1分間に10回)
  {
    pattern: '/api/trainer/auth',
    method: 'POST',
    config: { maxRequests: 10, windowMs: 60_000 },
  },
  // 店舗認証: ブルートフォース対策 (1分間に10回)
  {
    pattern: '/api/store/auth',
    method: 'POST',
    config: { maxRequests: 10, windowMs: 60_000 },
  },
];

/** デフォルトルール: その他のAPIエンドポイント (1分間に30回) */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000,
};

/**
 * パスとメソッドに対応するレート制限設定を返す
 */
export function findRateLimitConfig(
  pathname: string,
  method: string
): RateLimitConfig {
  for (const rule of RATE_LIMIT_RULES) {
    const pathMatch = pathname === rule.pattern || pathname.startsWith(rule.pattern + '/');
    const methodMatch = !rule.method || rule.method.toUpperCase() === method.toUpperCase();
    if (pathMatch && methodMatch) {
      return rule.config;
    }
  }
  return DEFAULT_RATE_LIMIT;
}
