import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { isValidBusinessHours, stripDangerousKeys } from '@/lib/validation';
import { verifyStoreSession } from '@/lib/store-session-verify';

interface StoreDetail {
  id: string;
  name: string;
  area: string;
  address: string;
  google_calendar_id: string;
  business_hours: Record<string, { open: string; close: string } | null>;
  is_active: boolean;
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
 *
 * セッション検証強化: X-Store-Id が実在するアクティブな店舗か GAS で検証する。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 店舗セッション検証 (実在するアクティブな店舗か確認)
    const session = await verifyStoreSession(request);
    if (!session.ok) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status ?? 401 }
      );
    }

    const storeId = session.storeId;

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

    // セキュリティ: google_calendar_id の生値をクライアントに返さない
    // 連携状態と一部マスクした表示用文字列のみ返す
    const calId = store.google_calendar_id;
    const safeStore = {
      id: store.id,
      name: store.name,
      area: store.area,
      address: store.address,
      business_hours: store.business_hours,
      is_active: store.is_active,
      has_calendar_linked: !!calId,
      calendar_id_masked: calId
        ? `${calId.slice(0, 8)}...${calId.slice(-20)}`
        : null,
    };

    return NextResponse.json({
      store: safeStore,
      trainers: trainersResult.trainers,
    });
  } catch (error) {
    console.error('Failed to fetch store settings:', error);
    return NextResponse.json(
      { error: '店舗情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: 営業時間等の店舗設定を更新
 *
 * セッション検証強化: X-Store-Id が実在するアクティブな店舗か GAS で検証する。
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // 店舗セッション検証 (実在するアクティブな店舗か確認)
    const session = await verifyStoreSession(request);
    if (!session.ok) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status ?? 401 }
      );
    }

    const storeId = session.storeId;

    const rawBody = await request.json();
    // プロトタイプ��染対策
    const body = stripDangerousKeys(rawBody as Record<string, unknown>) as {
      business_hours?: Record<string, { open: string; close: string } | null>;
    };

    const updates: Record<string, unknown> = {};
    if (body.business_hours !== undefined) {
      // business_hours の値を検証
      if (typeof body.business_hours !== 'object' || body.business_hours === null) {
        return NextResponse.json(
          { error: '営業時間はオブジェクトで指定してください' },
          { status: 400 }
        );
      }
      if (!isValidBusinessHours(body.business_hours)) {
        return NextResponse.json(
          { error: '営業時間の形式が正しくありません。曜日名（英語小文字）とHH:MM形式の時刻を指定してください' },
          { status: 400 }
        );
      }
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
  } catch (error) {
    console.error('Failed to update store settings:', error);
    return NextResponse.json(
      { error: '店舗設定の更新に失敗しました' },
      { status: 500 }
    );
  }
}
