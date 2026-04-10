import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import type { Trainer } from '@/types/database';

// IDフォーマット: 英数字・ハイフン・アンダースコアのみ許可
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

type PublicTrainer = Pick<Trainer, 'id' | 'name' | 'photo_url' | 'specialties' | 'bio' | 'is_first_visit_eligible'>;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const storeId = searchParams.get('store_id');
  const firstVisitOnly = searchParams.get('first_visit_only') === 'true';

  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
  }

  if (!SAFE_ID_PATTERN.test(storeId)) {
    return NextResponse.json({ error: 'store_id の形式が不正です' }, { status: 400 });
  }

  try {
    const result = await callGAS<{ trainers: Trainer[] }>('getTrainers', {
      storeId,
      firstVisitOnly,
    });

    // 公開用フィールドのみに明示的にフィルタ（GASが余分なフィールドを返しても漏洩防止）
    const trainers: PublicTrainer[] = result.trainers.map((t) => ({
      id: t.id,
      name: t.name,
      photo_url: t.photo_url,
      specialties: t.specialties,
      bio: t.bio,
      is_first_visit_eligible: t.is_first_visit_eligible,
    }));

    return NextResponse.json({ trainers });
  } catch (error) {
    console.error('Failed to fetch trainers:', error);
    return NextResponse.json({ error: 'トレーナー情報の取得に失敗しました' }, { status: 500 });
  }
}
