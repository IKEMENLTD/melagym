'use client';

import { useState, useEffect } from 'react';

interface TimelineBooking {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  customer_name: string;
  trainer_name: string;
}

interface TodayTimelineProps {
  bookings: TimelineBooking[];
}

/**
 * 店舗ダッシュボード: 今日のタイムライン
 * 時間軸に沿って予約カードが並び、現在時刻にラインを表示
 */
export function TodayTimeline({ bookings }: TodayTimelineProps) {
  const [currentMinute, setCurrentMinute] = useState(() => getCurrentMinute());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMinute(getCurrentMinute());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (bookings.length === 0) {
    return (
      <div className="bg-white border border-[#d9d9d9] rounded-lg p-6 text-center">
        <p className="text-sm text-[#606060]">今日の予約はありません</p>
      </div>
    );
  }

  // 今日の予約を時間順にソート
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  // タイムライン表示用の時間範囲を計算
  const firstHour = new Date(sorted[0].scheduled_at).getHours();
  const lastBooking = sorted[sorted.length - 1];
  const lastHour = new Date(lastBooking.scheduled_at).getHours() + 1;
  const startHour = Math.max(0, firstHour - 1);
  const endHour = Math.min(24, lastHour + 1);
  const totalMinutes = (endHour - startHour) * 60;

  // 現在時刻のライン位置（%）
  const currentPos = ((currentMinute - startHour * 60) / totalMinutes) * 100;
  const showCurrentLine = currentPos >= 0 && currentPos <= 100;

  const statusColors: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: 'bg-[#fff5f0]', text: 'text-[#ff5000]' },
    completed: { bg: 'bg-[#f0fdf4]', text: 'text-[#22c55e]' },
    cancelled: { bg: 'bg-[#fef2f2]', text: 'text-[#ef4444]' },
    no_show: { bg: 'bg-[#fef2f2]', text: 'text-[#ef4444]' },
  };

  const statusLabels: Record<string, string> = {
    confirmed: '確定',
    completed: '完了',
    cancelled: 'キャンセル',
    no_show: '無断欠席',
  };

  return (
    <div className="bg-white border border-[#d9d9d9] rounded-lg">
      <div className="px-4 sm:px-6 py-4 border-b border-[#d9d9d9]">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <h2 className="font-bold text-black">今日のタイムライン</h2>
        </div>
      </div>
      <div className="relative px-4 sm:px-6 py-4">
        {/* 時間ラベル */}
        <div className="relative" style={{ minHeight: `${(endHour - startHour) * 60}px` }}>
          {Array.from({ length: endHour - startHour + 1 }, (_, i) => {
            const hour = startHour + i;
            const topPos = (i / (endHour - startHour)) * 100;
            return (
              <div
                key={hour}
                className="absolute left-0 w-full flex items-center"
                style={{ top: `${topPos}%` }}
              >
                <span className="text-[10px] text-[#909090] w-10 flex-shrink-0">
                  {String(hour).padStart(2, '0')}:00
                </span>
                <div className="flex-1 h-px bg-[#f0f0f0]" />
              </div>
            );
          })}

          {/* 現在時刻ライン */}
          {showCurrentLine && (
            <div
              className="absolute left-0 right-0 flex items-center z-10 pointer-events-none"
              style={{ top: `${currentPos}%` }}
            >
              <div className="w-2 h-2 rounded-full bg-[#ff5000] flex-shrink-0" />
              <div className="flex-1 h-0.5 bg-[#ff5000]" />
            </div>
          )}

          {/* 予約カード */}
          {sorted.map((booking) => {
            const bookingDate = new Date(booking.scheduled_at);
            const bookingMinute = bookingDate.getHours() * 60 + bookingDate.getMinutes();
            const topPx = ((bookingMinute - startHour * 60) / totalMinutes) * 100;
            const colors = statusColors[booking.status] ?? statusColors.confirmed;
            const label = statusLabels[booking.status] ?? booking.status;
            const time = bookingDate.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={booking.id}
                className={`absolute left-12 right-0 ${colors.bg} border border-[#d9d9d9] rounded-lg p-3 z-5`}
                style={{
                  top: `calc(${topPx}% + 2px)`,
                  minHeight: '48px',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#4d4d4d]">{time}</span>
                      <span className="text-[10px] text-[#909090]">
                        {booking.duration_minutes}分
                      </span>
                    </div>
                    <p className="text-sm font-medium text-black truncate">
                      {booking.customer_name}
                    </p>
                    <p className="text-[10px] text-[#606060] truncate">
                      {booking.trainer_name}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${colors.text} ${colors.bg}`}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getCurrentMinute(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}
