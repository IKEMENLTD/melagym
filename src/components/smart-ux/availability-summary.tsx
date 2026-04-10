'use client';

import { useState, useEffect } from 'react';
import type { TimeSlot } from '@/types/database';

interface DaySummary {
  label: string;
  date: Date;
  availableCount: number;
}

interface AvailabilitySummaryProps {
  storeId: string;
  trainerId: string;
  onDateSelect: (date: Date) => void;
}

/**
 * カレンダーの上に表示する「今週の空き状況サマリー」
 * 本日/明日/明後日の空き枠数をバッジで表示
 */
export function AvailabilitySummary({
  storeId,
  trainerId,
  onDateSelect,
}: AvailabilitySummaryProps) {
  const [summaries, setSummaries] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId || !trainerId) return;

    const today = new Date();
    const days: { label: string; date: Date }[] = [
      { label: '本日', date: today },
      { label: '明日', date: addDays(today, 1) },
      { label: '明後日', date: addDays(today, 2) },
    ];

    setLoading(true);

    const tid = trainerId === 'auto' ? 'auto' : trainerId;

    Promise.all(
      days.map(({ date }) => {
        const dateStr = formatDateStr(date);
        return fetch(
          `/api/calendar/availability?store_id=${storeId}&trainer_id=${tid}&date=${dateStr}`
        )
          .then((r) => (r.ok ? r.json() : { slots: [] }))
          .then((data: { slots?: TimeSlot[] }) => {
            const slots = data.slots ?? [];
            return slots.filter((s) => s.available).length;
          })
          .catch(() => 0);
      })
    ).then((counts) => {
      setSummaries(
        days.map((d, i) => ({
          ...d,
          availableCount: counts[i],
        }))
      );
      setLoading(false);
    });
  }, [storeId, trainerId]);

  if (loading) {
    return (
      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 h-12 bg-[#f0f0f0] animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (summaries.length === 0) return null;

  const maxCount = Math.max(...summaries.map((s) => s.availableCount));

  return (
    <div className="mb-4">
      <p className="text-xs text-[#606060] mb-2">空き状況</p>
      <div className="flex gap-2">
        {summaries.map((summary) => {
          const isHighlight = summary.availableCount > 0 && summary.availableCount === maxCount;
          return (
            <button
              key={summary.label}
              onClick={() => onDateSelect(summary.date)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-center transition-all
                ${isHighlight
                  ? 'bg-[#fff5f0] border-2 border-[#ff5000]'
                  : 'bg-[#f8f8f8] border border-[#d9d9d9]'}
                ${summary.availableCount === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:border-[#ff5000]/60 active:scale-[0.98]'}
              `}
              disabled={summary.availableCount === 0}
            >
              <span className="block text-[10px] text-[#606060]">{summary.label}</span>
              <span
                className={`block text-sm font-bold ${
                  isHighlight ? 'text-[#ff5000]' : 'text-[#4d4d4d]'
                }`}
              >
                {summary.availableCount}枠
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
