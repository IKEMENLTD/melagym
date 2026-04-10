'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { storeFetch } from '@/lib/store-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { storeDashboardGuide } from '@/lib/guide-data';

interface StoreDetail {
  id: string;
  name: string;
  area: string;
  address: string;
  has_calendar_linked: boolean;
  calendar_id_masked: string | null;
  business_hours: Record<string, { open: string; close: string } | null>;
  is_active: boolean;
}

interface TrainerInfo {
  id: string;
  name: string;
  photo_url: string | null;
  specialties: string[];
  is_first_visit_eligible: boolean;
}

interface StoreBooking {
  id: string;
  scheduled_at: string;
  status: string;
}

interface DashboardData {
  store: StoreDetail;
  trainers: TrainerInfo[];
  todayCount: number;
  weekCount: number;
}

function countBookings(
  bookings: StoreBooking[],
  filterFn: (b: StoreBooking) => boolean
): number {
  return bookings.filter(
    (b) => b.status === 'confirmed' && filterFn(b)
  ).length;
}

function getToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(now);
  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export default function StoreDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [settingsRes, bookingsRes] = await Promise.all([
          storeFetch('/api/store/settings'),
          storeFetch('/api/store/bookings'),
        ]);

        if (!settingsRes.ok) throw new Error('店舗情報の取得に失敗しました');
        if (!bookingsRes.ok) throw new Error('予約情報の取得に失敗しました');

        const settingsData = (await settingsRes.json()) as {
          store: StoreDetail;
          trainers: TrainerInfo[];
        };
        const bookingsData = (await bookingsRes.json()) as {
          bookings: StoreBooking[];
        };

        const today = getToday();
        const week = getWeekRange();

        const todayCount = countBookings(bookingsData.bookings, (b) => {
          return b.scheduled_at.startsWith(today);
        });

        const weekCount = countBookings(bookingsData.bookings, (b) => {
          const d = new Date(b.scheduled_at);
          return d >= week.start && d < week.end;
        });

        setData({
          store: settingsData.store,
          trainers: settingsData.trainers,
          todayCount,
          weekCount,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'データの取得に失敗しました';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="mela-spinner" />
        <span className="mela-loading-text">読み込み中...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[#ef4444] font-medium">{error ?? 'データの取得に失敗しました'}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#ff5000] text-white text-sm font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all shadow-[0_4px_20px_rgba(255,80,0,0.4)]"
        >
          再読み込み
        </button>
      </div>
    );
  }

  const calendarLinked = data.store.has_calendar_linked;
  const calendarStatus = calendarLinked ? '連携済み' : '未設定';

  const statCards: {
    label: string;
    value: string | number;
    bg: string;
    text: string;
    href?: string;
    subtitle?: string;
  }[] = [
    {
      label: '本日の予約',
      value: data.todayCount,
      bg: 'bg-[#fff5f0]',
      text: 'text-[#ff5000]',
      href: `/store/bookings?date=${getToday()}`,
      subtitle: '詳細を見る',
    },
    {
      label: '今週の予約',
      value: data.weekCount,
      bg: 'bg-[#f0fdf4]',
      text: 'text-[#22c55e]',
      href: '/store/bookings',
      subtitle: '予約一覧へ',
    },
    {
      label: 'Googleカレンダー',
      value: calendarStatus,
      bg: calendarLinked ? 'bg-[#f0fdf4]' : 'bg-[#fef2f2]',
      text: calendarLinked ? 'text-[#22c55e]' : 'text-[#ef4444]',
      href: '/store/calendar',
      subtitle: calendarLinked ? '設定を確認' : '設定する',
    },
    {
      label: '対応トレーナー',
      value: `${data.trainers.length}名`,
      bg: 'bg-[#f0f0f0]',
      text: 'text-black',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-black">ダッシュボード</h1>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const content = (
            <>
              <p className={`text-xs font-medium ${card.text} opacity-70`}>
                {card.label}
              </p>
              <p className={`text-xl sm:text-2xl font-bold mt-1 ${card.text} break-all`}>
                {card.value}
              </p>
              {card.subtitle && (
                <p className="text-[10px] text-[#999] mt-1">{card.subtitle}</p>
              )}
            </>
          );
          return card.href ? (
            <Link
              key={card.label}
              href={card.href}
              className={`${card.bg} p-4 rounded-lg block hover:opacity-80 transition-opacity`}
            >
              {content}
            </Link>
          ) : (
            <div key={card.label} className={`${card.bg} p-4 rounded-lg`}>
              {content}
            </div>
          );
        })}
      </div>

      {/* 対応トレーナー一覧 */}
      <div className="bg-white border border-[#d9d9d9] rounded-lg">
        <div className="px-4 sm:px-6 py-4 border-b border-[#d9d9d9]">
          <h2 className="font-bold text-black">対応トレーナー</h2>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {data.trainers.length === 0 ? (
            <div className="px-4 sm:px-6 py-8 text-center text-[#606060]">
              トレーナーが登録されていません
            </div>
          ) : (
            data.trainers.map((trainer) => (
              <div
                key={trainer.id}
                className="px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4"
              >
                <div className="w-10 h-10 bg-[#f0f0f0] rounded-full flex items-center justify-center text-sm font-bold text-[#4d4d4d] shrink-0">
                  {trainer.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-black text-sm">
                    {trainer.name}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {trainer.specialties.map((s) => (
                      <span
                        key={s}
                        className="text-xs bg-[#f0f0f0] text-[#4d4d4d] px-2 py-0.5"
                      >
                        {s}
                      </span>
                    ))}
                    {trainer.is_first_visit_eligible && (
                      <span className="text-xs bg-[#fff5f0] text-[#ff5000] px-2 py-0.5">
                        初回対応可
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <HelpGuide steps={storeDashboardGuide} pageTitle="店舗ダッシュボード" />
    </div>
  );
}
