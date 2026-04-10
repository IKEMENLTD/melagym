import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';

interface TrainerBooking {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booking_type: string;
  customer_name: string;
  store_name: string;
  notes: string;
}

/**
 * GET: トレーナーIDで自分の予約一覧を取得
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
