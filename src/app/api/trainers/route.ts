import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import type { Trainer } from '@/types/database';

type PublicTrainer = Pick<Trainer, 'id' | 'name' | 'photo_url' | 'specialties' | 'bio' | 'is_first_visit_eligible'>;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const storeId = searchParams.get('store_id');
  const firstVisitOnly = searchParams.get('first_visit_only') === 'true';

  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
  }

  try {
    const result = await callGAS<{ trainers: PublicTrainer[] }>('getTrainers', {
      storeId,
      firstVisitOnly,
    });

    return NextResponse.json({ trainers: result.trainers });
  } catch (error) {
    console.error('Failed to fetch trainers:', error);
    return NextResponse.json({ error: 'トレーナー情報の取得に失敗しました' }, { status: 500 });
  }
}
