/**
 * トレーナー画面用のfetchラッパー
 * Cookie に trainer_email / trainer_id / trainer_name を自動付与する
 */

const TRAINER_EMAIL_KEY = 'trainer_email';
const TRAINER_ID_KEY = 'trainer_id';
const TRAINER_NAME_KEY = 'trainer_name';

export interface TrainerSession {
  email: string;
  id: string;
  name: string;
}

export function getTrainerSession(): TrainerSession | null {
  if (typeof document === 'undefined') return null;
  const email = getCookieValue(TRAINER_EMAIL_KEY);
  const id = getCookieValue(TRAINER_ID_KEY);
  const name = getCookieValue(TRAINER_NAME_KEY);
  if (!email || !id) return null;
  return { email, id, name: name ?? '' };
}

export function setTrainerSession(session: TrainerSession): void {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  setCookie(TRAINER_EMAIL_KEY, session.email, maxAge);
  setCookie(TRAINER_ID_KEY, session.id, maxAge);
  setCookie(TRAINER_NAME_KEY, session.name, maxAge);
}

export function clearTrainerSession(): void {
  setCookie(TRAINER_EMAIL_KEY, '', 0);
  setCookie(TRAINER_ID_KEY, '', 0);
  setCookie(TRAINER_NAME_KEY, '', 0);
}

export function isTrainerLoggedIn(): boolean {
  return !!getTrainerSession();
}

export async function trainerFetch(url: string, options?: RequestInit): Promise<Response> {
  const session = getTrainerSession();
  const headers = new Headers(options?.headers);
  if (session) {
    headers.set('X-Trainer-Email', session.email);
    headers.set('X-Trainer-Id', session.id);
  }
  return fetch(url, { ...options, headers });
}

function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
