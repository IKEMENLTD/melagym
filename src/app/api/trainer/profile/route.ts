import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import type { Trainer } from '@/types/database';

/**
 * GET: トレーナーIDでプロフィール取得
 */
export async function GET(request: NextRequest) {
  try {
    const trainerEmail = request.headers.get('X-Trainer-Email');

    if (!trainerEmail) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const result = await callGAS<{ trainer: Trainer | null }>(
      'getTrainerByEmail',
      { email: trainerEmail }
    );

    if (!result.trainer) {
      return NextResponse.json(
        { error: 'トレーナーが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ trainer: result.trainer });
  } catch (error) {
    console.error('Failed to fetch trainer profile:', error);
    return NextResponse.json(
      { error: 'プロフィールの取得に失敗しました' },
      { status: 500 }
    );
  }
}

const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'phone',
  'specialties',
  'bio',
  'photo_url',
  'available_hours',
]);

/**
 * PATCH: プロフィール更新
 */
export async function PATCH(request: NextRequest) {
  try {
    const trainerId = request.headers.get('X-Trainer-Id');

    if (!trainerId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // ホワイトリストフィルタリング
    const updates: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '更新する項目がありません' },
        { status: 400 }
      );
    }

    const result = await callGAS<{ success: boolean }>(
      'updateTrainer',
      { id: trainerId, updates }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: '更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update trainer profile:', error);
    return NextResponse.json(
      { error: 'プロフィールの更新に失敗しました' },
      { status: 500 }
    );
  }
}
