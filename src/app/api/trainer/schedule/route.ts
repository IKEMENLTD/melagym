import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { isValidId } from '@/lib/validation';

interface TrainerBooking {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booking_type: string;
  customer_name: string;
  customer_phone: string;
  store_name: string;
  notes: string;
}

/**
 * GET: トレーナーIDで自分の予約一覧を取得
 *
 * セキュリティ警告: X-Trainer-Id ヘッダーはクライアントが自由に設定可能です。
 * 他のトレーナーのIDを指定すれば、その予約一覧を閲覧できます。
 * 本番環境ではJWT等のトークンベース認証に移行してください。
 */
export async function GET(request: NextRequest) {
  try {
    const trainerId = request.headers.get('X-Trainer-Id');

    if (!trainerId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ID形式検証（インジェクション対策）
    if (!isValidId(trainerId)) {
      return NextResponse.json(
        { error: '無効な認証情報です' },
        { status: 401 }
      );
    }

    const result = await callGAS<{ bookings: TrainerBooking[] }>(
      'getTrainerBookings',
      { trainer_id: trainerId }
    );

    return NextResponse.json({ bookings: result.bookings });
  } catch (error) {
    console.error('Failed to fetch trainer schedule:', error);
    return NextResponse.json(
      { error: 'スケジュールの取得に失敗しました' },
      { status: 500 }
    );
  }
}
