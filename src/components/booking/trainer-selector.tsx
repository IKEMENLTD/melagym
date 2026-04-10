'use client';

import type { Trainer } from '@/types/database';

interface TrainerSelectorProps {
  trainers: Trainer[];
  selectedTrainerId: string | null;
  previousTrainerId?: string | null;
  onSelect: (trainerId: string) => void;
  showAutoOption?: boolean;
  loading?: boolean;
}

export function TrainerSelector({
  trainers,
  selectedTrainerId,
  previousTrainerId,
  onSelect,
  showAutoOption = true,
  loading,
}: TrainerSelectorProps) {
  const sortedTrainers = [...trainers].sort((a, b) => {
    // 前回のトレーナーを最上位に
    if (a.id === previousTrainerId) return -1;
    if (b.id === previousTrainerId) return 1;
    return 0;
  });

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-black">トレーナーを選択</h2>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="mela-spinner" role="status">
            <span className="sr-only">読み込み中</span>
          </div>
          <p className="text-sm text-[#606060]">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (trainers.length === 0 && !showAutoOption) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-black">トレーナーを選択</h2>
        <div className="text-center py-12 space-y-3">
          <p className="text-[#606060]">
            この店舗で利用可能なトレーナーがいません
          </p>
          <p className="text-sm text-[#606060]">
            別の店舗を選択するか、LINEにてお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-black">トレーナーを選択</h2>

      {/* おまかせオプション */}
      {showAutoOption && (
        <button
          onClick={() => onSelect('auto')}
          role="radio"
          aria-checked={selectedTrainerId === 'auto'}
          className={`
            w-full text-left p-4 border-2 transition-all rounded-lg
            min-h-[64px] active:scale-[0.98]
            ${selectedTrainerId === 'auto'
              ? 'border-[#ff5000] bg-[#fff5f0]'
              : 'border-[#d9d9d9] bg-white hover:border-[#606060]'}
          `}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#ff5000] rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="flex-1">
              <p className={`font-bold ${selectedTrainerId === 'auto' ? 'text-[#ff5000]' : 'text-black'}`}>
                おまかせ
              </p>
              <p className="text-xs text-[#606060]">空き状況に合わせて最適なトレーナーをご案内</p>
            </div>
            {selectedTrainerId === 'auto' && (
              <div className="w-6 h-6 bg-[#ff5000] rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>
        </button>
      )}

      {/* トレーナー一覧 */}
      <div className="grid gap-3" role="radiogroup" aria-label="トレーナー一覧">
        {sortedTrainers.map((trainer) => {
          const isSelected = trainer.id === selectedTrainerId;
          const isPrevious = trainer.id === previousTrainerId;
          return (
            <button
              key={trainer.id}
              onClick={() => onSelect(trainer.id)}
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
              <div className="flex items-center gap-3">
                {/* トレーナー写真 */}
                <div className="w-12 h-12 bg-[#f0f0f0] rounded-full flex-shrink-0 overflow-hidden">
                  {trainer.photo_url ? (
                    <img
                      src={trainer.photo_url}
                      alt={trainer.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#606060] font-bold text-lg">
                      {trainer.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-bold ${isSelected ? 'text-[#ff5000]' : 'text-black'}`}>
                      {trainer.name}
                    </p>
                    {isPrevious && (
                      <span className="text-xs bg-[#ff5000] text-white px-2 py-0.5">
                        前回担当
                      </span>
                    )}
                  </div>
                  {trainer.specialties.length > 0 && (
                    <p className="text-xs text-[#606060] mt-0.5 truncate">
                      {trainer.specialties.join(' / ')}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <div className="w-6 h-6 bg-[#ff5000] rounded-full flex items-center justify-center flex-shrink-0">
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
    </div>
  );
}
