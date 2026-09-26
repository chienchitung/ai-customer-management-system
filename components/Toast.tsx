import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'info' | 'error';
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, ...options });
    timer.current = setTimeout(() => setToast(null), options.onAction ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
        {toast && (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-fade-in flex items-center gap-4 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${toast.tone === 'error' ? 'bg-rose-600' : 'bg-slate-800 dark:bg-slate-700'}`}
          >
            <span>{toast.message}</span>
            {toast.onAction && (
              <button
                onClick={() => { toast.onAction!(); setToast(null); }}
                className="font-semibold text-sky-300 hover:underline"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
};
