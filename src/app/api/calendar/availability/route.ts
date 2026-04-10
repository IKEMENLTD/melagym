import { NextRequest, NextResponse } from 'next/server';
import { getAvailability, getAvailabilityForStore } from '@/lib/availability';

// IDフォーマット: 英数字・ハイフン・アンダースコアのみ許可
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
// 照会可能な未来日数の上限（90日先まで）
const MAX_FUTURE_DAYS = 90;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const storeId = searchParams.get('store_id');
  const trainerId = searchParams.get('trainer_id');
  const date = searchParams.get('date');

  if (!storeId || !trainerId || !date) {
    return NextResponse.json(
      { error: 'store_id, trainer_id, date are required' },
      { status: 400 }
    );
  }

  // IDフォーマットバリデーション（trainer_id は 'auto' も許可）
  if (!SAFE_ID_PATTERN.test(storeId)) {
    return NextResponse.json({ error: 'store_id の形式が不正です' }, { status: 400 });
  }
  if (trainerId !== 'auto' && !SAFE_ID_PATTERN.test(trainerId)) {
    return NextResponse.json({ error: 'trainer_id の形式が不正です' }, { status: 400 });
  }

  // 日付フォーマットバリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
  }

  // 日付の妥当性チェック（実在する日付か）
  const parsedDate = new Date(`${date}T00:00:00+09:00`);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: '無効な日付です' }, { status: 400 });
  }

  // 過去日付・過度に未来の日付を拒否（JSTベースで文字列比較）
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowJST.toISOString().split('T')[0];
  const maxDateJST = new Date(Date.now() + 9 * 60 * 60 * 1000 + MAX_FUTURE_DAYS * 24 * 60 * 60 * 1000);
  const maxDateStr = maxDateJST.toISOString().split('T')[0];

  if (date < todayStr) {
    return NextResponse.json({ error: '過去の日付は指定できません' }, { status: 400 });
  }
  if (date > maxDateStr) {
    return NextResponse.json(
      { error: `${MAX_FUTURE_DAYS}日以上先の日付は指定できません` },
      { status: 400 }
    );
  }

  try {
    if (trainerId === 'auto') {
      // おまかせ: 全トレーナーのOR集合（誰か1人でも空いていれば表示）
      const results = await getAvailabilityForStore(storeId, date, false);

      // スロットをマージ（いずれかのトレーナーが空いていれば available）
      const slotMap = new Map<string, boolean>();
      for (const result of results) {
        for (const slot of result.slots) {
          if (slot.available) {
            slotMap.set(slot.start, true);
          } else if (!slotMap.has(slot.start)) {
            slotMap.set(slot.start, false);
          }
        }
      }

      // 全スロットのユニオンをソートして返す
      const allSlots = results.flatMap((r) => r.slots);
      const uniqueStarts = new Set<string>();
      const mergedSlots = allSlots
        .filter((s) => {
          if (uniqueStarts.has(s.start)) return false;
          uniqueStarts.add(s.start);
          return true;
        })
        .map((s) => ({
          ...s,
          available: slotMap.get(s.start) ?? false,
        }))
        .sort((a, b) => a.start.localeCompare(b.start));

      return NextResponse.json({ slots: mergedSlots });
    }

    const slots = await getAvailability(trainerId, storeId, date);
    return NextResponse.json({ slots });
  } catch (error) {
    console.error('Availability check failed:', error);
    return NextResponse.json(
      { error: '空き状況の取得に失敗しました。しばらくしてからお試しください' },
      { status: 500 }
    );
  }
}
