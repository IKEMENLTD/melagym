import { google, calendar_v3 } from 'googleapis';

// singleton calendar client
let calendarClient: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar {
  if (!calendarClient) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
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

// FreeBusy APIで複数カレンダーの空き状況を一括取得（最大50件バッチ）
export async function getFreeBusy(
  calendarIds: string[],
  timeMin: string,
  timeMax: string
): Promise<Map<string, { start: string; end: string }[]>> {
  const calendar = getCalendarClient();
  const result = new Map<string, { start: string; end: string }[]>();

  // 50件ずつバッチ処理
  const batchSize = 50;
  for (let i = 0; i < calendarIds.length; i += batchSize) {
    const batch = calendarIds.slice(i, i + batchSize);

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
        const busy = (data.busy ?? [])
          .filter((b): b is { start: string; end: string } =>
            typeof b.start === 'string' && typeof b.end === 'string'
          )
          .map((b) => ({ start: b.start, end: b.end }));
        result.set(calId, busy);
      }
    }
  }

  return result;
}

// Googleカレンダーにイベント書き込み
export async function createCalendarEvent(
  calendarId: string,
  summary: string,
  startTime: string,
  endTime: string,
  description?: string
): Promise<string | null> {
  const calendar = getCalendarClient();

  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      description,
      start: { dateTime: startTime, timeZone: 'Asia/Tokyo' },
      end: { dateTime: endTime, timeZone: 'Asia/Tokyo' },
    },
  });

  return response.data.id ?? null;
}

// Googleカレンダーからイベント削除
export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient();
  await calendar.events.delete({ calendarId, eventId });
}
