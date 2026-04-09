'use client';

import type { Store } from '@/types/database';

interface StoreSelectorProps {
  stores: Store[];
  selectedStoreId: string | null;
  onSelect: (storeId: string) => void;
  loading?: boolean;
}

export function StoreSelector({ stores, selectedStoreId, onSelect, loading }: StoreSelectorProps) {
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
        <p className="text-center text-[#606060] py-12">
          利用可能な店舗がありません
        </p>
      ) : (
        <div className="grid gap-3" role="radiogroup" aria-label="店舗一覧">
          {stores.map((store) => {
            const isSelected = store.id === selectedStoreId;
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-bold ${isSelected ? 'text-[#ff5000]' : 'text-black'}`}>
                      {store.name}
                    </p>
                    <p className="text-sm text-[#606060] mt-0.5">{store.area}</p>
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
