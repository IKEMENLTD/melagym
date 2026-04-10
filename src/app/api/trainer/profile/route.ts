import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import {
  isValidEmail,
  isValidId,
  stripHtmlTags,
  isWithinLength,
  isValidTime,
} from '@/lib/validation';
import type { Trainer } from '@/types/database';

/**
 * GET: トレーナーのメールアドレスでプロフィール取得
 *
 * セキュリティ警告: X-Trainer-Email ヘッダーはクライアントが自由に設定可能です。
 * 他のトレーナーのメールアドレスを指定すれば、そのプロフィールを閲覧できます。
 * 本番環境ではJWT等のトークンベース認証に移行してください。
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

    // メールフォーマット検証（ヘッダーインジェクション対策）
    if (!isValidEmail(trainerEmail)) {
      return NextResponse.json(
        { error: '無効な認証情報です' },
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
 *
 * セキュリティ警告: X-Trainer-Id ヘッダーはクライアントが自由に設定可能です。
 * 他のトレーナーのIDを指定すれば、そのプロフィールを変更できます。
 * 本番環境ではJWT等のトークンベース認証に移行してください。
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

    // ID形式検証（インジェクション対策）
    if (!isValidId(trainerId)) {
      return NextResponse.json(
        { error: '無効な認証情報です' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // ホワイトリストフィルタリング + 値のバリデーション
    const updates: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (!ALLOWED_UPDATE_FIELDS.has(key)) {
        continue;
      }

      const value = body[key];

      switch (key) {
        case 'name': {
          if (typeof value !== 'string' || value.trim().length === 0) {
            return NextResponse.json({ error: '名前は必須です' }, { status: 400 });
          }
          const sanitized = stripHtmlTags(value.trim());
          if (!isWithinLength(sanitized, 100)) {
            return NextResponse.json({ error: '名前は100文字以内で入力してください' }, { status: 400 });
          }
          updates[key] = sanitized;
          break;
        }
        case 'phone': {
          if (typeof value !== 'string') {
            return NextResponse.json({ error: '電話番号は文字列で指定してください' }, { status: 400 });
          }
          updates[key] = value.trim();
          break;
        }
        case 'specialties': {
          if (!Array.isArray(value)) {
            return NextResponse.json({ error: '専門分野は配列で指定してください' }, { status: 400 });
          }
          const sanitized = value
            .filter((s: unknown): s is string => typeof s === 'string')
            .map((s: string) => stripHtmlTags(s.trim()))
            .filter((s: string) => s.length > 0 && s.length <= 50);
          if (sanitized.length > 20) {
            return NextResponse.json({ error: '専門分野は20個以内で指定してください' }, { status: 400 });
          }
          updates[key] = sanitized;
          break;
        }
        case 'bio': {
          if (typeof value !== 'string') {
            return NextResponse.json({ error: '自己紹介は文字列で指定してください' }, { status: 400 });
          }
          const sanitizedBio = stripHtmlTags(value);
          if (!isWithinLength(sanitizedBio, 2000)) {
            return NextResponse.json({ error: '自己紹介は2000文字以内で入力してください' }, { status: 400 });
          }
          updates[key] = sanitizedBio;
          break;
        }
        case 'photo_url': {
          if (typeof value !== 'string') {
            return NextResponse.json({ error: '写真URLは文字列で指定してください' }, { status: 400 });
          }
          // URL形式の簡易検証（httpまたはhttpsのみ許可）
          if (value && !/^https?:\/\/.+/.test(value)) {
            return NextResponse.json({ error: '写真URLの形式が正しくありません' }, { status: 400 });
          }
          if (!isWithinLength(value, 2048)) {
            return NextResponse.json({ error: 'URLが長すぎます' }, { status: 400 });
          }
          updates[key] = value;
          break;
        }
        case 'available_hours': {
          if (typeof value !== 'object' || value === null) {
            return NextResponse.json({ error: '利用可能時間はオブジェクトで指定してください' }, { status: 400 });
          }
          const hours = value as { start?: string; end?: string };
          if (!hours.start || !hours.end || !isValidTime(hours.start) || !isValidTime(hours.end)) {
            return NextResponse.json({ error: '利用可能時間の形式が正しくありません（HH:MM）' }, { status: 400 });
          }
          updates[key] = { start: hours.start, end: hours.end };
          break;
        }
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
