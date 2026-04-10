/**
 * 入力バリデーション・サニタイズユーティリティ
 *
 * セキュリティ注意: 現在の認証方式（メールアドレスのみ / 店舗名のみ）は
 * パスワードやトークンによる認証がなく、本番環境では不十分です。
 * 将来的にJWT/セッションベースの認証を導入してください。
 */

/** メールアドレスの正規表現（RFC 5322 簡易版） */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** 日本の電話番号（ハイフンあり/なし、国際形式対応） */
const PHONE_REGEX = /^(?:\+81|0)\d{1,4}[-]?\d{1,4}[-]?\d{3,4}$/;

/** 日付形式 YYYY-MM-DD */
const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/** 時刻形式 HH:MM */
const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** UUID v4形式 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** HTMLタグを除去（XSS対策） */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/** HTMLエンティティを除去せず、危険なタグだけ削除 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254;
}

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.replace(/\s/g, ''));
}

export function isValidDate(date: string): boolean {
  return DATE_REGEX.test(date);
}

export function isValidTime(time: string): boolean {
  return TIME_REGEX.test(time);
}

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/** ID形式の検証（UUID or GAS生成のID） */
export function isValidId(id: string): boolean {
  // UUIDまたは英数字ハイフンアンダースコアのみ（1-128文字）
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id) || isValidUUID(id);
}

/** 文字列の長さチェック */
export function isWithinLength(value: string, maxLength: number): boolean {
  return value.length <= maxLength;
}

/** 予約ステータスの許可値 */
const VALID_BOOKING_STATUSES = new Set(['confirmed', 'cancelled', 'completed', 'pending', 'no_show']);

export function isValidBookingStatus(status: string): boolean {
  return VALID_BOOKING_STATUSES.has(status);
}

/** プロトタイプ汚染に使われる危険なキー */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** オブジェクトからプロトタイプ汚染用キーを除去する */
export function stripDangerousKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!DANGEROUS_KEYS.has(key)) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

/**
 * URLのSSRFバリデーション
 * - https:// のみ許可
 * - 内部IP / ローカルホスト / メタデータエンドポイントをブロック
 */
export function isValidExternalUrl(url: string): boolean {
  if (!url) return true; // 空文字はphoto_url未設定を意味するので許可
  // httpsのみ許可
  if (!url.startsWith('https://')) return false;
  if (url.length > 2048) return false;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // localhost / ループバック
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname === '[::1]') return false;

    // 内部IP範囲をブロック
    // 10.0.0.0/8
    if (/^10\./.test(hostname)) return false;
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    // 192.168.0.0/16
    if (/^192\.168\./.test(hostname)) return false;
    // 169.254.0.0/16 (AWS metadata等)
    if (/^169\.254\./.test(hostname)) return false;
    // 0.0.0.0
    if (hostname === '0.0.0.0') return false;

    // file:// scheme (URLコンストラクタで変換された場合)
    if (parsed.protocol !== 'https:') return false;

    return true;
  } catch {
    return false;
  }
}

/** business_hoursオブジェクトのバリデーション */
export function isValidBusinessHours(
  hours: Record<string, { open: string; close: string } | null>
): boolean {
  const validDays = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  for (const [day, value] of Object.entries(hours)) {
    if (!validDays.has(day.toLowerCase())) return false;
    if (value !== null) {
      if (typeof value !== 'object') return false;
      if (!isValidTime(value.open) || !isValidTime(value.close)) return false;
    }
  }
  return true;
}
