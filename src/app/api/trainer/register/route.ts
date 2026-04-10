import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 });
    }
    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
    }
    if (!body.phone || typeof body.phone !== 'string') {
      return NextResponse.json({ error: '電話番号は必須です' }, { status: 400 });
    }

    // 既存メールアドレスチェック
    const existing = await callGAS<{ trainer: unknown }>('getTrainerByEmail', {
      email: body.email.trim().toLowerCase(),
    });

    if (existing.trainer) {
      return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 });
    }

    // 新規トレーナー登録（is_active=false で登録、管理者承認待ち）
    const result = await callGAS<{ success: boolean; id: string }>('addTrainer', {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      specialties: body.specialties ?? [],
      bio: body.bio ?? '',
      is_first_visit_eligible: false,
      is_active: false, // 管理者承認まで非アクティブ
      google_calendar_id: null,
      available_hours: { start: '09:00', end: '21:00' },
      store_ids: [],
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Trainer registration failed:', error);
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 });
  }
}
