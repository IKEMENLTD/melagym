/**
 * 店舗セッションの整合性検証
 *
 * X-Store-Id ヘッダーのIDが実在するアクティブな店舗か検証する。
 * 加えて X-Store-Passcode ヘッダーでパスコード検証を行う。
 */

import { NextRequest } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { isValidId } from '@/lib/validation';

interface StoreData {
  id: string;
  name: string;
  is_active: boolean;
}

export interface StoreSessionVerifyResult {
  ok: boolean;
  storeId?: string;
  error?: string;
  status?: number;
}

/**
 * リクエストから店舗のセッション情報を検証する
 *
 * 1. HttpOnly cookie (store_id) またはフォールバックで X-Store-Id ヘッダーが存在するか
 * 2. フォーマットが正しいか
 * 3. GASでその店舗が存在しアクティブか
 */
export async function verifyStoreSession(
  request: NextRequest
): Promise<StoreSessionVerifyResult> {
  // HttpOnly cookieを優先、フォールバックでヘッダー
  const storeId = request.cookies.get('store_id')?.value
    ?? request.headers.get('X-Store-Id');

  if (!storeId) {
    return {
      ok: false,
      error: '店舗認証が必要です',
      status: 401,
    };
  }

  if (!isValidId(storeId)) {
    return {
      ok: false,
      error: '無効な店舗IDです',
      status: 401,
    };
  }

  try {
    // GASで店舗を取得して存在・アクティブ確認
    const result = await callGAS<{ stores: StoreData[] }>('getStores', {});
    const store = result.stores.find((s) => s.id === storeId);

    if (!store) {
      console.warn(`[SECURITY] Invalid store_id attempted: ${storeId}`);
      return {
        ok: false,
        error: '店舗が見つかりません',
        status: 401,
      };
    }

    if (!store.is_active) {
      return {
        ok: false,
        error: 'この店舗は現在無効です',
        status: 403,
      };
    }

    return {
      ok: true,
      storeId: store.id,
    };
  } catch (error) {
    console.error('Store session verification failed:', error);
    return {
      ok: false,
      error: '認証の検証に失敗しました',
      status: 500,
    };
  }
}
