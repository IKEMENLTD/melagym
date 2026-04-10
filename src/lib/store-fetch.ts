/**
 * 店舗管理画面用のfetchラッパー
 * HttpOnly cookie で store_id を管理する（XSS対策）
 * store_name は表示用のためlocalStorageに保存（セキュリティトークンではない）
 */

const STORE_NAME_KEY = 'store_name';

export function getStoreName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORE_NAME_KEY);
}

/**
 * ログイン成功後に表示用の店舗名を保存
 * store_id はサーバーがHttpOnly cookieに設定済み
 */
export function setStoreAuth(_storeId: string, storeName: string): void {
  localStorage.setItem(STORE_NAME_KEY, storeName);
}

export function clearStoreAuth(): void {
  localStorage.removeItem(STORE_NAME_KEY);
  // HttpOnly cookieの削除はサーバー側で行う
  fetch('/api/store/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
}

/**
 * セッション確認: サーバーにcookieを送って検証
 */
export async function checkStoreSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/store/session', { credentials: 'same-origin' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.authenticated === true;
  } catch {
    return false;
  }
}

export function isStoreLoggedIn(): boolean {
  // 簡易チェック: store_nameがあればログイン済みとみなす
  // 実際の認証はサーバー側のHttpOnly cookieで行われる
  return !!getStoreName();
}

/**
 * 認証付きfetchラッパー
 * HttpOnly cookieは credentials: 'same-origin' で自動送信される
 */
export async function storeFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'same-origin',
  });
}
