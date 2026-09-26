import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from './Modal';
import { t } from '../localization';

// In-app replacement for window.confirm, styled like the rest of the UI.

interface ConfirmOptions {
  danger?: boolean;
  confirmLabel?: string;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider: React.FC<{ language: 'en' | 'zh'; children: React.ReactNode }> = ({ language, children }) => {
  const [state, setState] = useState<{ message: string; options: ConfirmOptions } | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback<ConfirmFn>((message, options = {}) => {
    setState({ message, options });
    return new Promise<boolean>(resolve => { resolver.current = resolve; });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = undefined;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal size="sm" isOpen={!!state} onClose={() => close(false)} title={t('confirm.title', language)}>
        <p className="text-sm text-text-primary whitespace-pre-wrap">{state?.message}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => close(false)} className="px-4 py-2 bg-secondary text-text-primary text-sm font-semibold rounded-md hover:bg-border transition">
            {t('confirm.cancel', language)}
          </button>
          <button
            autoFocus
            onClick={() => close(true)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition active:scale-95 ${state?.options.danger ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-primary hover:bg-primary/90 text-on-primary'}`}
          >
            {state?.options.confirmLabel ?? t('confirm.ok', language)}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
};
