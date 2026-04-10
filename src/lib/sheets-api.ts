/**
 * GAS Web App へのHTTPラッパー
 *
 * GASのウェブアプリは302リダイレクトを返す。
 * Node.jsのfetchはデフォルトで302時にPOST→GETに変換するため、
 * redirect:'manual'で受け取り、リダイレクト先に手動でPOSTし直す。
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
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  const body = JSON.stringify({ action, params, apiKey: GAS_API_KEY });

  try {
    // Step 1: GASにPOST（redirect:manualで302を手動処理）
    const initialRes = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
      redirect: 'manual',
    });

    let res: Response;

    if (initialRes.status === 302 || initialRes.status === 301) {
      // Step 2: リダイレクト先にPOSTし直す（GETに変換されないように）
      const redirectUrl = initialRes.headers.get('location');
      if (!redirectUrl) {
        throw new Error('リダイレクトURLが取得できません');
      }
      res = await fetch(redirectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
    } else {
      res = initialRes;
    }

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
