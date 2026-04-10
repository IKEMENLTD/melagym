/**
 * GAS Web App へのHTTPラッパー
 *
 * GASのウェブアプリは302リダイレクトを返す。
 * リダイレクト先はPOSTを受け付けない（405 Method Not Allowed）。
 * そのため、GETリクエストのクエリパラメータでデータを送信する。
 *
 * セキュリティ注意:
 * - APIキーはGETクエリパラメータに含まれる（GAS制約により不可避）
 * - HTTPS通信のため経路上では暗号化される
 * - サーバーサイド専用モジュールのため、ブラウザには露出しない
 * - サーバーログには残る可能性がある（GAS側のログ設定に注意）
 */

const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_API_URL ?? '';
const GAS_API_KEY = process.env.GAS_API_KEY ?? '';

// サーバーサイド専用モジュールであることを保証
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

export async function callGAS<T = Record<string, unknown>>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  if (!GAS_API_URL) {
    throw new Error('NEXT_PUBLIC_GAS_API_URL が設定されていません');
  }

  const controller = new AbortController();
  // タイムアウト: 30秒（GASの応答は通常5-15秒以内）
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const payload = JSON.stringify({ action, params, apiKey: GAS_API_KEY });

  try {
    // GETリクエストでデータを送信（POSTのリダイレクト問題を回避）
    const encodedPayload = encodeURIComponent(payload);
    const url = `${GAS_API_URL}?payload=${encodedPayload}`;

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
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
      const internalMessage = errData.error ?? `status ${json.statusCode}`;
      console.error(`GAS API error (${action}): ${internalMessage}`);
      throw new Error('バックエンドサービスでエラーが発生しました');
    }

    return json.data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
