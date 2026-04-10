import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { verifyAdminAuth } from '@/lib/admin-auth';
import type { Store } from '@/types/database';

const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'area',
  'address',
  'google_calendar_id',
  'business_hours',
  'is_active',
]);

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const result = await callGAS<{ stores: Store[] }>('getStores', {});
    return NextResponse.json({ stores: result.stores });
  } catch (error) {
    console.error('Failed to fetch stores:', error);
    return NextResponse.json({ error: '店舗情報の取得に失敗しました' }, { status: 500 });
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

  const { id, ...rawUpdates } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });
  }

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
    const result = await callGAS<{ success: boolean }>('updateStore', { id, updates });

    if (!result.success) {
      return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update store:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }
}
