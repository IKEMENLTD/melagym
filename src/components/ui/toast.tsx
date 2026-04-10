'use client';

import { useState, useCallback, createContext, useContext, useRef, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-[#f0fdf4]', border: 'border-[#22c55e]', icon: '#22c55e' },
  error: { bg: 'bg-[#fef2f2]', border: 'border-[#ef4444]', icon: '#ef4444' },
  info: { bg: 'bg-[#fff5f0]', border: 'border-[#ff5000]', icon: '#ff5000' },
};

function ToastIcon({ type }: { type: ToastType }) {
  const color = TOAST_COLORS[type].icon;

  if (type === 'success') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === 'error') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);

    // 2.5秒後にexit開始
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    }, 2500);

    // 3秒後に削除
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-[100] flex flex-col gap-2 pointer-events-none"
          style={{ transform: 'translateX(-50%)' }}
        >
          {toasts.map((toast) => {
            const colors = TOAST_COLORS[toast.type];
            return (
              <div
                key={toast.id}
                className={`
                  pointer-events-auto flex items-center gap-3 px-4 py-3 border
                  ${colors.bg} ${colors.border}
                  rounded-lg shadow-lg min-w-[280px] max-w-[90vw]
                `}
                style={{
                  animation: toast.exiting
                    ? 'toast-out 0.4s ease-in forwards'
                    : 'toast-in 0.4s ease-out',
                }}
              >
                <ToastIcon type={toast.type} />
                <p className="text-sm font-medium text-black">{toast.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
