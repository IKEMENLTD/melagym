/**
 * 管理画面用のfetchラッパー
 * HttpOnly cookie で認証を管理する（XSS対策）
 * トークンはJavaScriptから直接アクセスできない
 */

/**
 * サーバー側でセッション状態を確認する
 * HttpOnly cookieは自動送信されるため、JSから直接読む必要がない
 */
export async function checkAdminSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.authenticated === true;
  } catch {
    return false;
  }
}

/**
 * ログイン: サーバーがHttpOnly cookieを設定する
 */
export async function adminLogin(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'same-origin',
    });
    const data = await res.json();
    return data;
  } catch {
    return { success: false, error: 'ログイン処理に失敗しました' };
  }
}

/**
 * ログアウト: サーバーがHttpOnly cookieを削除する
 */
export async function adminLogout(): Promise<void> {
  await fetch('/api/admin/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

/**
 * 認証付きfetchラッパー
 * HttpOnly cookieは credentials: 'same-origin' で自動送信される
 */
export async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'same-origin',
  });
}
