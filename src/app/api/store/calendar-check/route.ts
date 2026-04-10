import { NextRequest, NextResponse } from 'next/server';
import { verifyStoreSession } from '@/lib/store-session-verify';
import { callGAS } from '@/lib/sheets-api';
import { getFreeBusy } from '@/lib/google-calendar';

interface StoreWithCalendar {
  id: string;
  name: string;
  google_calendar_id: string;
  is_active: boolean;
}

interface CalendarCheckResult {
  ok: boolean;
  calendar_id_masked: string | null;
  error_detail?: string;
}

/**
 * GET: 店舗のGoogleカレンダー連携状態をテストする
 *
 * FreeBusy APIで今日のデータを取得し、サービスアカウントがアクセスできるか確認する。
 * - 成功: カレンダーにアクセスできる（共有設定が正しい）
 * - 失敗: カレンダーIDが未設定、またはサービスアカウントへの共有がされていない
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 店舗セッション検証
    const session = await verifyStoreSession(request);
    if (!session.ok) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status ?? 401 }
      );
    }

    const storeId = session.storeId;

    // 店舗情報を取得（google_calendar_idを含む）
    const storesResult = await callGAS<{ stores: StoreWithCalendar[] }>('getStores', {});
    const store = storesResult.stores.find((s) => s.id === storeId) ?? null;

    if (!store) {
      return NextResponse.json(
        { error: '店舗が見つかりません' },
        { status: 404 }
      );
    }

    const calendarId = store.google_calendar_id;

    // カレンダーIDが未設定の場合
    if (!calendarId) {
      const result: CalendarCheckResult = {
        ok: false,
        calendar_id_masked: null,
        error_detail: 'GoogleカレンダーIDが設定されていません。管理者にお問い合わせください。',
      };
      return NextResponse.json(result);
    }

    // FreeBusy APIで今日のデータを取得してアクセスできるか確認（JST基準）
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = jstNow.toISOString().split('T')[0];
    const timeMin = `${todayStr}T00:00:00+09:00`;
    const timeMax = `${todayStr}T23:59:59+09:00`;

    try {
      await getFreeBusy([calendarId], timeMin, timeMax);

      // 成功
      const maskedId = `${calendarId.slice(0, 8)}...${calendarId.slice(-20)}`;
      const result: CalendarCheckResult = {
        ok: true,
        calendar_id_masked: maskedId,
      };
      return NextResponse.json(result);
    } catch {
      // FreeBusy APIでエラー = アクセス権がない
      const maskedId = `${calendarId.slice(0, 8)}...${calendarId.slice(-20)}`;
      const result: CalendarCheckResult = {
        ok: false,
        calendar_id_masked: maskedId,
        error_detail:
          'カレンダーにアクセスできません。Googleカレンダーの共有設定でサービスアカウントに「予定の表示（すべての予定の詳細）」以上の権限を付与してください。',
      };
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Calendar check failed:', error);
    return NextResponse.json(
      { error: 'カレンダー連携の確認に失敗しました' },
      { status: 500 }
    );
  }
}
