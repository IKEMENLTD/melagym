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
