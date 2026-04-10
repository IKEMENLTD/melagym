/**
 * 店舗管理画面用のfetchラッパー
 * Cookie に store_id / store_name を自動付与する
 */

const STORE_ID_KEY = 'store_id';
const STORE_NAME_KEY = 'store_name';

export function getStoreId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${STORE_ID_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getStoreName(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${STORE_NAME_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setStoreAuth(storeId: string, storeName: string): void {
  const maxAge = 60 * 60 * 24 * 30; // 30日
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${STORE_ID_KEY}=${encodeURIComponent(storeId)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  document.cookie = `${STORE_NAME_KEY}=${encodeURIComponent(storeName)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearStoreAuth(): void {
  document.cookie = `${STORE_ID_KEY}=; path=/; max-age=0`;
  document.cookie = `${STORE_NAME_KEY}=; path=/; max-age=0`;
}

export function isStoreLoggedIn(): boolean {
  return !!getStoreId();
}

export async function storeFetch(url: string, options?: RequestInit): Promise<Response> {
  const storeId = getStoreId();
  const headers = new Headers(options?.headers);
  if (storeId) {
    headers.set('X-Store-Id', storeId);
  }
  return fetch(url, { ...options, headers });
}
