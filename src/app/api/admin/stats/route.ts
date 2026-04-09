import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { verifyAdminAuth } from '@/lib/admin-auth';

interface StatsResponse {
  todayBookings: number;
  weekBookings: number;
  monthBookings: number;
  activeTrainers: number;
  activeStores: number;
  cancelRate: number;
}

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const stats = await callGAS<StatsResponse>('getStats', {});
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json({ error: '統計情報の取得に失敗しました' }, { status: 500 });
  }
}
