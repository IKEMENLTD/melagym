'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { HelpGuide } from '@/components/ui/help-guide';
import { trainerRegisterGuide } from '@/lib/guide-data';

export default function TrainerRegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialties: '',
    bio: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError('お名前を入力してください'); return; }
    if (!form.email.trim()) { setError('メールアドレスを入力してください'); return; }
    if (!form.phone.trim()) { setError('電話番号を入力してください'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/trainer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          specialties: form.specialties.split(',').map(s => s.trim()).filter(Boolean),
          bio: form.bio.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '登録に失敗しました');
        return;
      }
      setSuccess(true);
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center p-4">
        <div className="bg-white p-8 w-full max-w-sm space-y-4 shadow-sm rounded-lg text-center">
          <div className="flex justify-center">
            <Image src="/images/mela-logo-dark.svg" alt="mela gym" width={140} height={79} />
          </div>
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-black">登録が完了しました</h2>
          <p className="text-sm text-[#606060]">
            管理者が確認後、ログインできるようになります。
          </p>
          <Link
            href="/trainer"
            className="block w-full py-3 bg-[#ff5000] text-black font-bold rounded-full hover:bg-[#e64800] transition-colors shadow-[0_4px_20px_rgba(255,80,0,0.4)]"
          >
            ログイン画面へ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 w-full max-w-sm space-y-4 shadow-sm rounded-lg">
        <div className="flex justify-center">
          <Image src="/images/mela-logo-dark.svg" alt="mela gym" width={140} height={79} />
        </div>
        <p className="text-center text-sm text-[#606060]">トレーナー新規登録</p>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
            お名前 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="山田 太郎"
            className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="example@email.com"
            className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
            電話番号 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="090-1234-5678"
            className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
            inputMode="tel"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#4d4d4d] mb-1">専門分野</label>
          <input
            type="text"
            value={form.specialties}
            onChange={(e) => setForm(p => ({ ...p, specialties: e.target.value }))}
            placeholder="ダイエット, 筋力トレーニング"
            className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
          />
          <p className="text-xs text-[#606060] mt-1">カンマ区切りで複数入力可</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#4d4d4d] mb-1">自己紹介</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm(p => ({ ...p, bio: e.target.value }))}
            placeholder="経歴やトレーニングへの想いなど"
            rows={3}
            className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-[#ff5000] text-black font-bold rounded-full hover:bg-[#e64800] transition-colors shadow-[0_4px_20px_rgba(255,80,0,0.4)] disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="mela-spinner-sm" />
              登録中...
            </span>
          ) : (
            '登録する'
          )}
        </button>

        <div className="text-center pt-2">
          <Link href="/trainer" className="text-sm text-[#606060] hover:text-black">
            ログイン画面に戻る
          </Link>
        </div>
      </form>

      <HelpGuide steps={trainerRegisterGuide} pageTitle="トレーナー新規登録" />
    </div>
  );
}
