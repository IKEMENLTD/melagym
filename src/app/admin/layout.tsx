'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isLoggedIn, setAdminToken, clearAdminToken } from '@/lib/admin-fetch';

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
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [authError, setAuthError] = useState(false);

  function handleLogout() {
    clearAdminToken();
    setAuthed(false);
    setTokenInput('');
  }

  useEffect(() => {
    setAuthed(isLoggedIn());
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setAuthError(false);

    // サーバー側でトークンを検証してからログイン状態にする
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenInput.trim()}`,
        },
      });
      if (!res.ok) {
        setAuthError(true);
        return;
      }
      setAdminToken(tokenInput.trim());
      setAuthed(true);
    } catch {
      setAuthError(true);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 w-full max-w-sm space-y-4 shadow-sm">
          <div className="flex justify-center">
            <Image src="/images/mela-logo-dark.svg" alt="mela gym" width={140} height={79} />
          </div>
          <p className="text-center text-sm text-[#606060]">管理画面ログイン</p>
          {authError && (
            <p className="text-sm text-red-500 text-center">
              パスワードが正しくありません。再度お試しください。
            </p>
          )}
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="パスワードを入力"
            autoComplete="current-password"
            className="w-full px-4 py-3 border border-[#d9d9d9] text-sm"
          />
          <button
            type="submit"
            className="w-full py-3 bg-[#ff5000] text-black font-bold rounded-full hover:bg-[#e64800] transition-colors"
          >
            ログイン
          </button>
        </form>
      </div>
    );
  }

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
      <aside className="w-64 bg-white border-r border-[#d9d9d9] hidden md:flex md:flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <Image
              src="/images/mela-logo-dark.svg"
              alt="mela gym"
              width={120}
              height={68}
            />
          </div>
          <p className="text-xs text-[#606060] mt-1">管理画面</p>
        </div>
        <nav className="px-3 flex-1">
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
        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-[#4d4d4d] hover:bg-[#fef2f2] hover:text-[#ef4444] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            ログアウト
          </button>
        </div>
      </aside>

      {/* メイン */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* モバイルヘッダー */}
        <header className="bg-white border-b border-[#d9d9d9] md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Image
                src="/images/mela-logo-dark.svg"
                alt="mela gym"
                width={100}
                height={56}
              />
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
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-[#4d4d4d] hover:bg-[#fef2f2] hover:text-[#ef4444] transition-colors mt-2 border-t border-[#d9d9d9] pt-3"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                ログアウト
              </button>
            </nav>
          )}
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
