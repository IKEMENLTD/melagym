import { addMinutes, format, parseISO, isAfter, isBefore } from 'date-fns';
import { getFreeBusy } from './google-calendar';
import { callGAS } from './sheets-api';
import type { TimeSlot, Store, Trainer, BusinessHours } from '@/types/database';

const SLOT_DURATION_MINUTES = 60; // 1セッション60分
const CACHE_TTL_MINUTES = 5;

// ---------- 型定義（GASレスポンス用） ----------

interface GASTrainerStoreItem {
  trainer_id: string;
  store_id: string;
  buffer_minutes: number;
  trainer: Trainer;
}

interface GASCacheResponse {
  cache: {
    slots: TimeSlot[];
    fetched_at: string;
  } | null;
}

// ---------- 空き枠計算 ----------

export async function getAvailability(
  trainerId: string,
  storeId: string,
  date: string // YYYY-MM-DD
): Promise<TimeSlot[]> {
  // キャッシュチェック
  const cacheRes = await callGAS<GASCacheResponse>('getAvailabilityCache', {
    trainer_id: trainerId,
    store_id: storeId,
    date,
  });

  if (cacheRes.cache) {
    const fetchedAt = parseISO(cacheRes.cache.fetched_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - fetchedAt.getTime()) / 60000;
    if (diffMinutes < CACHE_TTL_MINUTES) {
      return cacheRes.cache.slots;
    }
  }

  // トレーナーと店舗の情報を取得
  const [trainerStoresRes, storesRes] = await Promise.all([
    callGAS<{ trainerStores: GASTrainerStoreItem[] }>('getTrainerStoresByStore', { storeId }),
    callGAS<{ stores: Store[] }>('getStores', {}),
  ]);

  const store = storesRes.stores.find((s) => s.id === storeId) ?? null;
  const tsItem = trainerStoresRes.trainerStores.find((ts) => ts.trainer_id === trainerId);
  const trainer = tsItem?.trainer ?? null;
  const bufferMinutes = tsItem?.buffer_minutes ?? 0;

  if (!trainer || !store) return [];

  // date range (use next day 00:00 as exclusive end to avoid missing last second)
  const dayStart = `${date}T00:00:00+09:00`;
  const nextDay = addMinutes(parseISO(`${date}T00:00:00+09:00`), 24 * 60);
  const dayEnd = nextDay.toISOString();

  // FreeBusy APIで両方の忙しい時間を取得
  const calendarIds: string[] = [];
  if (trainer.google_calendar_id) calendarIds.push(trainer.google_calendar_id);
  calendarIds.push(store.google_calendar_id);

  const busyMap = await getFreeBusy(calendarIds, dayStart, dayEnd);

  // トレーナーのbusy時間（バッファ込み）
  const trainerBusy = trainer.google_calendar_id
    ? (busyMap.get(trainer.google_calendar_id) ?? []).map((b) => ({
        start: addMinutes(parseISO(b.start), -bufferMinutes).toISOString(),
        end: addMinutes(parseISO(b.end), bufferMinutes).toISOString(),
      }))
    : [];

  // 店舗のbusy時間
  const storeBusy = busyMap.get(store.google_calendar_id) ?? [];

  // 営業時間を取得
  const dayOfWeek = format(parseISO(date), 'EEEE').toLowerCase();
  const hours = (store.business_hours as BusinessHours)[dayOfWeek];
  if (!hours) return []; // 定休日

  // トレーナーの対応可能時間帯
  const trainerStart = trainer.available_hours.start; // "09:00"
  const trainerEnd = trainer.available_hours.end; // "21:00"

  // 営業時間とトレーナー対応時間の重なりを計算
  const effectiveStart = maxTime(hours.open, trainerStart);
  const effectiveEnd = minTime(hours.close, trainerEnd);

  if (effectiveStart >= effectiveEnd) return [];

  // Build slot times using explicit JST offset to avoid server TZ mismatch
  let cursor = parseISO(`${date}T${effectiveStart}:00+09:00`);
  const endTime = parseISO(`${date}T${effectiveEnd}:00+09:00`);

  const slots: TimeSlot[] = [];
  const now = new Date();

  while (addMinutes(cursor, SLOT_DURATION_MINUTES).getTime() <= endTime.getTime()) {
    const slotStart = cursor;
    const slotEnd = addMinutes(cursor, SLOT_DURATION_MINUTES);

    // 過去のスロットはスキップ
    if (isAfter(slotStart, now)) {
      const isTrainerFree = !hasConflict(slotStart, slotEnd, trainerBusy);
      const isStoreFree = !hasConflict(slotStart, slotEnd, storeBusy);

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        available: isTrainerFree && isStoreFree,
      });
    }

    cursor = addMinutes(cursor, SLOT_DURATION_MINUTES);
  }

  // キャッシュ保存
  await callGAS('upsertAvailabilityCache', {
    trainer_id: trainerId,
    store_id: storeId,
    date,
    slots,
    fetched_at: new Date().toISOString(),
  });

  return slots;
}

// ---------- 複数トレーナーの空き枠一括取得（おまかせ用） ----------

export async function getAvailabilityForStore(
  storeId: string,
  date: string,
  firstVisitOnly: boolean
): Promise<{ trainerId: string; trainerName: string; slots: TimeSlot[] }[]> {
  const { trainerStores } = await callGAS<{ trainerStores: GASTrainerStoreItem[] }>(
    'getTrainerStoresByStore',
    { storeId }
  );

  if (!trainerStores) return [];

  const results = await Promise.all(
    trainerStores
      .filter((ts) => {
        return !firstVisitOnly || ts.trainer.is_first_visit_eligible;
      })
      .map(async (ts) => {
        const slots = await getAvailability(ts.trainer.id, storeId, date);
        return {
          trainerId: ts.trainer.id,
          trainerName: ts.trainer.name,
          slots,
        };
      })
  );

  return results.filter((r) => r.slots.some((s) => s.available));
}

// ---------- ユーティリティ ----------

function hasConflict(
  start: Date,
  end: Date,
  busyPeriods: { start: string; end: string }[]
): boolean {
  return busyPeriods.some((busy) => {
    const busyStart = parseISO(busy.start);
    const busyEnd = parseISO(busy.end);
    return isBefore(start, busyEnd) && isAfter(end, busyStart);
  });
}

function maxTime(a: string, b: string): string {
  return a > b ? a : b;
}

function minTime(a: string, b: string): string {
  return a < b ? a : b;
}
