import { NextRequest, NextResponse } from 'next/server';
import { getAvailability, getAvailabilityForStore } from '@/lib/availability';

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

  // 日付バリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
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
