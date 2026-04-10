'use client';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

/**
 * 予約フォームのプログレスバー
 * Step 0: 25% / Step 1: 50% / Step 2: 75% / Step 3: 100%
 */
export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const percentage = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <div className="w-full px-4 pb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#606060]">進捗</span>
        <span className="text-[10px] font-bold text-[#ff5000]">{percentage}%</span>
      </div>
      <div className="w-full h-1 bg-[#f0f0f0] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#ff5000] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
