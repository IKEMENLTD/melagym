'use client';

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { TimeSlot } from '@/types/database';

interface RecommendedSlotsProps {
  slots: TimeSlot[];
  selectedDate: Date | null;
  onSlotSelect: (slot: TimeSlot) => void;
}

/**
 * 「おすすめ」バッジ付きスロット提案
 * - 直近で空いている最初の枠
 * - 最も空いている時間帯のスロット
 */
export function RecommendedSlots({
  slots,
  selectedDate,
  onSlotSelect,
}: RecommendedSlotsProps) {
  if (!selectedDate || slots.length === 0) return null;

  const availableSlots = slots.filter((s) => s.available);
  if (availableSlots.length === 0) return null;

  // 直近の空き枠（最も早い時間）
  const now = new Date();
  const upcomingSlots = availableSlots
    .filter((s) => new Date(s.start) > now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const nextAvailable = upcomingSlots[0] ?? availableSlots[0];

  // おすすめ枠が1つしかなければそのまま表示、なければ return null
  if (!nextAvailable) return null;

  return (
    <div className="mb-4 p-3 bg-[#fff5f0] border border-[#ff5000]/20 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff5000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span className="text-xs font-bold text-[#ff5000]">おすすめの時間帯</span>
      </div>
      <button
        onClick={() => onSlotSelect(nextAvailable)}
        className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-[#ff5000]/30 hover:border-[#ff5000] active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-[#ff5000]">
            {format(new Date(nextAvailable.start), 'HH:mm')}
          </span>
          <span className="text-xs text-[#606060]">
            {format(new Date(nextAvailable.start), 'M月d日(E)', { locale: ja })}
          </span>
        </div>
        <span className="text-xs font-bold text-white bg-[#ff5000] px-2 py-1 rounded-full">
          次の空き枠
        </span>
      </button>
      {availableSlots.length > 1 && (
        <p className="text-[10px] text-[#909090] mt-2 text-center">
          他にも {availableSlots.length - 1} 枠の空きがあります
        </p>
      )}
    </div>
  );
}
