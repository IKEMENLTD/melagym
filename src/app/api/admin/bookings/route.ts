import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { verifyAdminAuth } from '@/lib/admin-auth';

interface BookingListItem {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booking_type: string;
  customer_name: string;
  trainer_name: string;
  store_name: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['completed', 'no_show', 'cancelled'],
};

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);

  try {
    const result = await callGAS<{ bookings: BookingListItem[]; pagination: PaginationInfo }>(
      'getBookings',
      { limit, page }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    return NextResponse.json({ error: '予約情報の取得に失敗しました' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエストのJSON形式が不正です' }, { status: 400 });
  }

  const { id, status, current_status } = body;

  if (!id || typeof id !== 'string' || !SAFE_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: '予約IDが不正です' }, { status: 400 });
  }

  if (!status || typeof status !== 'string') {
    return NextResponse.json({ error: 'ステータスは必須です' }, { status: 400 });
  }

  // ステータス遷移の検証
  const currentStatus = typeof current_status === 'string' ? current_status : 'confirmed';
  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus];
  if (!allowedNext || !allowedNext.includes(status)) {
    return NextResponse.json(
      { error: `「${currentStatus}」から「${status}」への変更はできません` },
      { status: 400 }
    );
  }

  try {
    const result = await callGAS<{ success: boolean }>('updateBookingStatus', {
      id,
      status,
    });

    if (!result.success) {
      return NextResponse.json({ error: 'ステータスの更新に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update booking status:', error);
    return NextResponse.json({ error: 'ステータスの更新に失敗しました' }, { status: 500 });
  }
}
