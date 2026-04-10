'use client';

const REPEAT_COUNT = 12;
const TEXT = 'mela gym';

export function MarqueeBanner() {
  const items = Array.from({ length: REPEAT_COUNT }, (_, i) => i);

  return (
    <div className="w-full overflow-hidden py-1.5 border-y border-[#f0f0f0] bg-white">
      <div className="flex animate-marquee">
        {/* 2セット分（後半は前半と同じ。-50%のtranslateXでシームレスループ） */}
        {[0, 1].map((set) => (
          <div key={set} className="flex shrink-0">
            {items.map((i) => (
              <span
                key={`${set}-${i}`}
                className="text-[#ff5000] font-bold text-sm sm:text-base whitespace-nowrap px-6 sm:px-10 mela-logo"
                aria-hidden={set === 1 || i > 0}
              >
                {TEXT}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
