import { addMinutes } from 'date-fns';
import { callGAS } from './sheets-api';
import { getFreeBusy, createCalendarEvent, deleteCalendarEvent } from './google-calendar';
import type { BookingRequest, BookingResponse, Booking, Trainer, Store } from '@/types/database';

// ---------- 型定義（GASレスポンス用） ----------

interface GASTrainerStoreItem {
  trainer_id: string;
  store_id: string;
  buffer_minutes: number;
  trainer: Trainer;
}

interface GASBookingCountsResponse {
  counts: Record<string, number>;
}

// ---------- 予約確定 ----------

// ISO 8601 日時文字列の簡易バリデーション
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const VALID_BOOKING_TYPES = ['first_visit', 'regular'] as const;

export async function createBooking(req: BookingRequest): Promise<BookingResponse> {
  // --- 入力バリデーション ---
  if (!req.slot_start || !ISO_DATETIME_RE.test(req.slot_start)) {
    return { success: false, error: '予約日時の形式が不正です' };
  }
  if (isNaN(new Date(req.slot_start).getTime())) {
    return { success: false, error: '予約日時が無効です' };
  }
  if (new Date(req.slot_start) <= new Date()) {
    console.error(`[createBooking:B3] slot_start=${req.slot_start}, now=${new Date().toISOString()}`);
    return { success: false, error: '過去の日時には予約できません' };
  }
  if (!req.store_id || typeof req.store_id !== 'string') {
    return { success: false, error: '店舗IDが不正です' };
  }
  if (!req.trainer_id || typeof req.trainer_id !== 'string') {
    return { success: false, error: 'トレーナーIDが不正です' };
  }
  if (!VALID_BOOKING_TYPES.includes(req.booking_type as typeof VALID_BOOKING_TYPES[number])) {
    return { success: false, error: '予約タイプが不正です' };
  }

  const durationMinutes = 60;

  // トレーナー決定（おまかせの場合は自動アサイン）
  let trainerId = req.trainer_id;
  if (trainerId === 'auto') {
    const assigned = await autoAssignTrainer(
      req.store_id, req.slot_start, durationMinutes,
      req.booking_type === 'first_visit'
    );
    if (!assigned) {
      return { success: false, error: 'この時間帯に対応可能なトレーナーがいません' };
    }
    trainerId = assigned;
  }

  // トレーナーと店舗の情報を取得
  let trainersRes: { trainers: Trainer[] };
  let storesRes: { stores: Store[] };
  try {
    [trainersRes, storesRes] = await Promise.all([
      callGAS<{ trainers: Trainer[] }>('getTrainersFull', {}),
      callGAS<{ stores: Store[] }>('getStores', {}),
    ]);
  } catch (gasErr) {
    console.error('[createBooking] Failed to fetch trainers/stores from GAS:', gasErr);
    return { success: false, error: 'バックエンドサービスに接続できませんでした。しばらくしてからお試しください' };
  }

  const trainer = trainersRes.trainers.find((t) => t.id === trainerId) ?? null;
  const store = storesRes.stores.find((s) => s.id === req.store_id) ?? null;

  if (!trainer || !store) {
    console.error(`[createBooking:B9] trainerId=${trainerId}, storeId=${req.store_id}, trainerFound=${!!trainer}, storeFound=${!!store}, totalTrainers=${trainersRes.trainers.length}, totalStores=${storesRes.stores.length}`);
    return { success: false, error: `トレーナーまたは店舗が見つかりません (T:${!!trainer} S:${!!store})` };
  }

  // FreeBusy APIでリアルタイム空き確認
  const slotEnd = addMinutes(new Date(req.slot_start), durationMinutes).toISOString();
  const calendarIds: string[] = [];
  if (store.google_calendar_id) calendarIds.push(store.google_calendar_id);
  if (trainer.google_calendar_id) calendarIds.push(trainer.google_calendar_id);

  let busyMap: Map<string, { start: string; end: string }[]>;
  try {
    busyMap = await getFreeBusy(calendarIds, req.slot_start, slotEnd);
  } catch (freeBusyErr) {
    console.error('FreeBusy API failed during booking:', freeBusyErr);
    return { success: false, error: 'カレンダーの空き状況を確認できませんでした。しばらくしてからお試しください' };
  }

  // FreeBusyレスポンスにリクエストしたカレンダーが含まれているか検証
  // 含まれていない場合、空き状況が不明なため安全のためブロック
  for (const cid of calendarIds) {
    if (!busyMap.has(cid)) {
      console.error(`FreeBusy response missing calendar: ${cid}`);
      return { success: false, error: 'カレンダーの空き状況を確認できませんでした。時間をおいて再度お試しください' };
    }
  }

  const trainerBusy = trainer.google_calendar_id
    ? (busyMap.get(trainer.google_calendar_id) ?? [])
    : [];
  const storeBusy = store.google_calendar_id
    ? (busyMap.get(store.google_calendar_id) ?? [])
    : [];

  if (trainerBusy.length > 0 || storeBusy.length > 0) {
    console.error(`[createBooking:B12] slot=${req.slot_start}, trainerBusy=${trainerBusy.length}, storeBusy=${storeBusy.length}`);
    return { success: false, error: 'この時間枠は既に埋まっています。別の時間をお選びください' };
  }

  // Googleカレンダーにイベント書込み（カレンダーIDが設定されている場合のみ）
  const eventSummary = `[メラジム] ${req.booking_type === 'first_visit' ? '体験' : 'セッション'} - ${req.customer.name ?? '顧客'}`;
  const eventDescription = `トレーナー: ${trainer.name}\n店舗: ${store.name}`;

  let storeEventId: string | null = null;
  let trainerEventId: string | null = null;

  try {
    // Step 3a: 店舗カレンダーにイベント書込み
    if (store.google_calendar_id) {
      storeEventId = await createCalendarEvent(
        store.google_calendar_id,
        eventSummary,
        req.slot_start,
        slotEnd,
        eventDescription
      );

      if (!storeEventId) {
        return { success: false, error: 'カレンダーへの登録に失敗しました。もう一度お試しください' };
      }
    }

    // Step 3b: トレーナーのカレンダーにもイベント書込み
    if (trainer.google_calendar_id) {
      try {
        trainerEventId = await createCalendarEvent(
          trainer.google_calendar_id,
          `[メラジム] ${store.name} - ${req.customer.name ?? '顧客'}`,
          req.slot_start,
          slotEnd,
          `店舗: ${store.name}\n顧客: ${req.customer.name ?? ''}`
        );
      } catch (calErr) {
        // トレーナーカレンダーへの書込み失敗は予約自体を失敗させない
        // （書込み権限がない場合がある。予約は成功するが管理者への通知が必要）
        console.error('Failed to write to trainer calendar:', trainer.google_calendar_id, calErr);
      }
    }

    // 顧客レコード作成/更新
    let customerId: string;

    if (req.customer.line_uid) {
      const existing = await callGAS<{ customer: { id: string } | null }>(
        'getCustomerByLineUid',
        { line_uid: req.customer.line_uid }
      );

      if (existing.customer) {
        customerId = existing.customer.id;
        if (req.booking_type === 'first_visit') {
          await callGAS('upsertCustomer', {
            id: customerId,
            data: {
              name: req.customer.name,
              email: req.customer.email,
              phone: req.customer.phone,
              age_group: req.customer.age_group,
            },
          });
        }
      } else {
        const newCust = await callGAS<{ success: boolean; id: string }>('upsertCustomer', {
          data: {
            line_uid: req.customer.line_uid,
            name: req.customer.name ?? '',
            email: req.customer.email,
            phone: req.customer.phone ?? '',
            age_group: req.customer.age_group,
          },
        });
        customerId = newCust.id;
      }
    } else {
      const newCust = await callGAS<{ success: boolean; id: string }>('upsertCustomer', {
        data: {
          name: req.customer.name ?? '',
          email: req.customer.email,
          phone: req.customer.phone ?? '',
          age_group: req.customer.age_group,
        },
      });
      customerId = newCust.id;
    }

    // 予約作成（GAS側でLockServiceによるダブルブッキング防止）
    const result = await callGAS<{ success: boolean; booking?: Booking; error?: string }>(
      'createBooking',
      {
        customer_id: customerId,
        trainer_id: trainerId,
        store_id: req.store_id,
        scheduled_at: req.slot_start,
        duration_minutes: durationMinutes,
        booking_type: req.booking_type,
        google_calendar_event_id: storeEventId,
        trainer_calendar_event_id: trainerEventId,
      }
    );

    if (!result.success) {
      // 予約失敗時はカレンダーイベントを削除
      if (store.google_calendar_id && storeEventId) {
        await deleteCalendarEvent(store.google_calendar_id, storeEventId);
      }
      if (trainer.google_calendar_id && trainerEventId) {
        try {
          await deleteCalendarEvent(trainer.google_calendar_id, trainerEventId);
        } catch {
          console.error('Failed to rollback trainer calendar event:', trainerEventId);
        }
      }
      console.error(`[createBooking:B14-GAS] GAS rejected booking: ${result.error}, trainerId=${trainerId}, storeId=${req.store_id}, slot=${req.slot_start}`);
      // GASからのエラーメッセージをそのまま返す（ユーザーが原因を把握できるように）
      return {
        success: false,
        error: result.error ?? '予約の登録に失敗しました。時間をおいて再度お試しください',
      };
    }

    // キャッシュ無効化
    const date = req.slot_start.substring(0, 10);
    await callGAS('deleteAvailabilityCache', {
      trainer_id: trainerId,
      store_id: req.store_id,
      date,
    });

    const warnings: string[] = [];
    if (trainer.google_calendar_id && !trainerEventId) {
      warnings.push('トレーナーのカレンダーへの登録に失敗しました。手動で確認してください。');
    }

    return {
      success: true,
      booking: result.booking,
      ...(warnings.length > 0 && { warnings }),
    };
  } catch (error) {
    const errDetail = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
    console.error('[createBooking] Unhandled error in booking flow:', errDetail);
    // rollback: clean up calendar events if they were created
    if (storeEventId && store.google_calendar_id) {
      try {
        await deleteCalendarEvent(store.google_calendar_id, storeEventId);
      } catch {
        console.error('Failed to rollback store calendar event:', storeEventId);
      }
    }
    if (trainerEventId && trainer.google_calendar_id) {
      try {
        await deleteCalendarEvent(trainer.google_calendar_id, trainerEventId);
      } catch {
        console.error('Failed to rollback trainer calendar event:', trainerEventId);
      }
    }
    return { success: false, error: '予約処理中にエラーが発生しました。しばらくしてからお試しください' };
  }
}

// ---------- おまかせアサイン ----------

async function autoAssignTrainer(
  storeId: string,
  slotStart: string,
  durationMinutes: number,
  firstVisitOnly: boolean = false
): Promise<string | null> {
  try {
  const slotEnd = addMinutes(new Date(slotStart), durationMinutes).toISOString();

  // この店舗に対応可能なトレーナーを取得
  const { trainerStores } = await callGAS<{ trainerStores: GASTrainerStoreItem[] }>(
    'getTrainerStoresByStore',
    { storeId }
  );

  if (!trainerStores || trainerStores.length === 0) return null;

  const activeTrainers = trainerStores.filter((ts) => {
    const trainer = ts.trainer;
    return trainer.is_active && (!firstVisitOnly || trainer.is_first_visit_eligible);
  });

  // FreeBusy APIで全員の空き状況を確認
  const calendarIds = activeTrainers
    .map((ts) => ts.trainer.google_calendar_id)
    .filter((id): id is string => id !== null);

  let busyMap: Map<string, { start: string; end: string }[]>;
  try {
    busyMap = await getFreeBusy(calendarIds, slotStart, slotEnd);
  } catch {
    console.error('FreeBusy API failed during auto-assign');
    return null;
  }

  // 空いているトレーナーを抽出
  const availableTrainers = activeTrainers.filter((ts) => {
    const trainer = ts.trainer;
    if (!trainer.google_calendar_id) return false;
    const busy = busyMap.get(trainer.google_calendar_id) ?? [];
    return busy.length === 0;
  });

  if (availableTrainers.length === 0) return null;

  // 今週の予約数が少ないトレーナーを優先（稼働率均等化）
  const weekStart = new Date(slotStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const trainerIds = availableTrainers.map((ts) => ts.trainer_id);

  const { counts: countMap } = await callGAS<GASBookingCountsResponse>(
    'getBookingCountsForTrainers',
    {
      trainerIds,
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
    }
  );

  // 予約数が最小のトレーナーを選択
  let minCount = Infinity;
  let selected: string | null = null;
  for (const id of trainerIds) {
    const count = countMap[id] ?? 0;
    if (count < minCount) {
      minCount = count;
      selected = id;
    }
  }

  return selected;
  } catch (err) {
    console.error('[autoAssignTrainer] Error:', err);
    return null;
  }
}

// ---------- 予約キャンセル ----------

export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!bookingId || typeof bookingId !== 'string') {
    return { success: false, error: '予約IDが不正です' };
  }

  // GAS側でキャンセル処理
  const result = await callGAS<{
    success: boolean;
    error?: string;
    booking?: Booking;
    store_google_calendar_id?: string | null;
    trainer_google_calendar_id?: string | null;
  }>('cancelBooking', { bookingId, reason, isAdmin: true });

  if (!result.success) {
    // セキュリティ: GAS内部エラーの詳細をクライアントに返さない
    console.error('Booking cancellation failed on GAS:', result.error);
    return { success: false, error: 'キャンセル処理に失敗しました' };
  }

  // Googleカレンダーからイベント削除（店舗）
  if (result.booking?.google_calendar_event_id && result.store_google_calendar_id) {
    try {
      await deleteCalendarEvent(
        result.store_google_calendar_id,
        result.booking.google_calendar_event_id
      );
    } catch {
      console.error(
        'Failed to delete store calendar event:',
        result.booking.google_calendar_event_id
      );
    }
  }

  // Googleカレンダーからイベント削除（トレーナー）
  if (result.booking?.trainer_calendar_event_id && result.trainer_google_calendar_id) {
    try {
      await deleteCalendarEvent(
        result.trainer_google_calendar_id,
        result.booking.trainer_calendar_event_id
      );
    } catch {
      console.error(
        'Failed to delete trainer calendar event:',
        result.booking.trainer_calendar_event_id
      );
    }
  }

  // キャッシュ無効化
  if (result.booking) {
    const date = result.booking.scheduled_at.substring(0, 10);
    await callGAS('deleteAvailabilityCache', {
      trainer_id: result.booking.trainer_id,
      store_id: result.booking.store_id,
      date,
    });
  }

  return { success: true };
}
