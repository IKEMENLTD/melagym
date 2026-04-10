import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { isValidId, isValidBusinessHours } from '@/lib/validation';

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
 * セキュリティ警告: X-Store-Id ヘッダーはクライアントが自由に設定可能です。
 * 他店舗のIDを指定すれば、その店舗情報・トレーナー一覧を閲覧できます。
 * 本番環境ではJWT等のトークンベース認証に移行してください。
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

    // ID形式検証（インジェクション対策）
    if (!isValidId(storeId)) {
      return NextResponse.json(
        { error: '無効な店舗IDです' },
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
 * セキュリティ警告: X-Store-Id ヘッダーはクライアントが自由に設定可能です。
 * 他店舗のIDを指定すれば、その店舗の営業時間を変更できます。
 * 本番環境ではJWT等のトークンベース認証に移行してください。
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

    // ID形式検証（インジェクション対策）
    if (!isValidId(storeId)) {
      return NextResponse.json(
        { error: '無効な店舗IDです' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
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
