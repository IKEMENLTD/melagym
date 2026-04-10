'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { storeFetch } from '@/lib/store-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { storeBookingsGuide } from '@/lib/guide-data';

interface StoreBooking {
  id: string;
  customer_name: string;
  trainer_name: string;
  scheduled_at: string;
  duration_minutes: number;
  booking_type: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  confirmed: { label: '確定', className: 'bg-[#f0fdf4] text-[#22c55e]' },
  cancelled: { label: 'キャンセル', className: 'bg-[#fef2f2] text-[#ef4444]' },
  completed: { label: '完了', className: 'bg-[#f0f0f0] text-[#4d4d4d]' },
  no_show: { label: '無断欠席', className: 'bg-[#fff5f0] text-[#ff5000]' },
};

function getToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function StoreBookingsPage() {
  const [bookings, setBookings] = useState<StoreBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchBookings = useCallback(async (date?: string, status?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (status) params.set('status', status);

      const queryString = params.toString();
      const url = `/api/store/bookings${queryString ? `?${queryString}` : ''}`;
      const res = await storeFetch(url);

      if (!res.ok) throw new Error('予約一覧の取得に失敗しました');

      const data = (await res.json()) as { bookings: StoreBooking[] };
      setBookings(data.bookings ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '予約一覧の取得に失敗しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleFilterApply = useCallback(() => {
    fetchBookings(dateFilter || undefined, statusFilter || undefined);
  }, [dateFilter, statusFilter, fetchBookings]);

  const handleFilterReset = useCallback(() => {
    setDateFilter('');
    setStatusFilter('');
    fetchBookings();
  }, [fetchBookings]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-black">予約一覧</h1>

      {/* フィルター */}
      <div className="bg-white border border-[#d9d9d9] rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#606060] mb-1">日付</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#d9d9d9] text-sm text-[#4d4d4d]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[#606060] mb-1">
              ステータス
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#d9d9d9] text-sm text-[#4d4d4d] bg-white"
            >
              <option value="">すべて</option>
              <option value="confirmed">確定</option>
              <option value="cancelled">キャンセル</option>
              <option value="completed">完了</option>
              <option value="no_show">無断欠席</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleFilterApply}
              className="px-4 py-2 bg-[#ff5000] text-black text-sm font-bold rounded-full hover:bg-[#e64800] transition-colors shadow-[0_4px_20px_rgba(255,80,0,0.4)]"
            >
              検索
            </button>
            <button
              onClick={handleFilterReset}
              className="px-4 py-2 bg-[#f0f0f0] text-[#4d4d4d] text-sm font-bold rounded-full hover:bg-[#d9d9d9] transition-colors"
            >
              リセット
            </button>
          </div>
        </div>
      </div>

      {/* 予約テーブル */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="mela-spinner" />
          <span className="mela-loading-text">読み込み中...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 gap-4">
          <p className="text-[#ef4444] font-medium">{error}</p>
          <button
            onClick={() => fetchBookings(dateFilter || undefined, statusFilter || undefined)}
            className="px-4 py-2 bg-[#ff5000] text-black text-sm font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all shadow-[0_4px_20px_rgba(255,80,0,0.4)]"
          >
            再読み込み
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#d9d9d9] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f0f0f0]">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-[#606060]">
                    日時
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-[#606060]">
                    顧客
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-[#606060]">
                    トレーナー
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-[#606060]">
                    種別
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-[#606060]">
                    時間
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-[#606060]">
                    状態
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-[#f0f0f0]">
                    <td className="px-6 py-3 whitespace-nowrap">
                      {format(new Date(booking.scheduled_at), 'M/d (E) HH:mm', {
                        locale: ja,
                      })}
                    </td>
                    <td className="px-6 py-3">{booking.customer_name}</td>
                    <td className="px-6 py-3">{booking.trainer_name}</td>
                    <td className="px-6 py-3">
                      <span className="text-xs">
                        {booking.booking_type === 'first_visit' ? '体験' : '通常'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs text-[#606060]">
                        {booking.duration_minutes}分
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs px-2 py-1 font-medium ${
                          statusLabels[booking.status]?.className ?? ''
                        }`}
                      >
                        {statusLabels[booking.status]?.label ?? booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-[#606060]"
                    >
                      予約データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <HelpGuide steps={storeBookingsGuide} pageTitle="予約一覧" />
    </div>
  );
}
