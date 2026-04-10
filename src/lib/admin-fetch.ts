/**
 * 管理画面用のfetchラッパー
 * Cookie に admin_token を自動付与する
 */

const ADMIN_TOKEN_KEY = 'admin_token';

export function getAdminToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ADMIN_TOKEN_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setAdminToken(token: string): void {
  document.cookie = `${ADMIN_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function clearAdminToken(): void {
  document.cookie = `${ADMIN_TOKEN_KEY}=; path=/; max-age=0`;
}

export function isLoggedIn(): boolean {
  return !!getAdminToken();
}

export async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(options?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}
