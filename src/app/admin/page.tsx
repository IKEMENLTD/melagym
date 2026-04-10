'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { adminFetch } from '@/lib/admin-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { adminDashboardGuide } from '@/lib/guide-data';
import { StatCardSkeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { AdminActionList } from '@/components/smart-ux/admin-action-list';

interface DashboardStats {
  todayBookings: number;
  weekBookings: number;
  monthBookings: number;
  activeTrainers: number;
  activeStores: number;
  cancelRate: number;
}

interface RecentBooking {
  id: string;
  customer_name: string;
  trainer_name: string;
  store_name: string;
  scheduled_at: string;
  status: string;
  booking_type: string;
}

/** 数字カウントアップアニメーション */
function CountUpNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const duration = 800;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{display}{suffix}</>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      adminFetch('/api/admin/stats').then((r) => {
        if (!r.ok) throw new Error('統計情報の取得に失敗しました');
        return r.json();
      }),
      adminFetch('/api/admin/bookings?limit=10').then((r) => {
        if (!r.ok) throw new Error('予約情報の取得に失敗しました');
        return r.json();
      }),
    ]).then(([statsData, bookingsData]) => {
      setStats(statsData);
      setRecentBookings(bookingsData.bookings ?? []);
    }).catch((err: Error) => {
      setError(err.message || 'データの取得に失敗しました');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="bg-white border border-[#d9d9d9]">
          <div className="px-6 py-4 border-b border-[#d9d9d9]">
            <div className="skeleton h-5 w-32" />
          </div>
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }, (_, i) => (
                <TableRowSkeleton key={i} cols={6} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[#ef4444] font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#ff5000] text-white text-sm font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all"
        >
          再読み込み
        </button>
      </div>
    );
  }

  const statCards = [
    { label: '本日の予約', value: stats?.todayBookings ?? 0, bg: 'bg-[#fff5f0]', text: 'text-[#ff5000]' },
    { label: '今週の予約', value: stats?.weekBookings ?? 0, bg: 'bg-[#f0fdf4]', text: 'text-[#22c55e]' },
    { label: '今月の予約', value: stats?.monthBookings ?? 0, bg: 'bg-[#fff5f0]', text: 'text-[#ff5000]' },
    { label: 'トレーナー', value: stats?.activeTrainers ?? 0, bg: 'bg-[#f0f0f0]', text: 'text-black' },
    { label: '店舗数', value: stats?.activeStores ?? 0, bg: 'bg-[#f0f0f0]', text: 'text-black' },
    { label: 'キャンセル率', value: `${(stats?.cancelRate ?? 0).toFixed(1)}%`, bg: 'bg-[#fef2f2]', text: 'text-[#ef4444]' },
  ];

  const statusLabels: Record<string, { label: string; className: string }> = {
    confirmed: { label: '確定', className: 'bg-[#f0fdf4] text-[#22c55e]' },
    cancelled: { label: 'キャンセル', className: 'bg-[#fef2f2] text-[#ef4444]' },
    completed: { label: '完了', className: 'bg-[#f0f0f0] text-[#4d4d4d]' },
    no_show: { label: '無断欠席', className: 'bg-[#fff5f0] text-[#ff5000]' },
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function copyText(text: string, key: string) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedPath(key);
        setTimeout(() => setCopiedPath(null), 2000);
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedPath(key);
      setTimeout(() => setCopiedPath(null), 2000);
    }
  }

  return (
    <div className="space-y-6 mela-bg-training">
      <h1 className="text-2xl font-bold text-black">ダッシュボード</h1>

      {/* 各種URL */}
      <div className="bg-[#fff5f0] border border-[#ff5000]/20 p-4 rounded-lg">
        <p className="text-sm font-bold text-black mb-2">各種ログインURL</p>
        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          {[
            { label: '管理画面', path: '/admin' },
            { label: 'トレーナー', path: '/trainer' },
            { label: '店舗管理', path: '/store' },
          ].map((item) => (
            <div key={item.path} className="flex items-center gap-2 bg-white border border-[#d9d9d9] px-3 py-2 rounded-lg min-w-0">
              <span className="text-[#606060] truncate flex-1 min-w-0">{item.label}: {baseUrl}{item.path}</span>
              <button
                onClick={() => copyText(`${baseUrl}${item.path}`, item.path)}
                className="text-[#ff5000] font-bold whitespace-nowrap hover:underline"
              >
                {copiedPath === item.path ? 'OK!' : 'コピー'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, index) => (
          <div
            key={card.label}
            className={`${card.bg} p-4`}
            style={{
              animation: `fade-in-scale 0.4s ease-out ${index * 0.08}s both`,
            }}
          >
            <p className={`text-xs font-medium ${card.text} opacity-70`}>{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.text}`}>
              {typeof card.value === 'number'
                ? <CountUpNumber value={card.value} />
                : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* 今日のアクションリスト */}
      <AdminActionList todayBookings={stats?.todayBookings ?? 0} />

      {/* 直近の予約 */}
      <div className="bg-white border border-[#d9d9d9]">
        <div className="px-6 py-4 border-b border-[#d9d9d9]">
          <h2 className="font-bold text-black">直近の予約</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f0f0f0]">
              <tr>
                <th className="text-left px-4 md:px-6 py-3 font-medium text-[#606060]">日時</th>
                <th className="text-left px-4 md:px-6 py-3 font-medium text-[#606060]">顧客</th>
                <th className="text-left px-4 md:px-6 py-3 font-medium text-[#606060] hidden md:table-cell">トレーナー</th>
                <th className="text-left px-4 md:px-6 py-3 font-medium text-[#606060] hidden lg:table-cell">店舗</th>
                <th className="text-left px-4 md:px-6 py-3 font-medium text-[#606060] hidden sm:table-cell">種別</th>
                <th className="text-left px-4 md:px-6 py-3 font-medium text-[#606060]">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {recentBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-[#f0f0f0]">
                  <td className="px-4 md:px-6 py-3 whitespace-nowrap">
                    {format(new Date(booking.scheduled_at), 'M/d HH:mm', { locale: ja })}
                  </td>
                  <td className="px-4 md:px-6 py-3">{booking.customer_name}</td>
                  <td className="px-4 md:px-6 py-3 hidden md:table-cell">{booking.trainer_name}</td>
                  <td className="px-4 md:px-6 py-3 hidden lg:table-cell">{booking.store_name}</td>
                  <td className="px-4 md:px-6 py-3 hidden sm:table-cell">
                    <span className="text-xs">
                      {booking.booking_type === 'first_visit' ? '体験' : '通常'}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-3">
                    <span className={`text-xs px-2 py-1 font-medium
                      ${statusLabels[booking.status]?.className ?? ''}`}>
                      {statusLabels[booking.status]?.label ?? booking.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 md:px-6 py-8 text-center text-[#606060]">
                    予約データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HelpGuide steps={adminDashboardGuide} pageTitle="ダッシュボード" />
    </div>
  );
}
