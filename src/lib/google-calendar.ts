import { google, calendar_v3 } from 'googleapis';

// singleton calendar client
let calendarClient: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar {
  if (!calendarClient) {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    // 秘密鍵の改行処理: Netlify等では \\n（リテラル）か実際の改行かが環境依存
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '';
    const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

    // 環境変数の検証: 起動時に明確なエラーを出す
    if (!clientEmail) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL 環境変数が設定されていません');
    }
    if (!privateKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY 環境変数が設定されていません');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ],
    });

    calendarClient = google.calendar({ version: 'v3', auth });
  }
  return calendarClient;
}

/**
 * FreeBusy APIで複数カレンダーの空き状況を一括取得（最大50件バッチ）
 *
 * 注意: 空のcalendarIdsは空Mapを返す（エラーではない）
 * 注意: レスポンスに含まれないカレンダーIDはエラーとして扱う
 */
export async function getFreeBusy(
  calendarIds: string[],
  timeMin: string,
  timeMax: string
): Promise<Map<string, { start: string; end: string }[]>> {
  if (!calendarIds.length) return new Map();

  const calendar = getCalendarClient();
  const result = new Map<string, { start: string; end: string }[]>();

  // 50件ずつバッチ処理
  const batchSize = 50;
  for (let i = 0; i < calendarIds.length; i += batchSize) {
    const batch = calendarIds.slice(i, i + batchSize);

    try {
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          timeZone: 'Asia/Tokyo',
          items: batch.map((id) => ({ id })),
        },
      });

      const calendars = response.data.calendars;
      if (calendars) {
        for (const [calId, data] of Object.entries(calendars)) {
          // Google APIがカレンダーにエラーを返した場合（権限不足等）
          if (data.errors && data.errors.length > 0) {
            console.error(`Calendar ${calId} returned errors:`, data.errors);
            // エラーのあるカレンダーも空配列としてマップに入れる（存在確認用）
            result.set(calId, []);
            continue;
          }

          const busy = (data.busy ?? [])
            .filter((b): b is { start: string; end: string } =>
              typeof b.start === 'string' && typeof b.end === 'string'
            )
            .map((b) => ({ start: b.start, end: b.end }));
          result.set(calId, busy);
        }
      }

      // レスポンスに含まれないカレンダーIDを検出
      for (const requestedId of batch) {
        if (!result.has(requestedId)) {
          console.warn(`Calendar ${requestedId} was not included in FreeBusy response`);
        }
      }
    } catch (error) {
      // エラー種別を識別してログに残す
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Google Calendar FreeBusy API error: ${errMsg}`);
      throw new Error('カレンダーの空き状況取得に失敗しました');
    }
  }

  return result;
}

/**
 * Googleカレンダーにイベント書き込み
 */
export async function createCalendarEvent(
  calendarId: string,
  summary: string,
  startTime: string,
  endTime: string,
  description?: string
): Promise<string | null> {
  if (!calendarId) throw new Error('カレンダーIDが指定されていません');

  const calendar = getCalendarClient();

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        start: { dateTime: startTime, timeZone: 'Asia/Tokyo' },
        end: { dateTime: endTime, timeZone: 'Asia/Tokyo' },
      },
    });

    if (!response.data.id) {
      console.error('Calendar event created but no ID returned for calendar:', calendarId);
    }

    return response.data.id ?? null;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Google Calendar event creation error for ${calendarId}: ${errMsg}`);
    throw new Error('カレンダーイベントの作成に失敗しました');
  }
}

/**
 * Googleカレンダーからイベント削除
 */
export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  if (!calendarId || !eventId) throw new Error('カレンダーIDまたはイベントIDが指定されていません');

  const calendar = getCalendarClient();

  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Google Calendar event deletion error for ${calendarId}/${eventId}: ${errMsg}`);
    throw new Error('カレンダーイベントの削除に失敗しました');
  }
}
