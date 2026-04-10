'use client';

import { useState, useEffect, useCallback } from 'react';
import { trainerFetch } from '@/lib/trainer-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { trainerProfileGuide } from '@/lib/guide-data';

interface TrainerProfileData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  specialties: string[];
  bio: string;
  available_hours: { start: string; end: string };
  has_calendar_linked: boolean;
}

export default function TrainerProfile() {
  const [profile, setProfile] = useState<TrainerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // フォーム state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [availableStart, setAvailableStart] = useState('09:00');
  const [availableEnd, setAvailableEnd] = useState('21:00');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await trainerFetch('/api/trainer/profile');
      if (!res.ok) {
        throw new Error('プロフィールの取得に失敗しました');
      }
      const data = await res.json();
      const t = data.trainer as TrainerProfileData;
      setProfile(t);
      setName(t.name ?? '');
      setPhone(t.phone ?? '');
      setSpecialties(Array.isArray(t.specialties) ? t.specialties.join(', ') : '');
      setBio(t.bio ?? '');
      setPhotoUrl(t.photo_url ?? '');
      setAvailableStart(t.available_hours?.start ?? '09:00');
      setAvailableEnd(t.available_hours?.end ?? '21:00');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;

      setSaving(true);
      setError('');

      try {
        const specialtiesArray = specialties
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const res = await trainerFetch('/api/trainer/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            specialties: specialtiesArray,
            bio: bio.trim(),
            photo_url: photoUrl.trim(),
            available_hours: {
              start: availableStart,
              end: availableEnd,
            },
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? '保存に失敗しました');
        }

        showToast('プロフィールを保存しました');
      } catch (err) {
        const message = err instanceof Error ? err.message : '保存に失敗しました';
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [saving, name, phone, specialties, bio, photoUrl, availableStart, availableEnd, showToast]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="mela-loading">
          <div className="mela-spinner" />
          <span className="mela-loading-text">読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!profile && error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <button
          onClick={fetchProfile}
          className="px-6 py-2 bg-[#ff5000] text-white font-bold rounded-full hover:bg-[#e64800] transition-colors"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-[#000000]">プロフィール編集</h1>

      {/* トースト通知 */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#22c55e] text-white px-6 py-3 rounded-lg shadow-lg text-sm font-bold animate-fade-in">
          {toast}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* 名前 */}
        <div className="bg-white p-4 rounded-lg border border-[#d9d9d9] space-y-4">
          <h2 className="text-sm font-bold text-[#000000]">基本情報</h2>

          <div>
            <label htmlFor="name" className="block text-xs text-[#606060] mb-1">
              名前
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs text-[#606060] mb-1">
              メールアドレス (変更不可)
            </label>
            <input
              id="email"
              type="email"
              value={profile?.email ?? ''}
              className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg bg-[#f0f0f0] text-[#606060]"
              disabled
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-xs text-[#606060] mb-1">
              電話番号
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
              placeholder="090-1234-5678"
            />
          </div>
        </div>

        {/* プロフィール詳細 */}
        <div className="bg-white p-4 rounded-lg border border-[#d9d9d9] space-y-4">
          <h2 className="text-sm font-bold text-[#000000]">プロフィール詳細</h2>

          <div>
            <label htmlFor="photoUrl" className="block text-xs text-[#606060] mb-1">
              プロフィール写真URL
            </label>
            <input
              id="photoUrl"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
              placeholder="https://example.com/photo.jpg"
            />
            {photoUrl && (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt="プロフィール写真プレビュー"
                  className="w-20 h-20 rounded-full object-cover border border-[#d9d9d9]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="specialties" className="block text-xs text-[#606060] mb-1">
              専門分野 (カンマ区切り)
            </label>
            <input
              id="specialties"
              type="text"
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
              className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
              placeholder="ダイエット, 筋力トレーニング, ストレッチ"
            />
          </div>

          <div>
            <label htmlFor="bio" className="block text-xs text-[#606060] mb-1">
              自己紹介
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg resize-none"
              rows={4}
              placeholder="トレーニング歴やメッセージなど"
            />
          </div>
        </div>

        {/* 対応可能時間帯 */}
        <div className="bg-white p-4 rounded-lg border border-[#d9d9d9] space-y-4">
          <h2 className="text-sm font-bold text-[#000000]">対応可能時間帯</h2>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label htmlFor="availableStart" className="block text-xs text-[#606060] mb-1">
                開始時刻
              </label>
              <input
                id="availableStart"
                type="time"
                value={availableStart}
                onChange={(e) => setAvailableStart(e.target.value)}
                className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
              />
            </div>
            <span className="text-[#606060] mt-5">~</span>
            <div className="flex-1">
              <label htmlFor="availableEnd" className="block text-xs text-[#606060] mb-1">
                終了時刻
              </label>
              <input
                id="availableEnd"
                type="time"
                value={availableEnd}
                onChange={(e) => setAvailableEnd(e.target.value)}
                className="w-full px-4 py-3 border border-[#d9d9d9] text-sm rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* お客様からの見え方プレビュー */}
        <div className="bg-white p-4 rounded-lg border border-[#d9d9d9] space-y-3">
          <h2 className="text-sm font-bold text-[#000000]">お客様からの見え方</h2>
          <p className="text-xs text-[#909090]">予約画面でお客様にはこのように表示されます</p>
          <div className="border border-[#e5e5e5] rounded-lg p-4 bg-[#fafafa]">
            <div className="flex items-start gap-4">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="プレビュー"
                  className="w-16 h-16 rounded-full object-cover border border-[#d9d9d9] shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#e5e5e5] flex items-center justify-center shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#909090" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-[#000000]">{name || '(名前未設定)'}</p>
                {specialties && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {specialties.split(',').map((s) => s.trim()).filter(Boolean).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-[#f0f0f0] text-[#4d4d4d] rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {bio && (
                  <p className="text-xs text-[#606060] mt-2 line-clamp-3">{bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 保存ボタン */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#ff5000] text-white font-bold rounded-full hover:bg-[#e64800] transition-colors shadow-[0_4px_20px_rgba(255,80,0,0.4)] disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="mela-spinner-sm" />
              保存中...
            </span>
          ) : (
            '保存する'
          )}
        </button>
      </form>

      <HelpGuide steps={trainerProfileGuide} pageTitle="プロフィール編集" />
    </div>
  );
}
