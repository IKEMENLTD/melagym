import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import {
  isValidEmail,
  isValidPhone,
  stripHtmlTags,
  isWithinLength,
} from '@/lib/validation';

/**
 * POST: 新規トレーナー登録
 *
 * セキュリティ注意:
 * - レート制限はインフラ層（Vercel/Cloudflare等）で設定してください
 * - is_active=false で登録し、管理者承認を必須としています
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // --- 名前バリデーション ---
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 });
    }
    const sanitizedName = stripHtmlTags(body.name.trim());
    if (!isWithinLength(sanitizedName, 100)) {
      return NextResponse.json({ error: '名前は100文字以内で入力してください' }, { status: 400 });
    }

    // --- メールバリデーション ---
    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
    }
    const trimmedEmail = body.email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
    }

    // --- 電話番号バリデーション ---
    if (!body.phone || typeof body.phone !== 'string') {
      return NextResponse.json({ error: '電話番号は必須です' }, { status: 400 });
    }
    const trimmedPhone = body.phone.trim();
    if (!isValidPhone(trimmedPhone)) {
      return NextResponse.json({ error: '電話番号の形式が正しくありません' }, { status: 400 });
    }

    // --- specialties バリデーション ---
    let specialties: string[] = [];
    if (body.specialties !== undefined) {
      if (!Array.isArray(body.specialties)) {
        return NextResponse.json({ error: '専門分野は配列で指定してください' }, { status: 400 });
      }
      specialties = body.specialties
        .filter((s: unknown): s is string => typeof s === 'string')
        .map((s: string) => stripHtmlTags(s.trim()))
        .filter((s: string) => s.length > 0 && s.length <= 50);
      if (specialties.length > 20) {
        return NextResponse.json({ error: '専門分野は20個以内で指定してください' }, { status: 400 });
      }
    }

    // --- bio バリデーション（XSS対策） ---
    let bio = '';
    if (body.bio !== undefined) {
      if (typeof body.bio !== 'string') {
        return NextResponse.json({ error: '自己紹介は文字列で指定してください' }, { status: 400 });
      }
      bio = stripHtmlTags(body.bio);
      if (!isWithinLength(bio, 2000)) {
        return NextResponse.json({ error: '自己紹介は2000文字以内で入力してください' }, { status: 400 });
      }
    }

    // 既存メールアドレスチェック
    const existing = await callGAS<{ trainer: unknown }>('getTrainerByEmail', {
      email: trimmedEmail,
    });

    if (existing.trainer) {
      return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 });
    }

    // 新規トレーナー登録（is_active=false で登録、管理者承認待ち）
    const result = await callGAS<{ success: boolean; id: string }>('addTrainer', {
      name: sanitizedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      specialties,
      bio,
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
