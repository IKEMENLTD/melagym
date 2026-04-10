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

    // セキュリティ: 存在しない・未承認の両方で同じレスポンスを返す（列挙攻撃防止）
    if (!result.trainer || !result.trainer.is_active) {
      return NextResponse.json(
        { error: 'メールアドレスまたはアカウントが無効です。新規登録がまだの方は「新規登録はこちら」からご登録ください。承認待ちの方は管理者の承認をお待ちください。' },
        { status: 401 }
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
