'use client';

import type { Store } from '@/types/database';

interface StoreSelectorProps {
  stores: Store[];
  selectedStoreId: string | null;
  previousStoreId?: string | null;
  onSelect: (storeId: string) => void;
  loading?: boolean;
}

export function StoreSelector({ stores, selectedStoreId, previousStoreId, onSelect, loading }: StoreSelectorProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-black">店舗を選択</h2>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="mela-spinner" role="status">
            <span className="sr-only">読み込み中</span>
          </div>
          <p className="text-sm text-[#606060]">読み込み中...</p>
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-[#606060]">
            現在、利用可能な店舗がありません
          </p>
          <p className="text-sm text-[#606060]">
            お手数ですが、LINEにてお問い合わせください。
          </p>
          <a
            href="https://line.me/R/ti/p/@melagym"
            className="inline-block mt-2 px-6 py-3 bg-[#06C755] text-white font-bold text-sm rounded-full min-h-[44px] leading-[20px]"
          >
            LINEで問い合わせる
          </a>
        </div>
      ) : (
        <div className="grid gap-3" role="radiogroup" aria-label="店舗一覧">
          {[...stores].sort((a, b) => {
            if (a.id === previousStoreId) return -1;
            if (b.id === previousStoreId) return 1;
            return 0;
          }).map((store) => {
            const isSelected = store.id === selectedStoreId;
            const isPrevious = store.id === previousStoreId;
            return (
              <button
                key={store.id}
                onClick={() => onSelect(store.id)}
                role="radio"
                aria-checked={isSelected}
                className={`
                  w-full text-left p-4 border-2 transition-all rounded-lg
                  min-h-[64px] active:scale-[0.98]
                  ${isSelected
                    ? 'border-[#ff5000] bg-[#fff5f0]'
                    : 'border-[#d9d9d9] bg-white hover:border-[#606060]'}
                `}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold truncate ${isSelected ? 'text-[#ff5000]' : 'text-black'}`}>
                        {store.name}
                      </p>
                      {isPrevious && (
                        <span className="text-xs bg-[#ff5000] text-white px-2 py-0.5">
                          前回利用
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#606060] mt-0.5">{store.area}</p>
                    {store.address && (
                      <p className="text-xs text-[#909090] mt-0.5 truncate">{store.address}</p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 bg-[#ff5000] rounded-full flex items-center justify-center flex-shrink-0" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
