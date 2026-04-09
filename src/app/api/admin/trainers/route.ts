import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { verifyAdminAuth } from '@/lib/admin-auth';
import type { Trainer } from '@/types/database';

// 更新可能なカラムをホワイトリストで制限
const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'specialties',
  'bio',
  'is_first_visit_eligible',
  'is_active',
  'google_calendar_id',
  'available_hours',
]);

interface TrainerWithStores extends Trainer {
  stores: { store_id: string; store_name: string }[];
}

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const result = await callGAS<{ trainers: TrainerWithStores[] }>('getTrainersFull', {});
    return NextResponse.json({ trainers: result.trainers });
  } catch (error) {
    console.error('Failed to fetch trainers:', error);
    return NextResponse.json({ error: 'トレーナー情報の取得に失敗しました' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...rawUpdates } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });
  }

  // ホワイトリストフィルタリング
  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(rawUpdates)) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) {
      updates[key] = rawUpdates[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 });
  }

  try {
    const result = await callGAS<{ success: boolean }>('updateTrainer', { id, updates });

    if (!result.success) {
      return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update trainer:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json();

  // 必須項目チェック
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: '名前は必須です' }, { status: 400 });
  }
  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
  }

  try {
    const result = await callGAS<{ success: boolean; id: string }>('addTrainer', {
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone?.trim() ?? '',
      specialties: body.specialties ?? [],
      bio: body.bio ?? '',
      is_first_visit_eligible: body.is_first_visit_eligible ?? false,
      google_calendar_id: body.google_calendar_id ?? null,
      available_hours: body.available_hours ?? { start: '09:00', end: '21:00' },
      store_ids: body.store_ids ?? [],
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Failed to add trainer:', error);
    return NextResponse.json({ error: 'トレーナーの登録に失敗しました' }, { status: 500 });
  }
}
