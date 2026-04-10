import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { isValidEmail } from '@/lib/validation';
import type { Trainer } from '@/types/database';

/**
 * POST: メールアドレス + パスワードでトレーナーを認証
 *
 * パスワード未設定のトレーナーはメールのみで認証（段階的移行）
 * requiresPasswordSetup: true が返った場合、パスワード設定を促す
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email;
    const password = body.password;

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

    const result = await callGAS<{
      success: boolean;
      error?: string;
      trainer?: { id: string; name: string; email: string };
      requiresPasswordSetup?: boolean;
    }>('authenticateTrainer', {
      email: trimmedEmail,
      password: typeof password === 'string' ? password : undefined,
    });

    if (!result.success || !result.trainer) {
      return NextResponse.json(
        { error: result.error ?? 'メールアドレスまたはパスワードが無効です。新規登録がまだの方は「新規登録はこちら」からご登録ください。' },
        { status: 401 }
      );
    }

    const isSecure = request.url.startsWith('https');
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30日
    };

    const response = NextResponse.json({
      trainer: result.trainer,
      requiresPasswordSetup: result.requiresPasswordSetup ?? false,
    });

    response.cookies.set('trainer_id', result.trainer.id, cookieOptions);
    response.cookies.set('trainer_email', result.trainer.email, cookieOptions);

    return response;
  } catch (error) {
    console.error('Trainer auth error:', error);
    return NextResponse.json(
      { error: '認証処理に失敗しました' },
      { status: 500 }
    );
  }
}
