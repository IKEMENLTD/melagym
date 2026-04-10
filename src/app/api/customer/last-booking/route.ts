import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';

// LINE UID: 英数字のみ、最大64文字
const LINE_UID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

interface LastBookingData {
  store_id: string | null;
  trainer_id: string | null;
}

/**
 * リピーター顧客の前回予約情報を取得する
 * LINE UIDで顧客を特定し、最後の予約の店舗ID・トレーナーIDを返す
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lineUid = searchParams.get('line_uid');

  if (!lineUid) {
    return NextResponse.json(
      { error: 'line_uid は必須です' },
      { status: 400 }
    );
  }

  if (!LINE_UID_PATTERN.test(lineUid)) {
    return NextResponse.json(
      { error: 'line_uid の形式が不正です' },
      { status: 400 }
    );
  }

  try {
    const result = await callGAS<{
      customer: { id: string; favorite_trainer_id: string | null } | null;
      lastBooking: { store_id: string; trainer_id: string } | null;
    }>('getCustomerLastBooking', { line_uid: lineUid });

    const data: LastBookingData = {
      store_id: result.lastBooking?.store_id ?? null,
      trainer_id: result.customer?.favorite_trainer_id ?? result.lastBooking?.trainer_id ?? null,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch last booking:', error);
    return NextResponse.json(
      { error: '前回の予約情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
