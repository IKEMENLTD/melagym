import { NextRequest, NextResponse } from 'next/server';
import { getFreeBusy } from '@/lib/google-calendar';
import { verifyTrainerSession } from '@/lib/trainer-session-verify';
import { stripHtmlTags } from '@/lib/validation';

/**
 * POST: カレンダーIDの連携確認
 *
 * FreeBusy APIを呼んでサービスアカウントがアクセスできるか検証する。
 * 今日の0:00-23:59でFreeBusyを叩いてエラーが出なければOK。
 */
export async function POST(request: NextRequest) {
  try {
    // セッション整合性チェック
    const session = await verifyTrainerSession(request);
    if (!session.ok) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status ?? 401 }
      );
    }

    const body = await request.json() as Record<string, unknown>;
    const rawCalendarId = body.calendar_id;

    if (typeof rawCalendarId !== 'string' || rawCalendarId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'カレンダーIDを入力してください' },
        { status: 400 }
      );
    }

    const calendarId = stripHtmlTags(rawCalendarId.trim());

    // カレンダーIDの基本形式チェック（メールアドレス形式 or Google Calendar ID形式）
    const calendarIdPattern = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!calendarIdPattern.test(calendarId) && !calendarId.endsWith('@group.calendar.google.com')) {
      return NextResponse.json(
        { success: false, error: 'カレンダーIDの形式が正しくありません。通常はGmailアドレスです。' },
        { status: 400 }
      );
    }

    // 今日の0:00-23:59(JST)でFreeBusyを検証
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = jstNow.toISOString().split('T')[0];
    const todayStart = `${todayStr}T00:00:00+09:00`;
    const todayEnd = `${todayStr}T23:59:59+09:00`;

    try {
      await getFreeBusy(
        [calendarId],
        todayStart,
        todayEnd
      );

      return NextResponse.json({
        success: true,
        message: 'カレンダーへのアクセスを確認しました。連携可能です。',
      });
    } catch {
      return NextResponse.json({
        success: false,
        error: 'カレンダーにアクセスできません。Googleカレンダーの共有設定を確認してください。',
      });
    }
  } catch (error) {
    console.error('Calendar check failed:', error);
    return NextResponse.json(
      { success: false, error: 'カレンダーの確認に失敗しました' },
      { status: 500 }
    );
  }
}
