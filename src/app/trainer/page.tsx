'use client';

import { useState, useEffect, useCallback } from 'react';
import { trainerFetch, getTrainerSession } from '@/lib/trainer-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { trainerDashboardGuide } from '@/lib/guide-data';

interface TrainerBooking {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booking_type: string;
  customer_name: string;
  customer_phone: string;
  store_name: string;
  notes: string;
}

interface TrainerProfile {
  has_calendar_linked: boolean;
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-white rounded-lg border border-[#d9d9d9] cursor-pointer hover:border-[#ff5000]/40 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-4 p-4">
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
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#606060"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-[#f0f0f0] space-y-2">
          {booking.customer_phone && (
            <div className="flex items-center gap-2 text-sm text-[#4d4d4d]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
              <a
                href={`tel:${booking.customer_phone}`}
                className="text-[#ff5000] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {booking.customer_phone}
              </a>
            </div>
          )}
          {booking.notes && (
            <div className="text-xs text-[#606060] bg-[#f8f8f8] p-2 rounded">
              <span className="font-bold">メモ: </span>{booking.notes}
            </div>
          )}
          <div className="text-xs text-[#909090]">
            {formatDate(booking.scheduled_at)} {formatTime(booking.scheduled_at)} - {booking.duration_minutes}分
          </div>
        </div>
      )}
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
      setCalendarLinked(!!profile?.has_calendar_linked);
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
            <p className="text-xs text-[#909090] mt-1">ゆっくりお過ごしください</p>
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
            <p className="text-sm text-[#606060]">明日の予約はまだありません</p>
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

      <HelpGuide steps={trainerDashboardGuide} pageTitle="マイページ" />
    </div>
  );
}
