'use client';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="予約ステップ">
      <ol className="flex items-center justify-center gap-2 py-4 list-none m-0 p-0">
        {steps.map((label, i) => {
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;
          const stepStatus = isCompleted ? '完了' : isActive ? '現在' : '未完了';
          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                className={`flex flex-col items-center ${isCompleted && onStepClick ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => isCompleted && onStepClick?.(i)}
                disabled={!isCompleted}
                aria-label={`ステップ${i + 1}: ${label} (${stepStatus})${isCompleted ? ' - タップで戻る' : ''}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <div
                  className={`
                    w-8 h-8 flex items-center justify-center text-sm font-bold
                    transition-colors duration-200
                    ${isCompleted ? 'bg-[#ff5000] text-white' : ''}
                    ${isActive ? 'bg-[#ff5000] text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-[#d9d9d9] text-white' : ''}
                  `}
                >
                  {isCompleted ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs mt-1 whitespace-nowrap ${
                    isActive ? 'text-[#ff5000] font-bold' : isCompleted ? 'text-[#ff5000]' : 'text-[#d9d9d9]'
                  }`}
                >
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={`w-8 h-0.5 mb-5 ${
                    i < currentStep ? 'bg-[#ff5000]' : 'bg-[#d9d9d9]'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
