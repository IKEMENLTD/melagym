'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  isTrainerLoggedIn,
  setTrainerSession,
  clearTrainerSession,
  getTrainerSession,
} from '@/lib/trainer-fetch';
import { MarqueeBanner } from '@/components/ui/marquee-banner';

interface NavIcon {
  paths: string[];
}

const NAV_ITEMS: { href: string; label: string; icon: NavIcon }[] = [
  {
    href: '/trainer',
    label: 'マイページ',
    icon: {
      paths: [
        'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      ],
    },
  },
  {
    href: '/trainer/schedule',
    label: 'スケジュール',
    icon: {
      paths: [
        'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      ],
    },
  },
  {
    href: '/trainer/profile',
    label: 'プロフィール',
    icon: {
      paths: [
        'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      ],
    },
  },
];

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [trainerName, setTrainerName] = useState('');

  useEffect(() => {
    const loggedIn = isTrainerLoggedIn();
    setAuthed(loggedIn);
    if (loggedIn) {
      const session = getTrainerSession();
      if (session) setTrainerName(session.name);
    }
    setChecking(false);
  }, []);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || submitting) return;

    setSubmitting(true);
    setAuthError('');

    try {
      const res = await fetch('/api/trainer/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim().toLowerCase(),
          password: passwordInput || undefined,
        }),
        credentials: 'same-origin',
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error ?? '認証に失敗しました');
        return;
      }

      setTrainerSession({
        email: data.trainer.email,
        id: data.trainer.id,
        name: data.trainer.name,
      });
      setTrainerName(data.trainer.name);
      setAuthed(true);
    } catch {
      setAuthError('通信エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }, [emailInput, submitting]);

  const handleLogout = useCallback(() => {
    clearTrainerSession();
    setAuthed(false);
    setTrainerName('');
    setEmailInput('');
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center">
        <div className="mela-loading">
          <div className="mela-spinner" />
          <span className="mela-loading-text">読み込み中...</span>
        </div>
      </div>
    );
  }

  // 新規登録ページはログインゲートをバイパス
  if (pathname === '/trainer/register') {
    return <>{children}</>;
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-6 sm:p-8 w-full max-w-sm space-y-4 shadow-sm rounded-lg">
          <div className="flex justify-center">
            <Image src="/images/mela-logo-dark.svg" alt="mela gym" width={140} height={79} />
          </div>
          <p className="text-center text-sm text-[#606060]">トレーナーログイン</p>
          <p className="text-center text-xs text-[#909090] leading-relaxed">
            登録済みのメールアドレスとパスワードを入力してください。
          </p>
          {authError && <p className="text-sm text-red-500 text-center">{authError}</p>}
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="メールアドレスを入力"
            className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
            required
            autoComplete="email"
          />
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="パスワードを入力"
            className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#ff5000] text-white font-bold rounded-full hover:bg-[#e64800] transition-colors shadow-[0_4px_20px_rgba(255,80,0,0.4)] disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="mela-spinner-sm" />
                ログイン中...
              </span>
            ) : (
              'ログイン'
            )}
          </button>
          <div className="text-center pt-2">
            <Link href="/trainer/register" className="text-sm text-[#ff5000] hover:underline">
              新規登録はこちら
            </Link>
          </div>
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
      <aside className="w-64 bg-white border-r border-[#d9d9d9] hidden md:block">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <Image
              src="/images/mela-logo-dark.svg"
              alt="mela gym"
              width={120}
              height={68}
            />
          </div>
          <p className="text-xs text-[#606060] mt-1">トレーナー画面</p>
          <p className="text-sm text-[#000000] font-bold mt-2">{trainerName}</p>
        </div>
        <nav className="px-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/trainer'
                ? pathname === '/trainer'
                : pathname.startsWith(item.href);
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
        <div className="px-3 mt-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[#4d4d4d] hover:bg-[#f0f0f0] w-full transition-colors"
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
              <span className="text-xs text-[#606060]">TRAINER</span>
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
          {mobileMenuOpen && (
            <nav className="px-3 pb-3 border-t border-[#d9d9d9]">
              <p className="px-3 py-2 text-sm font-bold text-[#000000]">{trainerName}</p>
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === '/trainer'
                    ? pathname === '/trainer'
                    : pathname.startsWith(item.href);
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
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[#4d4d4d] hover:bg-[#f0f0f0] w-full transition-colors"
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

        <MarqueeBanner />
        <main className="flex-1 p-3 md:p-4">{children}</main>
      </div>
    </div>
  );
}
