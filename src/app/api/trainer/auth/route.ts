import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { isValidEmail } from '@/lib/validation';
import type { Trainer } from '@/types/database';

/**
 * POST: メールアドレスでトレーナーを照合
 *
 * セキュリティ警告: 現在はメールアドレスのみで認証しており、パスワード検証がありません。
 * メールアドレスを知っている第三者がなりすまし可能です。
 * 本番環境ではパスワード認証またはOAuth/マジックリンク認証の導入を強く推奨します。
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

    const trimmedEmail = email.trim().toLowerCase();

    // メールフォーマット検証
    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json(
        { error: 'メールアドレスの形式が正しくありません' },
        { status: 400 }
      );
    }

    const result = await callGAS<{ trainer: Trainer | null }>(
      'getTrainerByEmail',
      { email: trimmedEmail }
    );

    // セキュリティ: 存在しないメールと無効アカウントで同じレスポンスを返さない
    // （ここではUXを優先して区別しているが、攻撃者によるアカウント列挙に注意）
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
