import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { isValidDate, isValidBookingStatus } from '@/lib/validation';
import { verifyStoreSession } from '@/lib/store-session-verify';

interface StoreBooking {
  id: string;
  customer_name: string;
  trainer_name: string;
  scheduled_at: string;
  duration_minutes: number;
  booking_type: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface GetStoreBookingsResponse {
  bookings: StoreBooking[];
}

/**
 * GET: store_idでこの店舗の予約一覧を取得
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

    const { searchParams } = new URL(request.url);

    // クエリパラメータのバリデーション
    const dateParam = searchParams.get('date') ?? undefined;
    if (dateParam !== undefined && !isValidDate(dateParam)) {
      return NextResponse.json(
        { error: '日付の形式が正しくありません（YYYY-MM-DD）' },
        { status: 400 }
      );
    }

    const statusParam = searchParams.get('status') ?? undefined;
    if (statusParam !== undefined && !isValidBookingStatus(statusParam)) {
      return NextResponse.json(
        { error: '無効なステータスです' },
        { status: 400 }
      );
    }

    const result = await callGAS<GetStoreBookingsResponse>('getStoreBookings', {
      storeId,
      date: dateParam,
      status: statusParam,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch store bookings:', error);
    return NextResponse.json(
      { error: '予約一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}
