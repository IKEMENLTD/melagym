import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';

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

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') ?? undefined;
    const status = searchParams.get('status') ?? undefined;

    const result = await callGAS<GetStoreBookingsResponse>('getStoreBookings', {
      storeId,
      date,
      status,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '予約一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
