'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import type { Store, Trainer } from '@/types/database';

interface ActionItem {
  id: string;
  message: string;
  href: string;
  linkLabel: string;
  priority: 'high' | 'medium' | 'low';
}

interface TrainerWithStores extends Trainer {
  stores: { store_id: string; store_name: string }[];
}

interface AdminActionListProps {
  todayBookings: number;
}

/**
 * 管理ダッシュボード: 今日のアクションリスト
 * - 承認待ちトレーナー（カレンダー未連携）
 * - カレンダー未設定の店舗
 * - 今日の予約件数ハイライト
 */
export function AdminActionList({ todayBookings }: AdminActionListProps) {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const items: ActionItem[] = [];

    // 今日の予約件数アクション
    if (todayBookings > 0) {
      items.push({
        id: 'today-bookings',
        message: `今日は ${todayBookings} 件の予約があります`,
        href: '/admin/bookings',
        linkLabel: '予約一覧を見る',
        priority: todayBookings >= 10 ? 'high' : 'medium',
      });
    }

    // トレーナー・店舗情報を取得してアクション追加
    Promise.all([
      adminFetch('/api/admin/trainers')
        .then((r) => (r.ok ? r.json() : { trainers: [] }))
        .catch(() => ({ trainers: [] })),
      adminFetch('/api/admin/stores')
        .then((r) => (r.ok ? r.json() : { stores: [] }))
        .catch(() => ({ stores: [] })),
    ]).then(
      ([trainersData, storesData]: [
        { trainers?: TrainerWithStores[] },
        { stores?: Store[] },
      ]) => {
        const trainers = trainersData.trainers ?? [];
        const stores = storesData.stores ?? [];

        // カレンダー未連携のトレーナー
        const unlinkedTrainers = trainers.filter(
          (t) => t.is_active && !t.google_calendar_id
        );
        if (unlinkedTrainers.length > 0) {
          items.push({
            id: 'unlinked-trainers',
            message: `カレンダー未連携のトレーナーが ${unlinkedTrainers.length} 名います`,
            href: '/admin/trainers',
            linkLabel: 'トレーナー管理へ',
            priority: 'high',
          });
        }

        // カレンダー未設定の店舗
        const unlinkedStores = stores.filter(
          (s) => s.is_active && !s.google_calendar_id
        );
        if (unlinkedStores.length > 0) {
          items.push({
            id: 'unlinked-stores',
            message: `カレンダー未設定の店舗が ${unlinkedStores.length} 件あります`,
            href: '/admin/stores',
            linkLabel: '店舗管理へ',
            priority: 'high',
          });
        }

        // 非アクティブトレーナーがいる場合
        const inactiveTrainers = trainers.filter((t) => !t.is_active);
        if (inactiveTrainers.length > 0) {
          items.push({
            id: 'inactive-trainers',
            message: `承認待ちのトレーナーが ${inactiveTrainers.length} 名います`,
            href: '/admin/trainers',
            linkLabel: 'トレーナー管理へ',
            priority: 'high',
          });
        }

        setActions(items);
        setLoading(false);
      }
    );
  }, [todayBookings]);

  if (loading) {
    return (
      <div className="bg-white border border-[#d9d9d9] p-4">
        <div className="h-5 w-32 bg-[#f0f0f0] animate-pulse mb-3" />
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 bg-[#f0f0f0] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="bg-[#f0fdf4] border border-[#22c55e]/20 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#22c55e] rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[#22c55e]">すべて完了</p>
            <p className="text-xs text-[#606060]">対応が必要なアクションはありません</p>
          </div>
        </div>
      </div>
    );
  }

  const priorityColors = {
    high: { bg: 'bg-[#fff5f0]', border: 'border-[#ff5000]/20', dot: 'bg-[#ff5000]' },
    medium: { bg: 'bg-[#fffbeb]', border: 'border-[#f59e0b]/20', dot: 'bg-[#f59e0b]' },
    low: { bg: 'bg-[#f0f0f0]', border: 'border-[#d9d9d9]', dot: 'bg-[#909090]' },
  };

  return (
    <div className="bg-white border border-[#d9d9d9]">
      <div className="px-6 py-4 border-b border-[#d9d9d9]">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
          </svg>
          <h2 className="font-bold text-black">今日やること</h2>
          <span className="text-xs bg-[#ff5000] text-white px-2 py-0.5 rounded-full font-bold">
            {actions.length}
          </span>
        </div>
      </div>
      <div className="divide-y divide-[#f0f0f0]">
        {actions.map((action) => {
          const colors = priorityColors[action.priority];
          return (
            <div key={action.id} className={`px-6 py-4 ${colors.bg}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                  <p className="text-sm text-[#4d4d4d] truncate">{action.message}</p>
                </div>
                <Link
                  href={action.href}
                  className="text-xs font-bold text-[#ff5000] whitespace-nowrap hover:underline"
                >
                  {action.linkLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
