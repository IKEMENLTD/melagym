import { NextRequest, NextResponse } from 'next/server';
import { createBooking, cancelBooking } from '@/lib/booking';
import { verifyAdminAuth } from '@/lib/admin-auth';
import type { BookingRequest } from '@/types/database';

// IDフォーマット: 英数字・ハイフン・アンダースコアのみ許可
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
// ISO 8601 日時フォーマット（簡易チェック）
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
// 電話番号: 数字・ハイフン・プラスのみ、最大20文字
const PHONE_PATTERN = /^[0-9+\-()]{1,20}$/;
// メールアドレス: 簡易バリデーション
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 文字列フィールドの最大長
const MAX_NAME_LENGTH = 100;
const MAX_REASON_LENGTH = 500;

/** 文字列を安全な長さに切り詰める */
function truncate(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'リクエストボディのJSON形式が不正です' },
      { status: 400 }
    );
  }

  try {
    // 必須フィールドの存在チェック
    if (
      typeof body.store_id !== 'string' ||
      typeof body.trainer_id !== 'string' ||
      typeof body.slot_start !== 'string'
    ) {
      return NextResponse.json(
        { success: false, error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    // IDフォーマットバリデーション
    if (!SAFE_ID_PATTERN.test(body.store_id)) {
      return NextResponse.json(
        { success: false, error: 'store_id の形式が不正です' },
        { status: 400 }
      );
    }

    // trainer_id は 'auto' も許可
    if (body.trainer_id !== 'auto' && !SAFE_ID_PATTERN.test(body.trainer_id)) {
      return NextResponse.json(
        { success: false, error: 'trainer_id の形式が不正です' },
        { status: 400 }
      );
    }

    // slot_start の日時フォーマットバリデーション
    if (!ISO_DATETIME_PATTERN.test(body.slot_start)) {
      return NextResponse.json(
        { success: false, error: 'slot_start はISO 8601形式で指定してください' },
        { status: 400 }
      );
    }

    // slot_start が過去でないことを確認
    const slotDate = new Date(body.slot_start);
    if (isNaN(slotDate.getTime()) || slotDate.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: '過去の日時は予約できません' },
        { status: 400 }
      );
    }

    // booking_type バリデーション
    if (typeof body.booking_type !== 'string' || !['first_visit', 'regular'].includes(body.booking_type)) {
      return NextResponse.json(
        { success: false, error: '予約タイプが不正です' },
        { status: 400 }
      );
    }

    // customer オブジェクトのバリデーションとサニタイズ
    const rawCustomer = (body.customer ?? {}) as Record<string, unknown>;
    const customer: BookingRequest['customer'] = {};

    if (rawCustomer.name != null) {
      if (typeof rawCustomer.name !== 'string') {
        return NextResponse.json(
          { success: false, error: 'お名前は文字列で指定してください' },
          { status: 400 }
        );
      }
      customer.name = truncate(rawCustomer.name.trim(), MAX_NAME_LENGTH);
    }

    if (rawCustomer.phone != null) {
      if (typeof rawCustomer.phone !== 'string' || !PHONE_PATTERN.test(rawCustomer.phone)) {
        return NextResponse.json(
          { success: false, error: '電話番号の形式が不正です' },
          { status: 400 }
        );
      }
      customer.phone = rawCustomer.phone;
    }

    if (rawCustomer.email != null) {
      if (typeof rawCustomer.email !== 'string' || !EMAIL_PATTERN.test(rawCustomer.email)) {
        return NextResponse.json(
          { success: false, error: 'メールアドレスの形式が不正です' },
          { status: 400 }
        );
      }
      customer.email = rawCustomer.email.slice(0, 254);
    }

    if (rawCustomer.age_group != null) {
      if (typeof rawCustomer.age_group !== 'string') {
        return NextResponse.json(
          { success: false, error: '年代は文字列で指定してください' },
          { status: 400 }
        );
      }
      customer.age_group = truncate(rawCustomer.age_group, 20);
    }

    if (rawCustomer.line_uid != null) {
      if (typeof rawCustomer.line_uid !== 'string' || rawCustomer.line_uid.length > 64) {
        return NextResponse.json(
          { success: false, error: 'LINE UIDの形式が不正です' },
          { status: 400 }
        );
      }
      customer.line_uid = rawCustomer.line_uid;
    }

    // 初回予約は顧客情報必須
    if (body.booking_type === 'first_visit') {
      if (!customer.name || !customer.phone) {
        return NextResponse.json(
          { success: false, error: 'お名前と電話番号は必須です' },
          { status: 400 }
        );
      }
    }

    const bookingRequest: BookingRequest = {
      store_id: body.store_id,
      trainer_id: body.trainer_id,
      slot_start: body.slot_start,
      customer,
      booking_type: body.booking_type as 'first_visit' | 'regular',
    };

    const result = await createBooking(bookingRequest);

    return NextResponse.json(result, {
      status: result.success ? 200 : 409,
    });
  } catch (error) {
    console.error('Booking failed:', error);
    return NextResponse.json(
      { success: false, error: '予約処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // 管理者認証チェック: キャンセルは管理画面からのみ許可
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error ?? '認証が必要です' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const bookingId = searchParams.get('id');
    const reason = searchParams.get('reason');

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: '予約IDが必要です' },
        { status: 400 }
      );
    }

    // 予約IDのフォーマットバリデーション
    if (!SAFE_ID_PATTERN.test(bookingId)) {
      return NextResponse.json(
        { success: false, error: '予約IDの形式が不正です' },
        { status: 400 }
      );
    }

    // reason のサニタイズ（長さ制限・制御文字除去）
    const sanitizedReason = reason
      ? truncate(reason.replace(/[\x00-\x1f]/g, ''), MAX_REASON_LENGTH)
      : undefined;

    const result = await cancelBooking(bookingId, sanitizedReason);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Cancel failed:', error);
    return NextResponse.json(
      { success: false, error: 'キャンセル処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
