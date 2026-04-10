import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { stripDangerousKeys } from '@/lib/validation';
import type { Trainer } from '@/types/database';

const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエストのJSON形式が不正です' }, { status: 400 });
  }

  const { id, ...dirtyUpdates } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });
  }

  // プロトタイプ汚染対策 + ホワイトリストフィルタリング
  const rawUpdates = stripDangerousKeys(dirtyUpdates as Record<string, unknown>);
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
    const result = await callGAS<{
      success: boolean;
      deactivated?: boolean;
      futureBookingsCount?: number;
      warning?: string;
    }>('updateTrainer', { id, updates });

    if (!result.success) {
      return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
    }

    const response: Record<string, unknown> = { success: true };
    if (result.deactivated && result.futureBookingsCount && result.futureBookingsCount > 0) {
      response.warning = `このトレーナーには未来の確定予約が${result.futureBookingsCount}件あります。手動でキャンセルまたは別トレーナーへの振替をお願いします。`;
      response.futureBookingsCount = result.futureBookingsCount;
    }
    if (result.warning) {
      response.warning = result.warning;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to update trainer:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id || !VALID_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'IDの形式が不正です' }, { status: 400 });
  }

  try {
    const result = await callGAS<{
      success: boolean;
      error?: string;
      futureBookingsCount?: number;
      deletedTrainer?: { id: string; name: string };
    }>('deleteTrainer', { id });

    if (!result.success) {
      return NextResponse.json({ error: result.error || '削除に失敗しました' }, { status: 400 });
    }

    return NextResponse.json({ success: true, deletedTrainer: result.deletedTrainer });
  } catch (error) {
    console.error('Failed to delete trainer:', error);
    return NextResponse.json({ error: 'トレーナーの削除に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

  // 店舗紐付け更新のサブアクション
  if (body.action === 'updateStores') {
    if (!body.trainerId || typeof body.trainerId !== 'string') {
      return NextResponse.json({ error: 'trainerId is required' }, { status: 400 });
    }
    try {
      const result = await callGAS<{ success: boolean }>('updateTrainerStores', {
        trainerId: body.trainerId,
        storeIds: Array.isArray(body.storeIds) ? body.storeIds : [],
      });
      return NextResponse.json(result);
    } catch (error) {
      console.error('Failed to update trainer stores:', error);
      return NextResponse.json({ error: '店舗紐付けの更新に失敗しました' }, { status: 500 });
    }
  }

  // 必須項目チェック
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: '名前は必須です' }, { status: 400 });
  }
  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
  }

  const name = body.name.trim();
  const email = body.email.trim();
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  try {
    const result = await callGAS<{ success: boolean; id: string }>('addTrainer', {
      name,
      email,
      phone,
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
