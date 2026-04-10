'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { adminFetch } from '@/lib/admin-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { adminBookingsGuide } from '@/lib/guide-data';

interface BookingItem {
  id: string;
  customer_name: string;
  trainer_name: string;
  store_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booking_type: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

const PAGE_SIZE = 30;

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const loadBookings = useCallback((targetPage: number) => {
    setLoading(true);
    setError(null);
    adminFetch(`/api/admin/bookings?limit=${PAGE_SIZE}&page=${targetPage}`)
      .then((r) => {
        if (!r.ok) throw new Error('予約情報の取得に失敗しました');
        return r.json();
      })
      .then((data) => {
        setBookings(data.bookings ?? []);
        setPagination(data.pagination ?? null);
      })
      .catch((err: Error) => {
        setError(err.message || 'データの取得に失敗しました');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadBookings(page);
  }, [page, loadBookings]);

  const filteredBookings = bookings.filter((b) => {
    if (filter !== 'all' && b.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.customer_name.toLowerCase().includes(q) ||
        b.trainer_name.toLowerCase().includes(q) ||
        b.store_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleCancel(bookingId: string) {
    if (!confirm('この予約をキャンセルしますか？')) return;
    try {
      const res = await adminFetch(`/api/booking?id=${bookingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      const result = await res.json();
      if (result.success) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
        );
      }
    } catch {
      alert('キャンセル処理に失敗しました');
    }
  }

  async function handleStatusChange(bookingId: string, newStatus: string, currentStatus: string) {
    const statusLabelsMap: Record<string, string> = {
      completed: '完了',
      no_show: '無断欠席',
    };
    const label = statusLabelsMap[newStatus] ?? newStatus;
    if (!confirm(`この予約を「${label}」に変更しますか？`)) return;
    try {
      const res = await adminFetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookingId, status: newStatus, current_status: currentStatus }),
      });
      if (!res.ok) {
        const result = await res.json();
        alert(result.error || 'ステータスの更新に失敗しました');
        return;
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
    } catch {
      alert('ステータスの更新に失敗しました');
    }
  }

  const statusLabels: Record<string, { label: string; className: string }> = {
    confirmed: { label: '確定', className: 'bg-[#f0fdf4] text-[#22c55e]' },
    cancelled: { label: 'キャンセル', className: 'bg-[#fef2f2] text-[#ef4444]' },
    completed: { label: '完了', className: 'bg-[#f0f0f0] text-[#4d4d4d]' },
    no_show: { label: '無断欠席', className: 'bg-[#fff5f0] text-[#ff5000]' },
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="mela-spinner" />
        <p className="text-sm text-[#606060]">読み込み中...</p>
      </div>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[#ef4444] font-medium">{error}</p>
        <button
          onClick={() => loadBookings(page)}
          className="px-4 py-2 bg-[#ff5000] text-white text-sm font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 mela-bg-training">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black">予約一覧</h1>
        {pagination && (
          <p className="text-sm text-[#606060]">
            全{pagination.totalCount}件
          </p>
        )}
      </div>

      {/* フィルター */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="顧客名・トレーナー名・店舗名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-[#d9d9d9] text-sm"
        />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'confirmed', 'completed', 'cancelled', 'no_show'] as const).map((f) => {
            const labels: Record<string, string> = {
              all: '全て',
              confirmed: '確定',
              completed: '完了',
              cancelled: 'キャンセル',
              no_show: '無断欠席',
            };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 text-sm font-bold rounded-full transition-all
                  ${filter === f ? 'bg-[#ff5000] text-white' : 'bg-[#f0f0f0] text-[#4d4d4d] hover:bg-[#d9d9d9]'}`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white border border-[#d9d9d9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f0f0f0]">
              <tr>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060]">日時</th>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060]">顧客</th>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060] hidden md:table-cell">トレーナー</th>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060] hidden lg:table-cell">店舗</th>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060] hidden sm:table-cell">種別</th>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060]">状態</th>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {filteredBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-[#f0f0f0]">
                  <td className="px-3 md:px-6 py-3 whitespace-nowrap">
                    {format(new Date(booking.scheduled_at), 'M/d(E) HH:mm', { locale: ja })}
                  </td>
                  <td className="px-3 md:px-6 py-3 font-medium">{booking.customer_name}</td>
                  <td className="px-3 md:px-6 py-3 hidden md:table-cell">{booking.trainer_name}</td>
                  <td className="px-3 md:px-6 py-3 hidden lg:table-cell">{booking.store_name}</td>
                  <td className="px-3 md:px-6 py-3 hidden sm:table-cell">
                    <span className="text-xs">
                      {booking.booking_type === 'first_visit' ? '体験' : '通常'}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-3">
                    <span className={`text-xs px-2 py-1 font-medium
                      ${statusLabels[booking.status]?.className ?? ''}`}>
                      {statusLabels[booking.status]?.label ?? booking.status}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-3">
                    {booking.status === 'confirmed' && (
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => handleStatusChange(booking.id, 'completed', booking.status)}
                          className="text-xs text-[#22c55e] hover:text-[#16a34a] font-medium px-1.5 py-1 min-h-[32px]"
                        >
                          完了
                        </button>
                        <button
                          onClick={() => handleStatusChange(booking.id, 'no_show', booking.status)}
                          className="text-xs text-[#ff5000] hover:text-[#e64800] font-medium px-1.5 py-1 min-h-[32px]"
                        >
                          欠席
                        </button>
                        <button
                          onClick={() => handleCancel(booking.id)}
                          className="text-xs text-[#ef4444] hover:text-[#dc2626] font-medium px-1.5 py-1 min-h-[32px]"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 md:px-6 py-8 text-center text-[#606060]">
                    該当する予約がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 md:px-6 py-4 border-t border-[#d9d9d9]">
            <p className="text-sm text-[#606060]">
              {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, pagination.totalCount)} / {pagination.totalCount}件
            </p>
            <div className="flex gap-1 flex-wrap justify-center">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-[#d9d9d9] text-[#4d4d4d] hover:bg-[#f0f0f0] disabled:opacity-40 disabled:cursor-not-allowed hidden sm:block"
              >
                最初
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-2 min-h-[44px] text-sm border border-[#d9d9d9] text-[#4d4d4d] hover:bg-[#f0f0f0] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                前へ
              </button>
              <span className="px-3 py-2 min-h-[44px] flex items-center text-sm text-black font-medium">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-2 min-h-[44px] text-sm border border-[#d9d9d9] text-[#4d4d4d] hover:bg-[#f0f0f0] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                次へ
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-[#d9d9d9] text-[#4d4d4d] hover:bg-[#f0f0f0] disabled:opacity-40 disabled:cursor-not-allowed hidden sm:block"
              >
                最後
              </button>
            </div>
          </div>
        )}
      </div>
      <HelpGuide steps={adminBookingsGuide} pageTitle="予約一覧" />
    </div>
  );
}
