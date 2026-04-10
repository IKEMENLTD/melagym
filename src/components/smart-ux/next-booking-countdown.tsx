'use client';

import { useState, useEffect } from 'react';

interface NextBookingCountdownProps {
  /** 今日の予約一覧（scheduled_at がISO文字列） */
  todayBookings: { scheduled_at: string; customer_name: string }[];
}

interface TimeRemaining {
  hours: number;
  minutes: number;
  customerName: string;
  scheduledAt: string;
}

/**
 * トレーナーマイページ: 次の予約までのカウントダウン
 */
export function NextBookingCountdown({ todayBookings }: NextBookingCountdownProps) {
  const [remaining, setRemaining] = useState<TimeRemaining | null>(null);
  const [noMore, setNoMore] = useState(false);

  useEffect(() => {
    function update() {
      const now = new Date();
      const upcoming = todayBookings
        .filter((b) => new Date(b.scheduled_at) > now)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

      if (upcoming.length === 0) {
        setRemaining(null);
        setNoMore(true);
        return;
      }

      const next = upcoming[0];
      const diff = new Date(next.scheduled_at).getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setRemaining({
        hours,
        minutes,
        customerName: next.customer_name,
        scheduledAt: next.scheduled_at,
      });
      setNoMore(false);
    }

    update();
    const interval = setInterval(update, 60000); // 1分ごとに更新
    return () => clearInterval(interval);
  }, [todayBookings]);

  if (noMore && todayBookings.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg border border-[#d9d9d9] text-center">
        <p className="text-sm text-[#606060]">今日の予約はありません。</p>
        <p className="text-xs text-[#909090] mt-1">お疲れさまでした。</p>
      </div>
    );
  }

  if (noMore) {
    return (
      <div className="bg-[#f0fdf4] p-4 rounded-lg border border-[#22c55e]/20 text-center">
        <div className="flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-sm font-bold text-[#22c55e]">本日の予約は全て終了しました</p>
        </div>
        <p className="text-xs text-[#606060] mt-1">お疲れさまでした。</p>
      </div>
    );
  }

  if (!remaining) return null;

  const timeText =
    remaining.hours > 0
      ? `あと ${remaining.hours}時間${remaining.minutes}分`
      : `あと ${remaining.minutes}分`;

  const formattedTime = new Date(remaining.scheduledAt).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-[#fff5f0] p-4 rounded-lg border border-[#ff5000]/20">
      <div className="flex items-center gap-2 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff5000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="text-xs font-bold text-[#ff5000]">次の予約まで</span>
      </div>
      <p className="text-2xl font-bold text-[#ff5000] mb-1">{timeText}</p>
      <div className="flex items-center gap-2 text-xs text-[#606060]">
        <span>{formattedTime}</span>
        <span>-</span>
        <span className="font-medium text-[#4d4d4d]">{remaining.customerName} 様</span>
      </div>
    </div>
  );
}
