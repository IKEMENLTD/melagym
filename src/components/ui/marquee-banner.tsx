'use client';

export function MarqueeBanner() {
  return (
    <div className="w-full overflow-hidden py-2 bg-white/80 backdrop-blur-sm">
      <div className="flex animate-marquee">
        <img src="/images/marquee-banner.webp" alt="mela gym" className="h-6 sm:h-8 min-w-max" />
        <img src="/images/marquee-banner.webp" alt="" className="h-6 sm:h-8 min-w-max" aria-hidden="true" />
      </div>
    </div>
  );
}
