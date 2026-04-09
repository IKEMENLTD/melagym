import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero section - full viewport */}
      <section
        className="relative flex items-center justify-center px-4"
        style={{
          backgroundImage: 'url(/images/bg-gym-entrance.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          minHeight: '100svh',
        }}
      >
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 max-w-md w-full flex flex-col items-center space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center space-y-3">
            <svg viewBox="0 0 100 100" fill="white" className="w-16 h-16 drop-shadow-lg">
              <path d="M50 90 C25 65, 0 45, 15 25 C25 12, 45 15, 50 30 C55 15, 75 12, 85 25 C100 45, 75 65, 50 90Z" />
            </svg>
            <h1 className="text-4xl font-bold tracking-tight mela-logo text-white">
              mela gym
            </h1>
            <p className="text-white/70 text-sm tracking-widest">PERSONAL TRAINING</p>
          </div>

          {/* CTA */}
          <div className="w-full flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="bg-white text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                今なら無料!
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
            </div>

            <Link
              href="/booking?type=first_visit"
              className="block w-full max-w-xs py-4 px-8 bg-[#ff5000] text-black text-center font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all tracking-wider text-lg shadow-xl"
            >
              体験セッションの予約
            </Link>

            <Link
              href="/booking?type=regular"
              className="block w-full max-w-xs py-4 px-8 bg-white/90 text-black text-center font-bold rounded-full hover:bg-white hover:scale-[1.02] transition-all tracking-wider shadow-lg"
            >
              2回目以降の予約
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="pt-8 animate-bounce">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" opacity="0.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </section>

      {/* Section 2 - Training photo */}
      <section
        className="relative flex items-center justify-center px-4"
        style={{
          backgroundImage: 'url(/images/bg-training.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          minHeight: '100svh',
        }}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 max-w-lg w-full text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mela-logo tracking-wide">
            完全個室<span className="text-[#ff5000]">.</span><br />
            あなただけの空間<span className="text-[#ff5000]">.</span>
          </h2>
          <p className="text-white/80 text-sm leading-relaxed max-w-sm mx-auto">
            経験豊富なトレーナーが<br />
            あなたに合ったプログラムをご提案します
          </p>
          <Link
            href="/booking?type=first_visit"
            className="inline-block py-4 px-10 bg-[#ff5000] text-black font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all tracking-wider shadow-xl"
          >
            無料体験を予約する
          </Link>
        </div>
      </section>

      {/* Section 3 - Tablet / Service */}
      <section
        className="relative flex items-center justify-center px-4"
        style={{
          backgroundImage: 'url(/images/bg-training2.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          minHeight: '100svh',
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
            className="inline-block py-4 px-10 bg-[#ff5000] text-black font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all tracking-wider shadow-xl"
          >
            今すぐ予約する
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-8 px-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" fill="#ff5000" className="w-6 h-6">
              <path d="M50 90 C25 65, 0 45, 15 25 C25 12, 45 15, 50 30 C55 15, 75 12, 85 25 C100 45, 75 65, 50 90Z" />
            </svg>
            <span className="text-white font-bold mela-logo tracking-wide">mela gym</span>
          </div>
          <Link
            href="/admin"
            className="text-white/40 text-xs hover:text-white/70 transition-colors"
          >
            管理画面
          </Link>
        </div>
      </footer>
    </div>
  );
}
