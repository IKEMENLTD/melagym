'use client';

import { useState } from 'react';
import { format, addDays, startOfWeek, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { TimeSlot } from '@/types/database';

interface SlotCalendarProps {
  slots: TimeSlot[];
  selectedDate: Date | null;
  selectedSlot: TimeSlot | null;
  onDateSelect: (date: Date) => void;
  onSlotSelect: (slot: TimeSlot) => void;
  loading?: boolean;
}

export function SlotCalendar({
  slots,
  selectedDate,
  selectedSlot,
  onDateSelect,
  onSlotSelect,
  loading,
}: SlotCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const weekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const daySlots = selectedDate
    ? slots.filter((s) => isSameDay(new Date(s.start), selectedDate))
    : [];

  return (
    <div className="w-full">
      {/* 週ナビゲーション */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset((p) => Math.max(0, p - 1))}
          disabled={weekOffset === 0}
          className="p-2 disabled:opacity-30 active:bg-[#f0f0f0]"
          aria-label="前の週"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-medium text-[#4d4d4d]">
          {format(weekStart, 'M月d日', { locale: ja })} - {format(addDays(weekStart, 6), 'M月d日', { locale: ja })}
        </span>
        <button
          onClick={() => setWeekOffset((p) => Math.min(3, p + 1))}
          disabled={weekOffset >= 3}
          className="p-2 disabled:opacity-30 active:bg-[#f0f0f0]"
          aria-label="次の週"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 曜日選択 */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {days.map((day) => {
          const isPast = isBefore(day, startOfDay(today));
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          return (
            <button
              key={day.toISOString()}
              onClick={() => !isPast && onDateSelect(day)}
              disabled={isPast}
              className={`
                flex flex-col items-center py-2 text-center rounded-lg
                min-h-[60px] transition-colors
                ${isPast ? 'opacity-30 cursor-not-allowed' : 'active:bg-[#f0f0f0]'}
                ${isSelected ? 'bg-[#ff5000] text-white' : ''}
                ${isToday(day) && !isSelected ? 'border-2 border-[#ff5000]' : ''}
              `}
            >
              <span className="text-xs">
                {format(day, 'E', { locale: ja })}
              </span>
              <span className="text-lg font-bold">
                {format(day, 'd')}
              </span>
            </button>
          );
        })}
      </div>

      {/* タイムスロット */}
      {selectedDate && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-[#4d4d4d] mb-3">
            {format(selectedDate, 'M月d日(E)', { locale: ja })} の空き状況
          </h3>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="mela-spinner" role="status">
                <span className="sr-only">空き枠を読み込み中</span>
              </div>
              <p className="text-sm text-[#606060]">読み込み中...</p>
            </div>
          ) : daySlots.length === 0 ? (
            <p className="text-center text-[#606060] py-8">
              この日は空き枠がありません
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {daySlots.map((slot) => {
                const isSelected = selectedSlot?.start === slot.start;
                return (
                  <button
                    key={slot.start}
                    onClick={() => slot.available && onSlotSelect(slot)}
                    disabled={!slot.available}
                    aria-label={`${format(new Date(slot.start), 'HH:mm')} ${slot.available ? (isSelected ? '選択中' : '予約可能') : '予約不可'}`}
                    aria-pressed={isSelected}
                    className={`
                      py-3 text-center font-medium text-sm rounded-lg
                      transition-colors min-h-[48px]
                      ${slot.available && !isSelected
                        ? 'bg-[#fff5f0] text-[#ff5000] border border-[#ff5000] active:bg-[#ffe8db]'
                        : ''}
                      ${isSelected
                        ? 'bg-[#ff5000] text-white border border-[#ff5000]'
                        : ''}
                      ${!slot.available
                        ? 'bg-[#f0f0f0] text-[#d9d9d9] cursor-not-allowed'
                        : ''}
                    `}
                  >
                    {format(new Date(slot.start), 'HH:mm')}
                    {!slot.available && <span className="block text-[10px]">--</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
