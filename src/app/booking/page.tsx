'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { StepIndicator } from '@/components/ui/step-indicator';
import { SlotCalendar } from '@/components/ui/slot-calendar';
import { StoreSelector } from '@/components/booking/store-selector';
import { TrainerSelector } from '@/components/booking/trainer-selector';
import { CustomerForm, type CustomerFormData } from '@/components/booking/customer-form';
import type { Store, Trainer, TimeSlot, BookingResponse } from '@/types/database';
import { HelpGuide } from '@/components/ui/help-guide';
import { bookingGuide } from '@/lib/guide-data';

type BookingType = 'first_visit' | 'regular';

const STEPS_FIRST = ['店舗', 'トレーナー', '日時', '情報入力'];
const STEPS_REGULAR = ['店舗', 'トレーナー', '日時'];

export default function BookingPage() {
  // URL パラメータから予約タイプを判定（将来LIFF SDKで自動判定）
  const [bookingType, setBookingType] = useState<BookingType>('first_visit');
  const [step, setStep] = useState(0);
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainersLoading, setTrainersLoading] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const [previousTrainerId, setPreviousTrainerId] = useState<string | null>(null);
  const [previousStoreId, setPreviousStoreId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResponse | null>(null);
  const [lineUid, setLineUid] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showRegularConfirm, setShowRegularConfirm] = useState(false);

  const steps = bookingType === 'first_visit' ? STEPS_FIRST : STEPS_REGULAR;

  // 初期化: URLパラメータ解析 + 店舗一覧取得
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const isRegular = type === 'regular';
    if (isRegular) setBookingType('regular');

    const uid = params.get('line_uid');
    if (uid) setLineUid(uid);

    // 店舗一覧を取得し、リピーターの場合は前回予約情報も並行で取得
    setStoresLoading(true);

    const storesPromise = fetch('/api/stores')
      .then((r) => {
        if (!r.ok) throw new Error('店舗情報の取得に失敗しました');
        return r.json();
      });

    const lastBookingPromise = (isRegular && uid)
      ? fetch(`/api/customer/last-booking?line_uid=${encodeURIComponent(uid)}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null)
      : Promise.resolve(null);

    Promise.all([storesPromise, lastBookingPromise])
      .then(([storesData, lastBooking]: [
        { stores?: Store[] },
        { store_id: string | null; trainer_id: string | null } | null
      ]) => {
        const storesList = storesData.stores ?? [];
        setStores(storesList);
        setApiError(null);

        // リピーター: 前回の店舗をデフォルト選択 + バッジ表示用に保持
        if (isRegular && lastBooking?.store_id) {
          setPreviousStoreId(lastBooking.store_id);
          const storeExists = storesList.some((s) => s.id === lastBooking.store_id);
          if (storeExists) {
            setSelectedStoreId(lastBooking.store_id);
          }
        }

        // 前回のトレーナーIDを保持
        if (lastBooking?.trainer_id) {
          setPreviousTrainerId(lastBooking.trainer_id);
        }
      })
      .catch(() => {
        setApiError('店舗情報の取得に失敗しました。ページを再読み込みしてください。');
      })
      .finally(() => setStoresLoading(false));
  }, []);

  // 店舗選択後: トレーナー一覧取得
  useEffect(() => {
    if (!selectedStoreId) return;
    setTrainersLoading(true);
    const firstVisitOnly = bookingType === 'first_visit';
    fetch(`/api/trainers?store_id=${selectedStoreId}&first_visit_only=${firstVisitOnly}`)
      .then((r) => {
        if (!r.ok) throw new Error('トレーナー情報の取得に失敗しました');
        return r.json();
      })
      .then((data) => {
        setTrainers(data.trainers ?? []);
        setApiError(null);
      })
      .catch(() => {
        setApiError('トレーナー情報の取得に失敗しました。もう一度お試しください。');
      })
      .finally(() => setTrainersLoading(false));
  }, [selectedStoreId, bookingType]);

  // 日時選択: 空き枠取得
  const fetchSlots = useCallback(async (date: Date) => {
    if (!selectedStoreId || !selectedTrainerId) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    setApiError(null);

    const dateStr = format(date, 'yyyy-MM-dd');
    const trainerId = selectedTrainerId === 'auto' ? 'auto' : selectedTrainerId;

    try {
      const res = await fetch(
        `/api/calendar/availability?store_id=${selectedStoreId}&trainer_id=${trainerId}&date=${dateStr}`
      );
      if (!res.ok) throw new Error('空き枠の取得に失敗しました');
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      setApiError('空き枠の取得に失敗しました。もう一度お試しください。');
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedStoreId, selectedTrainerId]);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  // 店舗選択
  function handleStoreSelect(storeId: string) {
    setSelectedStoreId(storeId);
    setSelectedTrainerId(null);
    setSelectedSlot(null);
    setSlots([]);
    setApiError(null);
    setStep(1);
  }

  // トレーナー選択
  function handleTrainerSelect(trainerId: string) {
    setSelectedTrainerId(trainerId);
    setSelectedSlot(null);
    setSlots([]);
    setApiError(null);
    setStep(2);
  }

  // 日時選択
  function handleSlotSelect(slot: TimeSlot) {
    setSelectedSlot(slot);
    if (bookingType === 'regular') {
      setShowRegularConfirm(true);
    } else {
      setStep(3);
    }
  }

  // 2回目予約の確認ダイアログで確定
  function handleRegularConfirm() {
    setShowRegularConfirm(false);
    if (selectedSlot) {
      handleBookingSubmit(selectedSlot);
    }
  }

  // 2回目予約の確認ダイアログでキャンセル
  function handleRegularCancel() {
    setShowRegularConfirm(false);
    setSelectedSlot(null);
  }

  // 予約確定
  async function handleBookingSubmit(slot?: TimeSlot, customerData?: CustomerFormData) {
    const targetSlot = slot ?? selectedSlot;
    if (!targetSlot || !selectedStoreId || !selectedTrainerId) return;

    setSubmitting(true);
    setApiError(null);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: selectedStoreId,
          trainer_id: selectedTrainerId,
          slot_start: targetSlot.start,
          booking_type: bookingType,
          customer: {
            ...customerData,
            line_uid: lineUid,
          },
        }),
      });
      if (!res.ok) throw new Error('予約の送信に失敗しました');
      const result: BookingResponse = await res.json();
      setBookingResult(result);
    } catch {
      setApiError('予約の送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  }

  // 選択中の店舗名・トレーナー名を取得するヘルパー
  const selectedStoreName = stores.find((s) => s.id === selectedStoreId)?.name ?? '';
  const selectedTrainerName =
    selectedTrainerId === 'auto'
      ? 'おまかせ'
      : trainers.find((t) => t.id === selectedTrainerId)?.name ?? '';

  // 予約完了画面
  if (bookingResult) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/images/bg-gym-entrance.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 bg-white/95 backdrop-blur-sm p-8 max-w-md w-full text-center rounded-2xl">
          {bookingResult.success ? (
            <>
              <div className="w-16 h-16 bg-[#ff5000] rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-black mb-2">予約が確定しました</h1>
              <p className="text-[#606060] text-sm mb-6">
                予約確認の通知をお送りします。
              </p>
              {bookingResult.booking && (
                <div className="bg-[#f0f0f0] p-4 rounded-lg text-left text-sm space-y-2 mb-6">
                  <div className="flex justify-between">
                    <span className="text-[#606060]">予約番号</span>
                    <span className="font-medium font-mono text-xs">
                      {bookingResult.booking.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#606060]">日時</span>
                    <span className="font-medium">
                      {format(new Date(bookingResult.booking.scheduled_at), 'M月d日(E) HH:mm', { locale: ja })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#606060]">店舗</span>
                    <span className="font-medium">
                      {stores.find((s) => s.id === bookingResult.booking!.store_id)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#606060]">トレーナー</span>
                    <span className="font-medium">
                      {selectedTrainerId === 'auto'
                        ? `おまかせ${bookingResult.booking.trainer_id ? ` (${trainers.find((t) => t.id === bookingResult.booking!.trainer_id)?.name ?? '担当決定後にお知らせ'})` : ''}`
                        : selectedTrainerName}
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <a
                  href="https://line.me/R/ti/p/@melagym"
                  className="block w-full py-3 bg-[#06C755] text-white font-bold text-center min-h-[48px] rounded-full hover:opacity-90 transition-opacity tracking-wider leading-[24px]"
                >
                  LINEに戻る
                </a>
                <button
                  onClick={() => {
                    setBookingResult(null);
                    setStep(0);
                    setSelectedStoreId(null);
                    setSelectedTrainerId(null);
                    setSelectedSlot(null);
                    setSelectedDate(null);
                    setSlots([]);
                  }}
                  className="w-full py-3 bg-[#f0f0f0] text-[#4d4d4d] font-medium min-h-[48px] rounded-full hover:bg-[#d9d9d9] transition-all"
                >
                  別の予約をする
                </button>
                <Link
                  href="/"
                  className="block w-full py-2 text-[#606060] text-sm text-center hover:text-[#4d4d4d] transition-colors"
                >
                  トップページに戻る
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-[#ef4444] rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-black mb-2">予約できませんでした</h1>
              <p className="text-[#606060] text-sm mb-6">{bookingResult.error ?? '予約処理中にエラーが発生しました'}</p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setBookingResult(null);
                    setStep(2);
                    setSelectedSlot(null);
                  }}
                  className="w-full py-3 bg-[#ff5000] text-black font-bold min-h-[48px] rounded-full hover:bg-[#e64800] hover:scale-[1.02] transition-all tracking-wider"
                >
                  別の時間を選ぶ
                </button>
                <Link
                  href="/"
                  className="block w-full py-2 text-[#606060] text-sm text-center hover:text-[#4d4d4d] transition-colors"
                >
                  トップページに戻る
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="bg-white border-b border-[#d9d9d9] sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => {
                  setApiError(null);
                  setStep((s) => s - 1);
                }}
                className="p-3 -ml-3 active:bg-[#f0f0f0] min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="前のステップに戻る"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/images/mela-logo-dark.svg"
                alt="mela gym - トップに戻る"
                width={100}
                height={56}
              />
              <span className="text-base font-bold text-black">
                {bookingType === 'first_visit' ? '体験予約' : '予約'}
              </span>
            </Link>
          </div>
          <StepIndicator
            steps={steps}
            currentStep={step}
            onStepClick={(targetStep) => {
              setApiError(null);
              setStep(targetStep);
            }}
          />
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* APIエラー表示 */}
        {apiError && (
          <div className="mb-4 p-4 bg-red-50 border border-[#ef4444] text-[#ef4444] text-sm" role="alert">
            {apiError}
          </div>
        )}

        {/* Step 0: 店舗選択 */}
        {step === 0 && (
          <StoreSelector
            stores={stores}
            selectedStoreId={selectedStoreId}
            previousStoreId={bookingType === 'regular' ? previousStoreId : null}
            onSelect={handleStoreSelect}
            loading={storesLoading}
          />
        )}

        {/* Step 1: トレーナー選択 */}
        {step === 1 && (
          <TrainerSelector
            trainers={trainers}
            selectedTrainerId={selectedTrainerId}
            previousTrainerId={bookingType === 'regular' ? previousTrainerId : null}
            onSelect={handleTrainerSelect}
            showAutoOption={true}
            loading={trainersLoading}
          />
        )}

        {/* Step 2: 日時選択 */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-black">日時を選択</h2>
            <SlotCalendar
              slots={slots}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              onDateSelect={setSelectedDate}
              onSlotSelect={handleSlotSelect}
              loading={slotsLoading}
            />
          </div>
        )}

        {/* Step 3: 情報入力（初回のみ） */}
        {step === 3 && bookingType === 'first_visit' && (
          <CustomerForm
            loading={submitting}
            onSubmit={(data) => handleBookingSubmit(undefined, data)}
          />
        )}
      </main>

      {/* 2回目予約の確認ダイアログ */}
      {showRegularConfirm && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={handleRegularCancel}>
          <div
            className="bg-white w-full max-w-lg p-6 pb-8 space-y-4 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="予約確認"
          >
            <h2 className="text-lg font-bold text-black">予約を確定しますか？</h2>
            <div className="bg-[#f0f0f0] p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-[#606060]">日時</span>
                <span className="font-medium">
                  {format(new Date(selectedSlot.start), 'M月d日(E) HH:mm', { locale: ja })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#606060]">店舗</span>
                <span className="font-medium">{selectedStoreName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#606060]">トレーナー</span>
                <span className="font-medium">{selectedTrainerName}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRegularCancel}
                className="flex-1 py-3 bg-[#f0f0f0] font-medium text-[#4d4d4d] min-h-[48px] rounded-full hover:bg-[#d9d9d9] transition-all"
              >
                戻る
              </button>
              <button
                onClick={handleRegularConfirm}
                disabled={submitting}
                className="flex-1 py-3 bg-[#ff5000] text-black font-bold min-h-[48px] rounded-full disabled:opacity-50 hover:bg-[#e64800] hover:scale-[1.02] transition-all tracking-wider"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="mela-spinner-sm" />
                    処理中...
                  </span>
                ) : '確定する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 送信中のオーバーレイ */}
      {submitting && !showRegularConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <div className="mela-loading">
            <div className="mela-spinner-lg" />
            <p className="mela-loading-text">予約を処理しています...</p>
          </div>
        </div>
      )}

      <HelpGuide steps={bookingGuide} pageTitle="予約の流れ" />
    </div>
  );
}
