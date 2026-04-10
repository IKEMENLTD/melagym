import Link from 'next/link';
import Image from 'next/image';
import { MarqueeBanner } from '@/components/ui/marquee-banner';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <MarqueeBanner />

      {/* Hero section - full viewport */}
      <section
        className="relative flex items-center justify-center px-4 parallax-section"
        style={{
          backgroundImage: 'url(/images/bg-gym-entrance.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '100svh',
        }}
      >
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 max-w-md w-full flex flex-col items-center space-y-6">
          {/* Logo */}
          <div className="flex flex-col items-center space-y-3">
            <Image
              src="/images/mela-logo.svg"
              alt="mela gym"
              width={240}
              height={135}
              priority
              className="drop-shadow-lg"
            />
            <p className="text-white/70 text-sm tracking-widest">PERSONAL TRAINING</p>
          </div>

          {/* CTA - First visit */}
          <div className="w-full flex flex-col items-center space-y-2">
            <div className="relative">
              <div className="bg-white text-black text-sm font-bold px-4 py-1.5 rounded-full shadow-lg">
                今なら無料!
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
            </div>

            <Link
              href="/booking?type=first_visit"
              className="w-full max-w-xs py-4 px-8 bg-[#ff5000] text-white text-center font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] active:scale-[0.98] transition-all tracking-wider text-xl shadow-[0_4px_20px_rgba(255,80,0,0.4)] min-h-[56px] flex items-center justify-center"
            >
              体験セッションの予約
            </Link>
            <p className="text-white/60 text-xs text-center">
              初めての方はこちら -- 無料で体験できます
            </p>
          </div>

          {/* CTA - Regular */}
          <div className="w-full flex flex-col items-center space-y-2">
            <Link
              href="/booking?type=regular"
              className="w-full max-w-xs py-4 px-8 border-2 border-white/80 text-white text-center font-bold rounded-full hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all tracking-wider text-lg min-h-[56px] flex items-center justify-center"
            >
              2回目以降の予約
            </Link>
            <p className="text-white/60 text-xs text-center">
              会員の方 / 体験済みの方
            </p>
          </div>

          {/* Scroll indicator */}
          <div className="pt-4 animate-bounce">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" opacity="0.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </section>

      {/* Section 2 - Booking steps (replaced decorative content) */}
      <section
        className="relative flex items-center justify-center px-4 parallax-section"
        style={{
          backgroundImage: 'url(/images/bg-training.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '100svh',
          contentVisibility: 'auto',
        }}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 max-w-lg w-full text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mela-logo tracking-wide">
            予約はたった3ステップ
          </h2>

          <div className="space-y-4 max-w-sm mx-auto">
            {[
              { num: '01', text: '店舗を選ぶ' },
              { num: '02', text: 'トレーナーを選ぶ' },
              { num: '03', text: '日時を選んで完了' },
            ].map((step) => (
              <div key={step.num} className="flex items-center gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                <span className="text-[#ff5000] font-bold text-2xl mela-logo w-10">{step.num}</span>
                <span className="text-white font-bold text-lg">{step.text}</span>
              </div>
            ))}
          </div>

          <Link
            href="/booking?type=first_visit"
            className="inline-block py-4 px-10 bg-[#ff5000] text-white font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] active:scale-[0.98] transition-all tracking-wider text-xl shadow-[0_4px_20px_rgba(255,80,0,0.4)] min-h-[56px]"
          >
            無料体験を予約する
          </Link>
        </div>
      </section>

      {/* Section 3 - Features / Why mela gym */}
      <section
        className="relative flex items-center justify-center px-4 parallax-section"
        style={{
          backgroundImage: 'url(/images/bg-training2.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '100svh',
          contentVisibility: 'auto',
        }}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 max-w-lg w-full text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mela-logo tracking-wide">
            完全個室<span className="text-[#ff5000]">.</span><br />
            あなただけの空間<span className="text-[#ff5000]">.</span>
          </h2>

          <div className="space-y-4 max-w-sm mx-auto">
            {[
              { label: '完全個室', desc: '周りの目を気にせず集中できる環境' },
              { label: '経験豊富なトレーナー', desc: 'あなたに合ったプログラムをご提案' },
              { label: 'かんたん予約', desc: 'スマホから3ステップで予約完了' },
            ].map((feature) => (
              <div key={feature.label} className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-left">
                <p className="text-white font-bold text-base">{feature.label}</p>
                <p className="text-white/70 text-sm mt-1">{feature.desc}</p>
              </div>
            ))}
          </div>

          <Link
            href="/booking?type=first_visit"
            className="inline-block py-4 px-10 bg-[#ff5000] text-white font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] active:scale-[0.98] transition-all tracking-wider text-xl shadow-[0_4px_20px_rgba(255,80,0,0.4)] min-h-[56px]"
          >
            今すぐ予約する
          </Link>
        </div>
      </section>

      <MarqueeBanner />

      {/* Footer */}
      <footer className="bg-black py-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex flex-col items-center gap-4">
            <Image
              src="/images/mela-logo.svg"
              alt="mela gym"
              width={100}
              height={56}
            />
          </div>

          {/* Staff links */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-white/30 text-xs text-center mb-3">スタッフ向け</p>
            <div className="flex justify-center gap-6">
              <Link
                href="/admin"
                className="text-white/40 text-xs hover:text-white/70 transition-colors"
              >
                管理画面
              </Link>
              <Link
                href="/trainer"
                className="text-white/40 text-xs hover:text-white/70 transition-colors"
              >
                トレーナー
              </Link>
              <Link
                href="/store"
                className="text-white/40 text-xs hover:text-white/70 transition-colors"
              >
                店舗管理
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
