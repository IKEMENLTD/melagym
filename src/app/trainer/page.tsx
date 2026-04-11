'use client';

import { useState, useEffect, useCallback } from 'react';
import { trainerFetch, getTrainerSession } from '@/lib/trainer-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { trainerDashboardGuide } from '@/lib/guide-data';
import { NextBookingCountdown } from '@/components/smart-ux/next-booking-countdown';

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
  const [calendarDisplayId, setCalendarDisplayId] = useState<string | null>(null);
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
      setCalendarDisplayId(profile?.google_calendar_id ?? null);
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
          className="px-6 py-2 bg-[#ff5000] text-white font-bold rounded-full hover:bg-[#e64800] transition-colors"
        >
          再読み込み
        </button>
      </div>
    );
  }

  // カレンダー未連携 → セットアップガイドを強制表示
  if (!calendarLinked && !loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[#fff5f0] border-2 border-[#ff5000] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#ff5000] rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-black">Googleカレンダー連携が必要です</h2>
              <p className="text-sm text-[#606060]">予約を受けるにはカレンダー連携が必須です</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg space-y-3 mb-4">
            <p className="text-sm font-bold text-black">連携手順:</p>
            <div className="space-y-2 text-sm text-[#4d4d4d]">
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-[#ff5000] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <p>Googleカレンダーを開く</p>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-[#ff5000] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <p>左側のカレンダー名の「︙」→「設定と共有」</p>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-[#ff5000] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <div>
                  <p>「特定のユーザーとの共有」に以下を追加:</p>
                  <div className="flex items-center gap-1 bg-[#f0f0f0] border border-[#d9d9d9] px-2 py-1.5 mt-1 rounded">
                    <span className="flex-1 text-xs break-all select-all">melagym@instagram-generator-472905.iam.gserviceaccount.com</span>
                    <button
                      type="button"
                      onClick={() => {
                        const text = 'melagym@instagram-generator-472905.iam.gserviceaccount.com';
                        if (navigator.clipboard && window.isSecureContext) {
                          navigator.clipboard.writeText(text);
                        } else {
                          const ta = document.createElement('textarea');
                          ta.value = text;
                          ta.style.position = 'fixed';
                          ta.style.opacity = '0';
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand('copy');
                          document.body.removeChild(ta);
                        }
                      }}
                      className="text-[#ff5000] font-bold text-xs whitespace-nowrap flex-shrink-0"
                    >コピー</button>
                  </div>
                  <p className="mt-1 text-xs text-[#606060]">権限:「予定の変更」を選択（予約がカレンダーに自動追加されます。「空き時間情報のみ」でも予約自体は成立しますが、カレンダーへの自動書込みは行われません）</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 bg-[#ff5000] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                <p>下のボタンからプロフィール画面でカレンダーIDを入力</p>
              </div>
            </div>
          </div>

          <a
            href="/trainer/profile"
            className="block w-full py-3 bg-[#ff5000] text-white font-bold rounded-full text-center hover:bg-[#e64800] transition-colors shadow-[0_4px_20px_rgba(255,80,0,0.4)]"
          >
            プロフィール画面でカレンダーを連携する
          </a>
        </div>
        <HelpGuide steps={trainerDashboardGuide} pageTitle="マイページ" />
      </div>
    );
  }

  return (
    <div className="space-y-6 ">
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

      {/* 次の予約までのカウントダウン */}
      <NextBookingCountdown
        todayBookings={todayBookings.map((b) => ({
          scheduled_at: b.scheduled_at,
          customer_name: b.customer_name,
        }))}
      />

      {/* カレンダー連携ステータス */}
      <div className="bg-white p-4 rounded-lg border border-[#d9d9d9]">
        <h2 className="text-sm font-bold text-[#000000] mb-2">Googleカレンダー連携</h2>
        {calendarLinked ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span className="text-sm text-[#22c55e] font-bold">連携済み</span>
            </div>
            {calendarDisplayId && (
              <p className="text-xs text-[#909090]">
                カレンダー: {calendarDisplayId.length > 20
                  ? `${calendarDisplayId.slice(0, 10)}...${calendarDisplayId.slice(-10)}`
                  : calendarDisplayId}
              </p>
            )}
            <a
              href="/trainer/profile"
              className="inline-block text-xs text-[#ff5000] hover:underline"
            >
              設定を変更する
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#606060]">
              Googleカレンダーと連携すると、予約がカレンダーに自動追加されます。
            </p>
            <a
              href="/trainer/profile"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-[#ff5000] text-white rounded-full hover:bg-[#e64800] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              プロフィールからカレンダーを連携する
            </a>
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
