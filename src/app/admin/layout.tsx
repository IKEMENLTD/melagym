'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavIcon {
  paths: string[];
}

const NAV_ITEMS: { href: string; label: string; icon: NavIcon }[] = [
  {
    href: '/admin',
    label: '予約管理',
    icon: {
      paths: [
        'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      ],
    },
  },
  {
    href: '/admin/trainers',
    label: 'トレーナー',
    icon: {
      paths: [
        'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
        'M9 7a4 4 0 100-8 4 4 0 000 8',
        'M23 21v-2a4 4 0 00-3-3.87',
        'M16 3.13a4 4 0 010 7.75',
      ],
    },
  },
  {
    href: '/admin/stores',
    label: '店舗',
    icon: {
      paths: [
        'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      ],
    },
  },
  {
    href: '/admin/bookings',
    label: '予約一覧',
    icon: {
      paths: [
        'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      ],
    },
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function renderNavIcon(icon: NavIcon) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f0f0] flex">
      {/* サイドバー (デスクトップ) */}
      <aside className="w-64 bg-white border-r border-[#d9d9d9] hidden md:block">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" fill="#ff5000" className="w-6 h-6">
              <path d="M50 90 C25 65, 0 45, 15 25 C25 12, 45 15, 50 30 C55 15, 75 12, 85 25 C100 45, 75 65, 50 90Z" />
            </svg>
            <h1 className="text-xl font-bold text-black mela-logo">mela gym</h1>
          </div>
          <p className="text-xs text-[#606060] mt-1 ml-8">管理画面</p>
        </div>
        <nav className="px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 mb-1 text-sm font-medium transition-colors
                  ${isActive ? 'bg-[#fff5f0] text-[#ff5000]' : 'text-[#4d4d4d] hover:bg-[#f0f0f0]'}`}
              >
                {renderNavIcon(item.icon)}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* メイン */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* モバイルヘッダー */}
        <header className="bg-white border-b border-[#d9d9d9] md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 100 100" fill="#ff5000" className="w-5 h-5">
                <path d="M50 90 C25 65, 0 45, 15 25 C25 12, 45 15, 50 30 C55 15, 75 12, 85 25 C100 45, 75 65, 50 90Z" />
              </svg>
              <h1 className="text-lg font-bold text-black mela-logo">mela gym</h1>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#4d4d4d] hover:text-black"
              aria-label="メニューを開く"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
          {/* モバイルナビゲーション (展開時) */}
          {mobileMenuOpen && (
            <nav className="px-3 pb-3 border-t border-[#d9d9d9]">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 mb-1 text-sm font-medium transition-colors
                      ${isActive ? 'bg-[#fff5f0] text-[#ff5000]' : 'text-[#4d4d4d] hover:bg-[#f0f0f0]'}`}
                  >
                    {renderNavIcon(item.icon)}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
