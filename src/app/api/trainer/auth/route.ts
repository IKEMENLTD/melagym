import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import type { Trainer } from '@/types/database';

/**
 * POST: メールアドレスでトレーナーを照合
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email;

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return NextResponse.json(
        { error: 'メールアドレスは必須です' },
        { status: 400 }
      );
    }

    const result = await callGAS<{ trainer: Trainer | null }>(
      'getTrainerByEmail',
      { email: email.trim().toLowerCase() }
    );

    if (!result.trainer) {
      return NextResponse.json(
        { error: '登録されていないメールアドレスです' },
        { status: 404 }
      );
    }

    if (!result.trainer.is_active) {
      return NextResponse.json(
        { error: 'このアカウントは無効です' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      trainer: {
        id: result.trainer.id,
        name: result.trainer.name,
        email: result.trainer.email,
      },
    });
  } catch (error) {
    console.error('Trainer auth error:', error);
    return NextResponse.json(
      { error: '認証処理に失敗しました' },
      { status: 500 }
    );
  }
}
