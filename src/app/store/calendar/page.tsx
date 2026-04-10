'use client';

import { useState, useEffect, useCallback } from 'react';
import { storeFetch } from '@/lib/store-fetch';
import { HelpGuide } from '@/components/ui/help-guide';
import { storeCalendarGuide } from '@/lib/guide-data';

interface BusinessHoursEntry {
  open: string;
  close: string;
}

type BusinessHours = Record<string, BusinessHoursEntry | null>;

interface StoreDetail {
  id: string;
  name: string;
  google_calendar_id: string;
  business_hours: BusinessHours;
}

const DAY_LABELS: { key: string; label: string }[] = [
  { key: 'monday', label: '月曜日' },
  { key: 'tuesday', label: '火曜日' },
  { key: 'wednesday', label: '水曜日' },
  { key: 'thursday', label: '木曜日' },
  { key: 'friday', label: '金曜日' },
  { key: 'saturday', label: '土曜日' },
  { key: 'sunday', label: '日曜日' },
];

const DEFAULT_HOURS: BusinessHoursEntry = { open: '09:00', close: '21:00' };

interface DayFormState {
  isClosed: boolean;
  open: string;
  close: string;
}

function buildFormState(businessHours: BusinessHours): Record<string, DayFormState> {
  const state: Record<string, DayFormState> = {};
  for (const day of DAY_LABELS) {
    const entry = businessHours[day.key];
    if (entry === null || entry === undefined) {
      state[day.key] = { isClosed: entry === null, open: DEFAULT_HOURS.open, close: DEFAULT_HOURS.close };
    } else {
      state[day.key] = { isClosed: false, open: entry.open, close: entry.close };
    }
  }
  return state;
}

function formStateToBusinessHours(
  formState: Record<string, DayFormState>
): BusinessHours {
  const hours: BusinessHours = {};
  for (const day of DAY_LABELS) {
    const s = formState[day.key];
    if (s.isClosed) {
      hours[day.key] = null;
    } else {
      hours[day.key] = { open: s.open, close: s.close };
    }
  }
  return hours;
}

export default function CalendarSettingsPage() {
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [formState, setFormState] = useState<Record<string, DayFormState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    storeFetch('/api/store/settings')
      .then((res) => {
        if (!res.ok) throw new Error('店舗情報の取得に失敗しました');
        return res.json();
      })
      .then((data: { store: StoreDetail }) => {
        setStore(data.store);
        setFormState(buildFormState(data.store.business_hours ?? {}));
      })
      .catch((err: Error) => {
        setError(err.message ?? 'データの取得に失敗しました');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleDayChange = useCallback(
    (dayKey: string, field: keyof DayFormState, value: string | boolean) => {
      setFormState((prev) => ({
        ...prev,
        [dayKey]: { ...prev[dayKey], [field]: value },
      }));
      setSaveSuccess(false);
    },
    []
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const businessHours = formStateToBusinessHours(formState);
      const res = await storeFetch('/api/store/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_hours: businessHours }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? '保存に失敗しました');
      }

      setSaveSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存に失敗しました';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [formState]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="mela-spinner" />
        <span className="mela-loading-text">読み込み中...</span>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[#ef4444] font-medium">{error ?? '店舗情報の取得に失敗しました'}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#ff5000] text-black text-sm font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all shadow-[0_4px_20px_rgba(255,80,0,0.4)]"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-black">カレンダー設定</h1>

      {/* GoogleカレンダーID */}
      <div className="bg-white border border-[#d9d9d9] rounded-lg p-6">
        <h2 className="font-bold text-black mb-3">GoogleカレンダーID</h2>
        {store.google_calendar_id ? (
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-sm text-[#4d4d4d] break-all">
              {store.google_calendar_id}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2 h-2 rounded-full bg-[#ef4444]" />
              <span className="text-sm text-[#606060]">
                未設定（管理者にお問い合わせください）
              </span>
            </div>
          </div>
        )}
        <div className="mt-4 p-3 bg-[#f8f8f8] border border-[#e5e5e5] rounded text-xs text-[#606060] leading-relaxed">
          <p className="font-medium text-[#4d4d4d] mb-1">GoogleカレンダーIDの確認方法</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Googleカレンダーを開き、左メニューの対象カレンダー名の右にある「...」をクリック</li>
            <li>「設定と共有」を選択</li>
            <li>「カレンダーの統合」セクションにある「カレンダーID」をコピー</li>
          </ol>
          <p className="mt-1">形式例: xxxx@group.calendar.google.com</p>
        </div>
      </div>

      {/* 営業時間設定 */}
      <div className="bg-white border border-[#d9d9d9] rounded-lg">
        <div className="px-6 py-4 border-b border-[#d9d9d9]">
          <h2 className="font-bold text-black">営業時間</h2>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {DAY_LABELS.map((day) => {
            const state = formState[day.key];
            if (!state) return null;
            return (
              <div
                key={day.key}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="w-20 shrink-0">
                  <span className="text-sm font-medium text-black">
                    {day.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={state.isClosed}
                      onChange={(e) =>
                        handleDayChange(day.key, 'isClosed', e.target.checked)
                      }
                      className="w-4 h-4 accent-[#ff5000]"
                    />
                    <span className="text-sm text-[#4d4d4d]">定休日</span>
                  </label>
                  {!state.isClosed && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={state.open}
                        onChange={(e) =>
                          handleDayChange(day.key, 'open', e.target.value)
                        }
                        className="px-2 py-1.5 border border-[#d9d9d9] text-sm text-[#4d4d4d]"
                      />
                      <span className="text-[#606060]">-</span>
                      <input
                        type="time"
                        value={state.close}
                        onChange={(e) =>
                          handleDayChange(day.key, 'close', e.target.value)
                        }
                        className="px-2 py-1.5 border border-[#d9d9d9] text-sm text-[#4d4d4d]"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* エラー・成功メッセージ */}
      {error && (
        <p className="text-sm text-[#ef4444] font-medium">{error}</p>
      )}
      {saveSuccess && (
        <p className="text-sm text-[#22c55e] font-medium">
          営業時間を保存しました
        </p>
      )}

      {/* 保存ボタン */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-[#ff5000] text-black font-bold rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all shadow-[0_4px_20px_rgba(255,80,0,0.4)] disabled:opacity-50"
        >
          {saving ? '保存中...' : '営業時間を保存'}
        </button>
      </div>
      <HelpGuide steps={storeCalendarGuide} pageTitle="カレンダー設定" />
    </div>
  );
}
