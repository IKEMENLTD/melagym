'use client';

interface SkeletonProps {
  className?: string;
}

/** 汎用スケルトンプレースホルダー */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** カード型スケルトン（店舗/トレーナー選択用） */
export function CardSkeleton() {
  return (
    <div className="w-full p-4 border-2 border-[#d9d9d9] rounded-lg space-y-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="skeleton w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/** テーブル行スケルトン */
export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-4 md:px-6 py-3">
          <div className="skeleton h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/** 統計カードスケルトン */
export function StatCardSkeleton() {
  return (
    <div className="bg-[#f0f0f0] p-4" aria-hidden="true">
      <div className="skeleton h-3 w-16 mb-2" />
      <div className="skeleton h-7 w-12" />
    </div>
  );
}
