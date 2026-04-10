'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Trainer, Store } from '@/types/database';
import { adminFetch } from '@/lib/admin-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { adminTrainersGuide } from '@/lib/guide-data';

interface TrainerWithStores extends Trainer {
  stores: { store_id: string; store_name: string }[];
}

interface AddTrainerForm {
  name: string;
  email: string;
  phone: string;
  specialties: string;
  bio: string;
  is_first_visit_eligible: boolean;
  google_calendar_id: string;
  store_ids: string[];
}

const INITIAL_FORM: AddTrainerForm = {
  name: '',
  email: '',
  phone: '',
  specialties: '',
  bio: '',
  is_first_visit_eligible: false,
  google_calendar_id: '',
  store_ids: [],
};

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<TrainerWithStores[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<AddTrainerForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      adminFetch('/api/admin/trainers').then((r) => {
        if (!r.ok) throw new Error('トレーナー情報の取得に失敗しました');
        return r.json();
      }),
      fetch('/api/stores').then((r) => {
        if (!r.ok) throw new Error('店舗情報の取得に失敗しました');
        return r.json();
      }),
    ]).then(([trainersData, storesData]) => {
      setTrainers(trainersData.trainers ?? []);
      setStores(storesData.stores ?? []);
    }).catch((err: Error) => {
      setError(err.message || 'データの取得に失敗しました');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleFirstVisit(trainerId: string, currentValue: boolean) {
    setTogglingIds((prev) => new Set(prev).add(`fv-${trainerId}`));
    try {
      const res = await adminFetch('/api/admin/trainers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trainerId, is_first_visit_eligible: !currentValue }),
      });
      if (!res.ok) throw new Error();
      setTrainers((prev) =>
        prev.map((t) =>
          t.id === trainerId ? { ...t, is_first_visit_eligible: !currentValue } : t
        )
      );
    } catch {
      alert('更新に失敗しました');
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(`fv-${trainerId}`); return s; });
    }
  }

  async function toggleActive(trainerId: string, currentValue: boolean) {
    setTogglingIds((prev) => new Set(prev).add(`ac-${trainerId}`));
    try {
      const res = await adminFetch('/api/admin/trainers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trainerId, is_active: !currentValue }),
      });
      if (!res.ok) throw new Error();
      setTrainers((prev) =>
        prev.map((t) =>
          t.id === trainerId ? { ...t, is_active: !currentValue } : t
        )
      );
    } catch {
      alert('更新に失敗しました');
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(`ac-${trainerId}`); return s; });
    }
  }

  async function handleAddTrainer(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError('名前は必須です');
      return;
    }
    if (!form.email.trim()) {
      setFormError('メールアドレスは必須です');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminFetch('/api/admin/trainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          specialties: form.specialties
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          bio: form.bio.trim(),
          is_first_visit_eligible: form.is_first_visit_eligible,
          google_calendar_id: form.google_calendar_id.trim() || null,
          store_ids: form.store_ids,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setFormError(result.error || '登録に失敗しました');
        return;
      }
      setShowAddForm(false);
      setForm(INITIAL_FORM);
      loadData();
    } catch {
      setFormError('通信エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  function handleStoreToggle(storeId: string) {
    setForm((prev) => ({
      ...prev,
      store_ids: prev.store_ids.includes(storeId)
        ? prev.store_ids.filter((id) => id !== storeId)
        : [...prev.store_ids, storeId],
    }));
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="mela-spinner" />
        <p className="text-sm text-[#606060]">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[#ef4444] font-medium">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-[#ff5000] text-black text-sm font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all">
          再読み込み
        </button>
      </div>
    );
  }

  const firstVisitCount = trainers.filter((t) => t.is_first_visit_eligible && t.is_active).length;

  function copyUrl(url: string, label: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6">
      {/* 招待URL */}
      <div className="bg-[#fff5f0] border border-[#ff5000]/20 p-4 rounded-lg">
        <p className="text-sm font-bold text-black mb-2">トレーナー招待URL</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white border border-[#d9d9d9] px-3 py-2 rounded-lg">
            <span className="text-xs text-[#606060] truncate flex-1">{baseUrl}/trainer/register</span>
            <button
              onClick={() => copyUrl(`${baseUrl}/trainer/register`, 'register')}
              className="text-xs text-[#ff5000] font-bold whitespace-nowrap hover:underline"
            >
              {copied === 'register' ? 'コピー済み' : 'コピー'}
            </button>
          </div>
          <div className="flex-1 flex items-center gap-2 bg-white border border-[#d9d9d9] px-3 py-2 rounded-lg">
            <span className="text-xs text-[#606060] truncate flex-1">{baseUrl}/trainer</span>
            <button
              onClick={() => copyUrl(`${baseUrl}/trainer`, 'login')}
              className="text-xs text-[#ff5000] font-bold whitespace-nowrap hover:underline"
            >
              {copied === 'login' ? 'コピー済み' : 'コピー'}
            </button>
          </div>
        </div>
        <p className="text-xs text-[#606060] mt-2">登録URLをトレーナーに送ると自分で登録できます。登録後に稼働トグルをONにしてください。ログインURLは登録済みトレーナー用です。</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">トレーナー管理</h1>
          <p className="text-sm text-[#606060] mt-1">
            {trainers.filter((t) => t.is_active).length}名 稼働中 / 初回対応 {firstVisitCount}名
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 bg-[#ff5000] text-black text-sm font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all"
        >
          + トレーナー追加
        </button>
      </div>

      {/* トレーナー追加モーダル */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d9d9d9]">
              <h2 className="font-bold text-black text-lg">トレーナー追加</h2>
              <button
                onClick={() => { setShowAddForm(false); setForm(INITIAL_FORM); setFormError(null); }}
                className="text-[#606060] hover:text-black text-xl leading-none"
              >
                x
              </button>
            </div>
            <form onSubmit={handleAddTrainer} className="p-6 space-y-4">
              {formError && (
                <div className="bg-[#fef2f2] text-[#ef4444] text-sm px-4 py-3">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  名前 <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="山田 太郎"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  メールアドレス <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="trainer@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">電話番号</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="090-1234-5678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  専門分野（カンマ区切り）
                </label>
                <input
                  type="text"
                  value={form.specialties}
                  onChange={(e) => setForm((p) => ({ ...p, specialties: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="パーソナルトレーニング, ヨガ, ピラティス"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">自己紹介</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm resize-none"
                  placeholder="トレーナーの紹介文"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  Google Calendar ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.google_calendar_id}
                  onChange={(e) => setForm((p) => ({ ...p, google_calendar_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="トレーナーのGmailアドレス or カレンダーID"
                />
                <div className="mt-2 bg-[#f0f0f0] p-3 text-xs text-[#4d4d4d] space-y-1.5">
                  <p className="font-bold">トレーナーのCalendar ID:</p>
                  <p>通常はトレーナーのGmailアドレスがそのままIDです</p>
                  <p className="pt-1.5 font-bold">トレーナー側で必要な共有設定:</p>
                  <p>Googleカレンダー →「設定と共有」→「特定のユーザーとの共有」に以下を追加:</p>
                  <div className="flex items-center gap-1 bg-white border border-[#d9d9d9] px-2 py-1 mt-1 min-w-0">
                    <span className="flex-1 select-all text-[10px] break-all min-w-0">melagym@instagram-generator-472905.iam.gserviceaccount.com</span>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText('melagym@instagram-generator-472905.iam.gserviceaccount.com'); }}
                      className="text-[#ff5000] font-bold whitespace-nowrap flex-shrink-0"
                    >コピー</button>
                  </div>
                  <p>権限:「予定の表示（空き時間情報のみ）」</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-2">対応店舗</label>
                <div className="flex flex-wrap gap-2">
                  {stores.map((store) => (
                    <label
                      key={store.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border transition-colors
                        ${form.store_ids.includes(store.id)
                          ? 'bg-[#fff5f0] border-[#ff5000] text-[#ff5000]'
                          : 'bg-[#f0f0f0] border-[#d9d9d9] text-[#4d4d4d] hover:bg-[#d9d9d9]'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.store_ids.includes(store.id)}
                        onChange={() => handleStoreToggle(store.id)}
                        className="sr-only"
                      />
                      {store.name}
                    </label>
                  ))}
                  {stores.length === 0 && (
                    <p className="text-sm text-[#606060]">
                      店舗が登録されていません。先に
                      <a href="/admin/stores" className="text-[#ff5000] font-medium hover:underline">店舗管理</a>
                      から店舗を追加してください。
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, is_first_visit_eligible: !p.is_first_visit_eligible }))}
                  className={`w-10 h-6 rounded-full transition-colors relative
                    ${form.is_first_visit_eligible ? 'bg-[#ff5000]' : 'bg-[#d9d9d9]'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm
                    ${form.is_first_visit_eligible ? 'left-[18px]' : 'left-0.5'}`}
                  />
                </button>
                <span className="text-sm text-[#4d4d4d]">初回体験対応可能</span>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#d9d9d9]">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setForm(INITIAL_FORM); setFormError(null); }}
                  className="flex-1 py-2.5 text-sm font-medium text-[#4d4d4d] bg-[#f0f0f0] rounded-full hover:bg-[#d9d9d9] transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 text-sm font-bold text-black bg-[#ff5000] rounded-full hover:bg-[#e64800] hover:scale-[1.02] disabled:opacity-50 transition-all"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="mela-spinner-sm" />
                      登録中...
                    </span>
                  ) : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* トレーナー一覧 */}
      <div className="bg-white border border-[#d9d9d9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f0f0f0]">
              <tr>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060]">名前</th>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060] hidden sm:table-cell">専門</th>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060] hidden lg:table-cell">対応店舗</th>
                <th className="text-left px-3 md:px-6 py-3 font-medium text-[#606060] hidden md:table-cell">カレンダー</th>
                <th className="text-center px-3 md:px-6 py-3 font-medium text-[#606060]">初回対応</th>
                <th className="text-center px-3 md:px-6 py-3 font-medium text-[#606060]">稼働</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {trainers.map((trainer) => (
                <tr key={trainer.id} className={`hover:bg-[#f0f0f0] ${!trainer.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-3 md:px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#f0f0f0] flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#606060]">
                        {trainer.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-black">{trainer.name}</p>
                        <p className="text-xs text-[#606060] truncate">{trainer.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-3 hidden sm:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {trainer.specialties.map((s) => (
                        <span key={s} className="text-xs bg-[#f0f0f0] text-[#4d4d4d] px-2 py-0.5">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-3 hidden lg:table-cell">
                    <p className="text-xs text-[#606060]">
                      {trainer.stores?.map((s) => s.store_name).join(', ') || '-'}
                    </p>
                  </td>
                  <td className="px-3 md:px-6 py-3 hidden md:table-cell">
                    {trainer.google_calendar_id ? (
                      <span className="text-xs text-[#22c55e] font-medium">連携済み</span>
                    ) : (
                      <span className="text-xs text-[#ef4444] font-medium">未連携</span>
                    )}
                  </td>
                  <td className="px-3 md:px-6 py-3 text-center">
                    {togglingIds.has(`fv-${trainer.id}`) ? (
                      <div className="flex justify-center"><div className="mela-spinner-sm" /></div>
                    ) : (
                      <button
                        onClick={() => toggleFirstVisit(trainer.id, trainer.is_first_visit_eligible)}
                        className={`w-10 h-6 rounded-full transition-colors relative
                          ${trainer.is_first_visit_eligible ? 'bg-[#ff5000]' : 'bg-[#d9d9d9]'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm
                          ${trainer.is_first_visit_eligible ? 'left-[18px]' : 'left-0.5'}`}
                        />
                      </button>
                    )}
                  </td>
                  <td className="px-3 md:px-6 py-3 text-center">
                    {togglingIds.has(`ac-${trainer.id}`) ? (
                      <div className="flex justify-center"><div className="mela-spinner-sm" /></div>
                    ) : (
                      <button
                        onClick={() => toggleActive(trainer.id, trainer.is_active)}
                        className={`w-10 h-6 rounded-full transition-colors relative
                          ${trainer.is_active ? 'bg-[#22c55e]' : 'bg-[#d9d9d9]'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm
                          ${trainer.is_active ? 'left-[18px]' : 'left-0.5'}`}
                        />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {trainers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 md:px-6 py-8 text-center text-[#606060]">
                    トレーナーが登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HelpGuide steps={adminTrainersGuide} pageTitle="トレーナー管理" />
    </div>
  );
}
