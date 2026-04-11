'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Store } from '@/types/database';
import { adminFetch } from '@/lib/admin-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { adminStoresGuide } from '@/lib/guide-data';

interface StoreForm {
  name: string;
  area: string;
  address: string;
  google_calendar_id: string;
}

interface EditStoreForm extends StoreForm {
  passcode: string;
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editForm, setEditForm] = useState<EditStoreForm>({ name: '', area: '', address: '', google_calendar_id: '', passcode: '' });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<StoreForm>({ name: '', area: '', address: '', google_calendar_id: '' });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [togglingStoreId, setTogglingStoreId] = useState<string | null>(null);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saCopied, setSaCopied] = useState(false);

  const loadStores = useCallback(() => {
    setLoading(true);
    setError(null);
    adminFetch('/api/admin/stores')
      .then((r) => {
        if (!r.ok) throw new Error('店舗情報の取得に失敗しました');
        return r.json();
      })
      .then((data) => {
        setStores(data.stores ?? []);
      })
      .catch((err: Error) => {
        setError(err.message || 'データの取得に失敗しました');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  function openEdit(store: Store) {
    setEditingStore(store);
    setEditForm({
      name: store.name,
      area: store.area,
      address: store.address || '',
      google_calendar_id: store.google_calendar_id || '',
      passcode: '',
    });
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStore) return;
    setEditError(null);

    if (!editForm.name.trim()) {
      setEditError('店舗名は必須です');
      return;
    }

    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/stores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStore.id,
          name: editForm.name.trim(),
          area: editForm.area.trim(),
          address: editForm.address.trim(),
          google_calendar_id: editForm.google_calendar_id.trim() || null,
          ...(editForm.passcode.trim() && { passcode: editForm.passcode.trim() }),
        }),
      });
      if (!res.ok) {
        const result = await res.json();
        setEditError(result.error || '更新に失敗しました');
        return;
      }
      setEditingStore(null);
      loadStores();
    } catch {
      setEditError('通信エラーが発生しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddStore(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    if (!addForm.name.trim()) {
      setAddError('店舗名は必須です');
      return;
    }
    if (!addForm.area.trim()) {
      setAddError('エリアは必須です');
      return;
    }
    if (!addForm.google_calendar_id.trim()) {
      setAddError('Google Calendar IDは必須です');
      return;
    }

    setAddSubmitting(true);
    try {
      const res = await adminFetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          area: addForm.area.trim(),
          address: addForm.address.trim(),
          google_calendar_id: addForm.google_calendar_id.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setAddError(result.error || '登録に失敗しました');
        return;
      }
      setShowAddForm(false);
      setAddForm({ name: '', area: '', address: '', google_calendar_id: '' });
      loadStores();
    } catch {
      setAddError('通信エラーが発生しました');
    } finally {
      setAddSubmitting(false);
    }
  }

  async function toggleStoreActive(store: Store) {
    setTogglingStoreId(store.id);
    try {
      const res = await adminFetch('/api/admin/stores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: store.id, is_active: !store.is_active }),
      });
      if (!res.ok) throw new Error();
      setStores((prev) =>
        prev.map((s) => (s.id === store.id ? { ...s, is_active: !s.is_active } : s))
      );
    } catch {
      alert('稼働状況の更新に失敗しました');
    } finally {
      setTogglingStoreId(null);
    }
  }

  async function handleDeleteStore(store: Store) {
    if (!window.confirm(`「${store.name}」を削除しますか？\nこの操作は取り消せません。`)) {
      return;
    }
    setDeletingStoreId(store.id);
    try {
      const res = await adminFetch(`/api/admin/stores?id=${encodeURIComponent(store.id)}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || '削除に失敗しました');
        return;
      }
      setStores((prev) => prev.filter((s) => s.id !== store.id));
    } catch {
      alert('通信エラーが発生しました');
    } finally {
      setDeletingStoreId(null);
    }
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
        <button onClick={loadStores} className="px-4 py-2 bg-[#ff5000] text-white text-sm font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all">
          再読み込み
        </button>
      </div>
    );
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function fallbackCopy(text: string, onDone: () => void) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(onDone);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onDone();
    }
  }

  function copyStoreUrl() {
    fallbackCopy(`${baseUrl}/store`, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copySaEmail() {
    fallbackCopy('melagym@instagram-generator-472905.iam.gserviceaccount.com', () => {
      setSaCopied(true);
      setTimeout(() => setSaCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6 mela-bg-training">
      {/* 店舗ログインURL */}
      <div className="bg-[#fff5f0] border border-[#ff5000]/20 p-4 rounded-lg">
        <p className="text-sm font-bold text-black mb-2">店舗ログインURL</p>
        <div className="flex items-center gap-2 bg-white border border-[#d9d9d9] px-3 py-2 rounded-lg">
          <span className="text-xs text-[#606060] truncate flex-1">{baseUrl}/store</span>
          <button
            onClick={copyStoreUrl}
            className="text-xs text-[#ff5000] font-bold whitespace-nowrap hover:underline"
          >
            {copied ? 'コピー済み' : 'コピー'}
          </button>
        </div>
        <p className="text-xs text-[#606060] mt-2">このURLを店舗スタッフに共有すると、店舗名を選択してログインできます。</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">店舗管理</h1>
          <p className="text-sm text-[#606060] mt-1">{stores.length}店舗</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 bg-[#ff5000] text-white text-sm font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all"
        >
          + 店舗追加
        </button>
      </div>

      {/* 店舗追加モーダル */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d9d9d9]">
              <h2 className="font-bold text-black text-lg">店舗追加</h2>
              <button
                onClick={() => { setShowAddForm(false); setAddForm({ name: '', area: '', address: '', google_calendar_id: '' }); setAddError(null); }}
                className="text-[#606060] hover:text-black text-xl leading-none"
              >
                x
              </button>
            </div>
            <form onSubmit={handleAddStore} className="p-6 space-y-4">
              {addError && (
                <div className="bg-[#fef2f2] text-[#ef4444] text-sm px-4 py-3">
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  店舗名 <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="mela gym 渋谷店"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  エリア <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.area}
                  onChange={(e) => setAddForm((p) => ({ ...p, area: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="渋谷"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">住所</label>
                <input
                  type="text"
                  value={addForm.address}
                  onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="東京都渋谷区..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  Google Calendar ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.google_calendar_id}
                  onChange={(e) => setAddForm((p) => ({ ...p, google_calendar_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="example@group.calendar.google.com"
                  required
                />
                <div className="mt-2 bg-[#f0f0f0] p-3 text-xs text-[#4d4d4d] space-y-1.5">
                  <p className="font-bold">Calendar IDの取得方法:</p>
                  <p>1. Googleカレンダーを開く</p>
                  <p>2. 該当カレンダーの「︙」→「設定と共有」</p>
                  <p>3.「カレンダーの統合」→「カレンダーID」をコピー</p>
                  <p className="pt-1.5 font-bold">空き枠連携に必要な共有設定:</p>
                  <p>「特定のユーザーとの共有」に以下を追加:</p>
                  <div className="flex items-center gap-1 bg-white border border-[#d9d9d9] px-2 py-1 mt-1 min-w-0">
                    <span className="flex-1 select-all text-[10px] break-all min-w-0">melagym@instagram-generator-472905.iam.gserviceaccount.com</span>
                    <button
                      type="button"
                      onClick={copySaEmail}
                      className="text-[#ff5000] font-bold whitespace-nowrap flex-shrink-0"
                    >{saCopied ? 'OK!' : 'コピー'}</button>
                  </div>
                  <p>権限:「予定の表示（空き時間情報のみ）」</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#d9d9d9]">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setAddForm({ name: '', area: '', address: '', google_calendar_id: '' }); setAddError(null); }}
                  className="flex-1 py-2.5 text-sm font-medium text-[#4d4d4d] bg-[#f0f0f0] rounded-full hover:bg-[#d9d9d9] transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-[#ff5000] rounded-full hover:bg-[#e64800] hover:scale-[1.02] disabled:opacity-50 transition-all"
                >
                  {addSubmitting ? (
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

      {/* 編集モーダル */}
      {editingStore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d9d9d9]">
              <h2 className="font-bold text-black text-lg">店舗編集</h2>
              <button
                onClick={() => setEditingStore(null)}
                className="text-[#606060] hover:text-black text-xl leading-none"
              >
                x
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="bg-[#fef2f2] text-[#ef4444] text-sm px-4 py-3">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  店舗名 <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">エリア</label>
                <input
                  type="text"
                  value={editForm.area}
                  onChange={(e) => setEditForm((p) => ({ ...p, area: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">住所</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  Google Calendar ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.google_calendar_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, google_calendar_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="example@group.calendar.google.com"
                />
                <p className="text-xs text-[#606060] mt-1">Googleカレンダー → 設定と共有 → カレンダーの統合 → カレンダーIDをコピー</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                  店舗パスコード
                </label>
                <input
                  type="text"
                  value={editForm.passcode}
                  onChange={(e) => setEditForm((p) => ({ ...p, passcode: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  className="w-full px-3 py-2 border border-[#d9d9d9] text-sm"
                  placeholder="4〜8桁の数字（空欄で変更なし）"
                  inputMode="numeric"
                  pattern="\d{4,8}"
                />
                <p className="text-xs text-[#606060] mt-1">店舗スタッフのログイン時に必要なパスコードです。空欄の場合は変更しません</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#d9d9d9]">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="flex-1 py-2.5 text-sm font-medium text-[#4d4d4d] bg-[#f0f0f0] rounded-full hover:bg-[#d9d9d9] transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-[#ff5000] rounded-full hover:bg-[#e64800] hover:scale-[1.02] disabled:opacity-50 transition-all"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="mela-spinner-sm" />
                      保存中...
                    </span>
                  ) : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 店舗カード一覧 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <div key={store.id} className="bg-white border border-[#d9d9d9] p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-black text-lg">{store.name}</h3>
                <p className="text-sm text-[#606060]">{store.area}</p>
              </div>
              <span className={`text-xs px-2 py-1 font-medium
                ${store.is_active ? 'bg-[#f0fdf4] text-[#22c55e]' : 'bg-[#f0f0f0] text-[#606060]'}`}>
                {store.is_active ? '稼働中' : '停止中'}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[#606060]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{store.address || '住所未設定'}</span>
              </div>
              <div className="flex items-center gap-2 text-[#606060]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className={store.google_calendar_id ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                  {store.google_calendar_id ? 'カレンダー連携済み' : 'カレンダー未設定'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#d9d9d9] flex gap-2">
              <button
                onClick={() => openEdit(store)}
                className="flex-1 py-2 text-sm font-medium text-[#ff5000] bg-[#fff5f0] hover:bg-[#ffe8db] transition-colors"
              >
                編集
              </button>
              <button
                onClick={() => toggleStoreActive(store)}
                disabled={togglingStoreId === store.id}
                className={`flex-1 py-2 text-sm font-medium transition-colors disabled:opacity-50
                  ${store.is_active
                    ? 'text-[#ff5000] bg-[#fff5f0] hover:bg-[#ffe8db]'
                    : 'text-[#22c55e] bg-[#f0fdf4] hover:bg-[#dcfce7]'
                  }`}
              >
                {togglingStoreId === store.id ? (
                  <span className="flex items-center justify-center gap-1"><span className="mela-spinner-sm" /></span>
                ) : store.is_active ? '停止する' : '稼働する'}
              </button>
              <button
                onClick={() => handleDeleteStore(store)}
                disabled={deletingStoreId === store.id}
                className="py-2 px-3 text-sm font-medium text-[#ef4444] bg-[#fef2f2] hover:bg-[#fee2e2] transition-colors disabled:opacity-50"
              >
                {deletingStoreId === store.id ? (
                  <span className="flex items-center justify-center gap-1"><span className="mela-spinner-sm" /></span>
                ) : '削除'}
              </button>
            </div>
          </div>
        ))}
        {stores.length === 0 && (
          <div className="col-span-full text-center py-12 text-[#606060]">
            店舗が登録されていません
          </div>
        )}
      </div>
      <HelpGuide steps={adminStoresGuide} pageTitle="店舗管理" />
    </div>
  );
}
