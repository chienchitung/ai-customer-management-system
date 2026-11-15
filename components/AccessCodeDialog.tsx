import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { t } from '../localization';
import { registerAccessCodePrompt } from '../lib/accessCode';

type Language = 'en' | 'zh';

/** Asks for the deployment's access code when the server requires one (no Supabase login set up). */
export const AccessCodeDialog: React.FC<{ language: Language }> = ({ language }) => {
  const [reason, setReason] = useState<'required' | 'invalid' | null>(null);
  const [code, setCode] = useState('');
  const resolver = useRef<((code: string | null) => void) | null>(null);

  useEffect(() => {
    registerAccessCodePrompt(r => new Promise(resolve => {
      resolver.current = resolve;
      setCode('');
      setReason(r);
    }));
    return () => registerAccessCodePrompt(null);
  }, []);

  const finish = (value: string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setReason(null);
  };

  return (
    <Modal size="sm" isOpen={reason !== null} onClose={() => finish(null)} title={t('accessCode.title', language)}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (code.trim()) finish(code.trim()); }}>
        <p className="text-sm text-text-secondary">{t('accessCode.help', language)}</p>
        {reason === 'invalid' && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{t('accessCode.invalid', language)}</p>}
        <label className="block">
          <span className="text-xs font-medium text-text-secondary">{t('accessCode.label', language)}</span>
          <input autoFocus type="password" autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} className="input mt-1" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => finish(null)} className="btn btn-secondary">{t('modal.cancel', language)}</button>
          <button type="submit" disabled={!code.trim()} className="btn btn-primary">{t('accessCode.submit', language)}</button>
        </div>
      </form>
    </Modal>
  );
};
