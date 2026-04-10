import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { verifyTrainerSession } from '@/lib/trainer-session-verify';

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
 * GET: トレーナーの予約一覧を取得
 *
 * セッション整合性チェック: X-Trainer-Id と X-Trainer-Email の両方を検証し、
 * GASでIDとEmailが一致するか確認することで、他人のスケジュール閲覧を防止する。
 */
export async function GET(request: NextRequest) {
  try {
    // セッション整合性チェック (ID + Email の一致を検証)
    const session = await verifyTrainerSession(request);
    if (!session.ok) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status ?? 401 }
      );
    }

    // 検証済みのtrainerIdを使用 (ヘッダーから直接取らない)
    const result = await callGAS<{ bookings: TrainerBooking[] }>(
      'getTrainerBookings',
      { trainer_id: session.trainerId }
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
