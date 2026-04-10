'use client';

import { useState, useCallback, useEffect } from 'react';

export interface GuideStep {
  title: string;
  description: string;
}

interface HelpGuideProps {
  steps: GuideStep[];
  pageTitle: string;
}

export function HelpGuide({ steps, pageTitle }: HelpGuideProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // ESCキーで閉じる
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1);
    else { setOpen(false); setCurrentStep(0); }
  }, [currentStep, steps.length]);

  const prev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  if (steps.length === 0) return null;

  return (
    <>
      {/* ? ボタン（右下固定） */}
      <button
        onClick={() => { setOpen(true); setCurrentStep(0); }}
        className="fixed right-4 z-50 w-14 h-14 bg-[#ff5000] text-white rounded-full shadow-[0_4px_20px_rgba(255,80,0,0.4)] hover:bg-[#e64800] hover:scale-110 transition-all flex items-center justify-center"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        aria-label="使い方ガイドを開く"
      >
        <span className="text-2xl font-bold">?</span>
      </button>

      {/* オーバーレイ + ガイドモーダル */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {/* 背景 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* モーダル */}
          <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            {/* ヘッダー */}
            <div className="bg-[#ff5000] px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-black/60 text-xs font-medium">使い方ガイド</p>
                <h3 className="text-black font-bold text-lg">{pageTitle}</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-black/60 hover:text-black min-w-[44px] min-h-[44px]"
                aria-label="閉じる"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* ステップ内容 */}
            <div className="px-6 py-6">
              {/* ステップ番号 */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#ff5000] text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {currentStep + 1}
                </div>
                <div className="flex gap-1.5">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentStep ? 'w-6 bg-[#ff5000]' : 'w-1.5 bg-[#d9d9d9]'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-[#606060] ml-auto">
                  {currentStep + 1} / {steps.length}
                </span>
              </div>

              {/* コンテンツ */}
              <h4 className="font-bold text-black text-base mb-2">
                {steps[currentStep].title}
              </h4>
              <p className="text-[#4d4d4d] text-sm leading-relaxed">
                {steps[currentStep].description}
              </p>
            </div>

            {/* フッター */}
            <div className="px-6 pb-6 flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={prev}
                  className="flex-1 py-3 border border-[#d9d9d9] text-[#4d4d4d] font-medium rounded-full hover:bg-[#f0f0f0] transition-colors min-h-[48px]"
                >
                  戻る
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 py-3 bg-[#ff5000] text-white font-bold rounded-full hover:bg-[#e64800] transition-colors shadow-[0_4px_20px_rgba(255,80,0,0.4)] min-h-[48px]"
              >
                {currentStep < steps.length - 1 ? '次へ' : '閉じる'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
