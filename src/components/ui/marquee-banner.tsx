'use client';

export function MarqueeBanner() {
  return (
    <div className="w-full overflow-hidden py-1.5 border-y border-[#f0f0f0]">
      <div className="flex animate-marquee whitespace-nowrap">
        <img src="/images/marquee-banner.webp" alt="mela gym" className="h-5 sm:h-6 w-auto flex-shrink-0" draggable={false} />
        <img src="/images/marquee-banner.webp" alt="" className="h-5 sm:h-6 w-auto flex-shrink-0" aria-hidden="true" draggable={false} />
      </div>
    </div>
  );
}
