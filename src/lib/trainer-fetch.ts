/**
 * トレーナー画面用のfetchラッパー
 * HttpOnly cookie で trainer_id / trainer_email を管理する（XSS対策）
 * trainer_name は表示用のためlocalStorageに保存
 */

const TRAINER_NAME_KEY = 'trainer_name';

export interface TrainerSession {
  email: string;
  id: string;
  name: string;
}

export function getTrainerSession(): TrainerSession | null {
  if (typeof window === 'undefined') return null;
  const name = localStorage.getItem(TRAINER_NAME_KEY);
  // HttpOnly cookieはJSから読めないため、nameの存在でセッション有無を簡易判定
  // 実際の認証はサーバー側のcookieで行われる
  if (!name) return null;
  return { email: '', id: '', name };
}

/**
 * ログイン成功後に表示用のトレーナー名を保存
 * trainer_id, trainer_email はサーバーがHttpOnly cookieに設定済み
 */
export function setTrainerSession(session: TrainerSession): void {
  localStorage.setItem(TRAINER_NAME_KEY, session.name);
}

export function clearTrainerSession(): void {
  localStorage.removeItem(TRAINER_NAME_KEY);
  // HttpOnly cookieの削除はサーバー側で行う
  fetch('/api/trainer/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
}

export function isTrainerLoggedIn(): boolean {
  return !!getTrainerSession();
}

/**
 * 認証付きfetchラッパー
 * HttpOnly cookieは credentials: 'same-origin' で自動送信される
 */
export async function trainerFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'same-origin',
  });
}
