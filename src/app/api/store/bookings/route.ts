import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { isValidId, isValidDate, isValidBookingStatus } from '@/lib/validation';

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
 * セキュリティ警告: X-Store-Id ヘッダーはクライアントが自由に設定可能です。
 * 他店舗のIDを指定すれば、その予約一覧（顧客名等の個人情報を含む）を閲覧できます。
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
