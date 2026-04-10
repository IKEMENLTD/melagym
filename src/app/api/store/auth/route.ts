import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';

interface StoreData {
  id: string;
  name: string;
  area: string;
  address: string;
  google_calendar_id: string;
  business_hours: Record<string, { open: string; close: string } | null>;
  is_active: boolean;
}

interface GetStoresResponse {
  stores: StoreData[];
}

/**
 * POST: 店舗名で店舗を照合してログイン
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { storeName?: string };
    const storeName = body.storeName;

    if (!storeName || typeof storeName !== 'string') {
      return NextResponse.json(
        { error: '店舗名を指定してください' },
        { status: 400 }
      );
    }

    // GASからstoreByNameで検索
    const result = await callGAS<{ store: StoreData | null }>('getStoreByName', {
      name: storeName,
    });

    if (!result.store) {
      return NextResponse.json(
        { error: '該当する店舗が見つかりません' },
        { status: 404 }
      );
    }

    if (!result.store.is_active) {
      return NextResponse.json(
        { error: 'この店舗は現在無効です' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      store: {
        id: result.store.id,
        name: result.store.name,
        area: result.store.area,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '認証処理でエラーが発生しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET: アクティブな店舗一覧を取得（ログイン画面のプルダウン用）
 */
export async function GET(): Promise<NextResponse> {
  try {
    const result = await callGAS<GetStoresResponse>('getStores', { activeOnly: true });
    const storeNames = result.stores.map((s) => ({
      id: s.id,
      name: s.name,
    }));
    return NextResponse.json({ stores: storeNames });
  } catch (err) {
    const message = err instanceof Error ? err.message : '店舗一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
