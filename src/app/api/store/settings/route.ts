import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';

interface StoreDetail {
  id: string;
  name: string;
  area: string;
  address: string;
  google_calendar_id: string;
  business_hours: Record<string, { open: string; close: string } | null>;
  is_active: boolean;
}

interface GetStoreByNameResponse {
  store: StoreDetail | null;
}

interface TrainerInfo {
  id: string;
  name: string;
  photo_url: string | null;
  specialties: string[];
  is_first_visit_eligible: boolean;
}

interface GetTrainersResponse {
  trainers: TrainerInfo[];
}

/**
 * GET: store_idで店舗情報を取得（トレーナー一覧含む）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const storeId = request.headers.get('X-Store-Id');
    if (!storeId) {
      return NextResponse.json(
        { error: '店舗認証が必要です' },
        { status: 401 }
      );
    }

    // 店舗一覧から該当店舗を取得
    const storesResult = await callGAS<{ stores: StoreDetail[] }>('getStores', {});
    const store = storesResult.stores.find((s) => s.id === storeId) ?? null;

    if (!store) {
      return NextResponse.json(
        { error: '店舗が見つかりません' },
        { status: 404 }
      );
    }

    // この店舗のトレーナー一覧を取得
    const trainersResult = await callGAS<GetTrainersResponse>('getTrainers', {
      storeId,
    });

    return NextResponse.json({
      store,
      trainers: trainersResult.trainers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '店舗情報の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH: 営業時間等の店舗設定を更新
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const storeId = request.headers.get('X-Store-Id');
    if (!storeId) {
      return NextResponse.json(
        { error: '店舗認証が必要です' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      business_hours?: Record<string, { open: string; close: string } | null>;
    };

    const updates: Record<string, unknown> = {};
    if (body.business_hours !== undefined) {
      updates.business_hours = body.business_hours;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '更新する項目がありません' },
        { status: 400 }
      );
    }

    const result = await callGAS<{ success: boolean }>('updateStore', {
      id: storeId,
      updates,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: '店舗設定の更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '店舗設定の更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
