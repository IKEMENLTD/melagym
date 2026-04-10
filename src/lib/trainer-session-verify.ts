/**
 * トレーナーセッションの整合性検証
 *
 * X-Trainer-Id と X-Trainer-Email の両方をチェックし、
 * GASでそのIDとEmailが一致するトレーナーが存在するか検証する。
 *
 * これにより、CookieのIDだけを書き換えた「なりすまし」を防止する。
 */

import { NextRequest } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { isValidEmail, isValidId } from '@/lib/validation';
import type { Trainer } from '@/types/database';

export interface TrainerSessionVerifyResult {
  ok: boolean;
  trainerId?: string;
  trainerEmail?: string;
  error?: string;
  status?: number;
}

/**
 * リクエストからトレーナーのセッション情報を検証する
 *
 * 1. X-Trainer-Id と X-Trainer-Email ヘッダーが両方存在するか
 * 2. フォーマットが正しいか
 * 3. GASでそのIDのトレーナーが存在し、Emailが一致するか
 */
export async function verifyTrainerSession(
  request: NextRequest
): Promise<TrainerSessionVerifyResult> {
  const trainerId = request.headers.get('X-Trainer-Id');
  const trainerEmail = request.headers.get('X-Trainer-Email');

  // 両方のヘッダーが必須
  if (!trainerId || !trainerEmail) {
    return {
      ok: false,
      error: '認証が必要です。再ログインしてください。',
      status: 401,
    };
  }

  // フォーマット検証
  if (!isValidId(trainerId)) {
    return {
      ok: false,
      error: '無効な認証情報です',
      status: 401,
    };
  }

  if (!isValidEmail(trainerEmail)) {
    return {
      ok: false,
      error: '無効な認証情報です',
      status: 401,
    };
  }

  // GASでトレーナーを取得し、IDとEmailの整合性を検証
  try {
    const result = await callGAS<{ trainer: Trainer | null }>(
      'getTrainerByEmail',
      { email: trainerEmail }
    );

    if (!result.trainer) {
      return {
        ok: false,
        error: 'トレーナーが見つかりません。再ログインしてください。',
        status: 401,
      };
    }

    // IDの一致を検証 (なりすまし防止の核心)
    if (result.trainer.id !== trainerId) {
      // ログに警告を出力 (セキュリティイベント)
      console.warn(
        `[SECURITY] Trainer session mismatch: header_id=${trainerId}, actual_id=${result.trainer.id}, email=${trainerEmail}`
      );
      return {
        ok: false,
        error: '認証情報が不正です。再ログインしてください。',
        status: 401,
      };
    }

    // アクティブチェック
    if (!result.trainer.is_active) {
      return {
        ok: false,
        error: 'このアカウントは現在無効です。',
        status: 403,
      };
    }

    return {
      ok: true,
      trainerId: result.trainer.id,
      trainerEmail: result.trainer.email ?? trainerEmail,
    };
  } catch (error) {
    console.error('Trainer session verification failed:', error);
    return {
      ok: false,
      error: '認証の検証に失敗しました',
      status: 500,
    };
  }
}
