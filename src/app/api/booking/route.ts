import { NextRequest, NextResponse } from 'next/server';
import { createBooking, cancelBooking } from '@/lib/booking';
import type { BookingRequest } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // バリデーション
    if (!body.store_id || !body.trainer_id || !body.slot_start) {
      return NextResponse.json(
        { success: false, error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    if (!body.booking_type || !['first_visit', 'regular'].includes(body.booking_type)) {
      return NextResponse.json(
        { success: false, error: '予約タイプが不正です' },
        { status: 400 }
      );
    }

    // 初回予約は顧客情報必須
    if (body.booking_type === 'first_visit') {
      if (!body.customer?.name || !body.customer?.phone) {
        return NextResponse.json(
          { success: false, error: 'お名前と電話番号は必須です' },
          { status: 400 }
        );
      }
    }

    const bookingRequest: BookingRequest = {
      store_id: body.store_id,
      trainer_id: body.trainer_id,
      slot_start: body.slot_start,
      customer: body.customer ?? {},
      booking_type: body.booking_type,
    };

    const result = await createBooking(bookingRequest);

    return NextResponse.json(result, {
      status: result.success ? 200 : 409,
    });
  } catch (error) {
    console.error('Booking failed:', error);
    return NextResponse.json(
      { success: false, error: '予約処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const bookingId = searchParams.get('id');
    const reason = searchParams.get('reason');

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: '予約IDが必要です' },
        { status: 400 }
      );
    }

    const result = await cancelBooking(bookingId, reason ?? undefined);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Cancel failed:', error);
    return NextResponse.json(
      { success: false, error: 'キャンセル処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
