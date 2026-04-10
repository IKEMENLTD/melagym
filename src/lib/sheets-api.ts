/**
 * GAS Web App へのHTTPラッパー
 *
 * 全てのデータアクセスはこのモジュール経由で行う。
 * GAS側の doPost(e) がアクションに応じて振り分ける。
 */

const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_API_URL ?? '';
const GAS_API_KEY = process.env.GAS_API_KEY ?? '';

// サーバーサイド専用モジュールであることを保証
// NEXT_PUBLIC_ プレフィックスのないGAS_API_KEYがクライアントに漏洩するのを防ぐ
if (typeof window !== 'undefined') {
  throw new Error('sheets-api はサーバーサイドでのみ使用できます');
}

interface GASResponse<T> {
  statusCode: number;
  data: T;
}

interface GASErrorData {
  error: string;
}

/**
 * GAS Web Appにリクエストを送信する汎用ラッパー
 *
 * GASの doPost は常にHTTP 200を返すため、
 * レスポンスbody内の statusCode で成否を判定する。
 */
export async function callGAS<T = Record<string, unknown>>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  if (!GAS_API_URL) {
    throw new Error('NEXT_PUBLIC_GAS_API_URL が設定されていません');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分タイムアウト

  try {
    const res = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params, apiKey: GAS_API_KEY }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`GAS API HTTP error: ${res.status}`);
    }

    let json: GASResponse<T | GASErrorData>;
    try {
      json = (await res.json()) as GASResponse<T | GASErrorData>;
    } catch {
      throw new Error('GAS APIのレスポンスが不正なJSON形式です');
    }

    if (
      json === null ||
      typeof json !== 'object' ||
      typeof json.statusCode !== 'number' ||
      !('data' in json)
    ) {
      throw new Error('GAS APIのレスポンス構造が不正です');
    }

    if (json.statusCode >= 400) {
      const errData = json.data as GASErrorData;
      throw new Error(errData.error ?? `GAS API error: status ${json.statusCode}`);
    }

    return json.data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
