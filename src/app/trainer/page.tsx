'use client';

import { useState, useEffect, useCallback } from 'react';
import { trainerFetch, getTrainerSession } from '@/lib/trainer-fetch';

interface TrainerBooking {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booking_type: string;
  customer_name: string;
  store_name: string;
  notes: string;
}

interface TrainerProfile {
  google_calendar_id: string | null;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
}

function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isTomorrow(isoString: string): boolean {
  const date = new Date(isoString);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  );
}

function BookingCard({ booking }: { booking: TrainerBooking }) {
  return (
    <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-[#d9d9d9]">
      <div className="text-center min-w-[60px]">
        <p className="text-lg font-bold text-[#000000]">{formatTime(booking.scheduled_at)}</p>
        <p className="text-xs text-[#606060]">{booking.duration_minutes}分</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#000000] truncate">{booking.customer_name}</p>
        <p className="text-xs text-[#606060]">{booking.store_name}</p>
        {booking.booking_type === 'first_visit' && (
          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-[#fff5f0] text-[#ff5000] rounded-full font-bold">
            初回体験
          </span>
        )}
      </div>
    </div>
  );
}

export default function TrainerDashboard() {
  const [bookings, setBookings] = useState<TrainerBooking[]>([]);
  const [calendarLinked, setCalendarLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [scheduleRes, profileRes] = await Promise.all([
        trainerFetch('/api/trainer/schedule'),
        trainerFetch('/api/trainer/profile'),
      ]);

      if (!scheduleRes.ok) {
        throw new Error('スケジュールの取得に失敗しました');
      }
      if (!profileRes.ok) {
        throw new Error('プロフィールの取得に失敗しました');
      }

      const scheduleData = await scheduleRes.json();
      const profileData = await profileRes.json();

      setBookings(scheduleData.bookings ?? []);

      const profile = profileData.trainer as TrainerProfile | null;
      setCalendarLinked(!!profile?.google_calendar_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const session = getTrainerSession();
  const todayBookings = bookings.filter((b) => isToday(b.scheduled_at));
  const tomorrowBookings = bookings.filter((b) => isTomorrow(b.scheduled_at));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="mela-loading">
          <div className="mela-spinner" />
          <span className="mela-loading-text">読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-6 py-2 bg-[#ff5000] text-black font-bold rounded-full hover:bg-[#e64800] transition-colors"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold text-[#000000]">
          {session?.name ? `${session.name}さん` : 'マイページ'}
        </h1>
        <p className="text-sm text-[#606060] mt-1">
          {new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      {/* カレンダー連携ステータス */}
      <div className="bg-white p-4 rounded-lg border border-[#d9d9d9]">
        <h2 className="text-sm font-bold text-[#000000] mb-2">Googleカレンダー連携</h2>
        {calendarLinked ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-sm text-[#22c55e] font-bold">連携済み</span>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[#606060] mb-3">
              Googleカレンダーと連携すると、予約がカレンダーに自動追加されます。
            </p>
            <p className="text-xs text-[#606060]">
              ※連携は管理者にお問い合わせください
            </p>
          </div>
        )}
      </div>

      {/* 今日の予約 */}
      <div>
        <h2 className="text-base font-bold text-[#000000] mb-3">
          今日の予約
          <span className="ml-2 text-sm font-normal text-[#606060]">
            ({todayBookings.length}件)
          </span>
        </h2>
        {todayBookings.length === 0 ? (
          <div className="bg-white p-6 rounded-lg border border-[#d9d9d9] text-center">
            <p className="text-sm text-[#606060]">今日の予約はありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </div>

      {/* 明日の予約 */}
      <div>
        <h2 className="text-base font-bold text-[#000000] mb-3">
          明日の予約
          <span className="ml-2 text-sm font-normal text-[#606060]">
            ({tomorrowBookings.length}件)
          </span>
        </h2>
        {tomorrowBookings.length === 0 ? (
          <div className="bg-white p-6 rounded-lg border border-[#d9d9d9] text-center">
            <p className="text-sm text-[#606060]">明日の予約はありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tomorrowBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </div>

      {/* 今後の予約件数 */}
      {bookings.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-[#d9d9d9]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#606060]">今後の予約合計</p>
              <p className="text-2xl font-bold text-[#000000]">{bookings.length}件</p>
            </div>
            <a
              href="/trainer/schedule"
              className="px-4 py-2 text-sm font-bold text-[#ff5000] hover:bg-[#fff5f0] rounded-full transition-colors"
            >
              スケジュールを見る
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
