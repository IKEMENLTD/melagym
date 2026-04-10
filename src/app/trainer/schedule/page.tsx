'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { trainerFetch } from '@/lib/trainer-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { trainerScheduleGuide } from '@/lib/guide-data';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  isSameDay,
  isToday,
  parseISO,
  eachDayOfInterval,
} from 'date-fns';
import { ja } from 'date-fns/locale';

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

export default function TrainerSchedule() {
  const [bookings, setBookings] = useState<TrainerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await trainerFetch('/api/trainer/schedule');
      if (!res.ok) {
        throw new Error('スケジュールの取得に失敗しました');
      }
      const data = await res.json();
      setBookings(data.bookings ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const weekEnd = useMemo(
    () => endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
    [currentWeekStart]
  );

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: currentWeekStart, end: weekEnd }),
    [currentWeekStart, weekEnd]
  );

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, TrainerBooking[]>();
    for (const day of weekDays) {
      const key = format(day, 'yyyy-MM-dd');
      map.set(key, []);
    }
    for (const booking of bookings) {
      const bookingDate = parseISO(booking.scheduled_at);
      const key = format(bookingDate, 'yyyy-MM-dd');
      const list = map.get(key);
      if (list) {
        list.push(booking);
      }
    }
    return map;
  }, [bookings, weekDays]);

  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
  }, []);

  const goToThisWeek = useCallback(() => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }, []);

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
          onClick={fetchBookings}
          className="px-6 py-2 bg-[#ff5000] text-white font-bold rounded-full hover:bg-[#e64800] transition-colors"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 mela-bg-training2">
      <h1 className="text-xl font-bold text-[#000000]">スケジュール</h1>

      {/* 週ナビゲーション */}
      <div className="flex items-center justify-between bg-white p-2 sm:p-3 rounded-lg border border-[#d9d9d9]">
        <button
          onClick={goToPreviousWeek}
          className="p-2.5 hover:bg-[#f0f0f0] rounded-lg transition-colors shrink-0"
          aria-label="前の週"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="text-center min-w-0">
          <p className="text-xs sm:text-sm font-bold text-[#000000]">
            {format(currentWeekStart, 'M/d', { locale: ja })}
            {' - '}
            {format(weekEnd, 'M/d', { locale: ja })}
          </p>
          <button
            onClick={goToThisWeek}
            className="text-xs text-[#ff5000] hover:underline mt-0.5"
          >
            今週に戻る
          </button>
        </div>
        <button
          onClick={goToNextWeek}
          className="p-2.5 hover:bg-[#f0f0f0] rounded-lg transition-colors shrink-0"
          aria-label="次の週"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 週間カレンダー */}
      <div className="space-y-2">
        {weekDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayBookings = bookingsByDay.get(key) ?? [];
          const today = isToday(day);

          return (
            <div
              key={key}
              className={`bg-white rounded-lg border ${
                today ? 'border-[#ff5000] ring-1 ring-[#ff5000]' : 'border-[#d9d9d9]'
              }`}
            >
              {/* 曜日ヘッダー */}
              <div
                className={`px-4 py-2 border-b ${
                  today ? 'bg-[#fff5f0] border-[#ff5000]/20' : 'bg-[#f0f0f0] border-[#d9d9d9]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${today ? 'text-[#ff5000]' : 'text-[#000000]'}`}>
                    {format(day, 'M/d (E)', { locale: ja })}
                  </span>
                  {today && (
                    <span className="px-2 py-0.5 text-xs bg-[#ff5000] text-white rounded-full font-bold">
                      今日
                    </span>
                  )}
                  <span className="text-xs text-[#606060] ml-auto">
                    {dayBookings.length}件
                  </span>
                </div>
              </div>

              {/* 予約一覧 */}
              <div className="p-2">
                {dayBookings.length === 0 ? (
                  <p className="text-xs text-[#606060] text-center py-2">予約なし</p>
                ) : (
                  <div className="space-y-1">
                    {dayBookings.map((booking) => {
                      const startTime = format(parseISO(booking.scheduled_at), 'HH:mm');
                      const endDate = new Date(
                        parseISO(booking.scheduled_at).getTime() +
                          booking.duration_minutes * 60 * 1000
                      );
                      const endTime = format(endDate, 'HH:mm');
                      const isExpanded = expandedBookingId === booking.id;

                      return (
                        <div
                          key={booking.id}
                          className="rounded hover:bg-[#f0f0f0] transition-colors cursor-pointer"
                          onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                        >
                          <div className="flex items-center gap-3 p-2">
                            <div className="min-w-[90px] text-sm font-bold text-[#000000]">
                              {startTime} - {endTime}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#000000] truncate font-medium">
                                {booking.customer_name}
                              </p>
                              <p className="text-xs text-[#606060]">{booking.store_name}</p>
                            </div>
                            {booking.booking_type === 'first_visit' && (
                              <span className="px-2 py-0.5 text-xs bg-[#fff5f0] text-[#ff5000] rounded-full font-bold shrink-0">
                                初回
                              </span>
                            )}
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#909090"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                          {isExpanded && (
                            <div className="px-2 pb-2 space-y-1 border-t border-[#f0f0f0] pt-2 sm:ml-[calc(90px+12px)]">
                              {booking.customer_phone && (
                                <div className="flex items-center gap-2 text-xs text-[#4d4d4d]">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                              <p className="text-xs text-[#606060]">
                                {booking.duration_minutes}分 / {booking.store_name}
                              </p>
                              {booking.notes && (
                                <div className="text-xs text-[#606060] bg-[#f8f8f8] p-1.5 rounded">
                                  <span className="font-bold">メモ: </span>{booking.notes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <HelpGuide steps={trainerScheduleGuide} pageTitle="スケジュール" />
    </div>
  );
}
