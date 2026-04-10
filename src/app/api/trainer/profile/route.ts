import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import {
  stripHtmlTags,
  stripDangerousKeys,
  isWithinLength,
  isValidTime,
  isValidExternalUrl,
} from '@/lib/validation';
import { verifyTrainerSession } from '@/lib/trainer-session-verify';
import type { Trainer } from '@/types/database';

/**
 * GET: トレーナーのプロフィール取得
 *
 * セッション整合性チェック: X-Trainer-Id と X-Trainer-Email の両方を検証し、
 * GASでIDとEmailが一致するか確認することで、なりすましを防止する。
 */
export async function GET(request: NextRequest) {
  try {
    // セッション整合性チェック (ID + Email の一致を検証)
    const session = await verifyTrainerSession(request);
    if (!session.ok) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status ?? 401 }
      );
    }

    // 検証済みのEmailでプロフィール取得
    const result = await callGAS<{ trainer: Trainer | null }>(
      'getTrainerByEmail',
      { email: session.trainerEmail }
    );

    if (!result.trainer) {
      return NextResponse.json(
        { error: 'トレーナーが見つかりません' },
        { status: 404 }
      );
    }

    // カレンダーIDはトレーナー本人に表示する（連携管理のため）
    const calendarId = result.trainer.google_calendar_id ?? null;
    const safeTrainer = {
      id: result.trainer.id,
      name: result.trainer.name,
      email: result.trainer.email,
      phone: result.trainer.phone,
      photo_url: result.trainer.photo_url,
      specialties: result.trainer.specialties,
      bio: result.trainer.bio,
      is_first_visit_eligible: result.trainer.is_first_visit_eligible,
      is_active: result.trainer.is_active,
      available_hours: result.trainer.available_hours,
      has_calendar_linked: !!calendarId,
      google_calendar_id: calendarId,
    };

    return NextResponse.json({ trainer: safeTrainer });
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
  'google_calendar_id',
]);

/**
 * PATCH: プロフィール更新
 *
 * セッション整合性チェック: X-Trainer-Id と X-Trainer-Email の両方を検証し、
 * GASでIDとEmailが一致するか確認することで、他人のプロフィール書き換えを防止する。
 */
export async function PATCH(request: NextRequest) {
  try {
    // セッション整合性チェック (ID + Email の一致を検証)
    const session = await verifyTrainerSession(request);
    if (!session.ok) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status ?? 401 }
      );
    }

    // 検証済みのtrainerIdを使用 (ヘッダーから直接取らない)
    const trainerId = session.trainerId;

    const rawBody = await request.json();
    // プロトタイプ汚染対策
    const body = stripDangerousKeys(rawBody as Record<string, unknown>);

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
          // SSRF対策: httpsのみ許可、内部IP/localhostをブロック
          if (value && !isValidExternalUrl(value)) {
            return NextResponse.json({ error: '写真URLはhttps://で始まる外部URLのみ使用できます' }, { status: 400 });
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
        case 'google_calendar_id': {
          if (typeof value !== 'string') {
            return NextResponse.json({ error: 'カレンダーIDは文字列で指定してください' }, { status: 400 });
          }
          const trimmedCalId = stripHtmlTags(value.trim());
          // 空文字は連携解除を意味する
          if (trimmedCalId === '') {
            updates[key] = null;
          } else {
            // メールアドレス形式 or Google Calendar ID形式
            const calIdPattern = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
            if (!calIdPattern.test(trimmedCalId) && !trimmedCalId.endsWith('@group.calendar.google.com')) {
              return NextResponse.json({ error: 'カレンダーIDの形式が正しくありません' }, { status: 400 });
            }
            if (!isWithinLength(trimmedCalId, 254)) {
              return NextResponse.json({ error: 'カレンダーIDは254文字以内で入力してください' }, { status: 400 });
            }
            updates[key] = trimmedCalId;
          }
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
