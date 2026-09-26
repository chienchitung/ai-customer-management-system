import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { t } from '../localization';
import { Customer, CustomerStatus, InteractionType, NextAction } from '../types';
import { AIError, extractCustomerFromText } from '../services/geminiService';
import { generateId } from '../lib/ids';
import { addDays, todayISO } from '../lib/dates';
import { SparklesIcon } from './icons';
import { useGmail } from '../hooks/useGmail';
import { GmailMessage, getGmailText, listRecentInbox } from '../lib/gmail';
import { formatDate } from '../lib/format';
import { toISODate } from '../lib/dates';

type Language = 'en' | 'zh';

export const aiErrorMessage = (error: unknown, language: Language) =>
  t(`ai.errors.${error instanceof AIError ? error.code : 'upstream_error'}`, language);

const inputClass = 'input';
const primaryBtn = 'btn btn-primary';
const secondaryBtn = 'btn btn-secondary';

// ---------- Close reason (asked when a deal is moved to Won / Lost) ----------

export const CloseReasonModal: React.FC<{
  customer: Customer | null;
  status: CustomerStatus | null;
  onSave: (reason: string) => void;
  onSkip: () => void;
  language: Language;
}> = ({ customer, status, onSave, onSkip, language }) => {
  const [reason, setReason] = useState('');
  useEffect(() => setReason(customer?.closedReason ?? ''), [customer]);
  const isWon = status === CustomerStatus.CLOSED_WON;
  const presets = ['price', 'features', 'competitor', 'timing', 'relationship'];

  return (
    <Modal size="sm" isOpen={!!customer} onClose={onSkip} title={`${t(isWon ? 'closeReason.wonTitle' : 'closeReason.lostTitle', language)} · ${customer?.company ?? ''}`}>
      <form onSubmit={e => { e.preventDefault(); onSave(reason.trim()); }} className="space-y-3">
        <p className="text-sm text-text-secondary">{t('closeReason.help', language)}</p>
        <div className="flex flex-wrap gap-2">
          {presets.map(p => {
            const label = t(`closeReason.presets.${p}`, language);
            return (
              <button type="button" key={p} onClick={() => setReason(r => (r ? `${r}, ${label}` : label))}
                className="btn btn-sm btn-secondary">{label}</button>
            );
          })}
        </div>
        <textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} rows={3} className={inputClass} placeholder={t('closeReason.placeholder', language)} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onSkip} className={secondaryBtn}>{t('closeReason.skip', language)}</button>
          <button type="submit" disabled={!reason.trim()} className={primaryBtn}>{t('closeReason.save', language)}</button>
        </div>
      </form>
    </Modal>
  );
};

// ---------- Complete next action ----------

export const CompleteActionModal: React.FC<{
  customer: Customer | null;
  onClose: () => void;
  onComplete: (customerId: string, log: { type: InteractionType; summary: string } | null, next: NextAction | null) => void;
  language: Language;
}> = ({ customer, onClose, onComplete, language }) => {
  const [logIt, setLogIt] = useState(true);
  const [type, setType] = useState<InteractionType>(InteractionType.NOTE);
  const [summary, setSummary] = useState('');
  const [nextDesc, setNextDesc] = useState('');
  const [nextDue, setNextDue] = useState('');

  useEffect(() => {
    if (!customer) return;
    setLogIt(true);
    setType(InteractionType.NOTE);
    setSummary(customer.nextAction?.description ?? '');
    setNextDesc('');
    setNextDue(addDays(todayISO(), 3));
  }, [customer]);

  if (!customer) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(
      customer.id,
      logIt && summary.trim() ? { type, summary: summary.trim() } : null,
      nextDesc.trim() ? { description: nextDesc.trim(), dueDate: nextDue } : null,
    );
  };

  return (
    <Modal size="md" isOpen onClose={onClose} title={`${t('completeAction.title', language)} · ${customer.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={logIt} onChange={e => setLogIt(e.target.checked)} className="accent-primary w-4 h-4" />
          {t('completeAction.logAs', language)}
        </label>
        {logIt && (
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              {Object.values(InteractionType).map(it => (
                <button type="button" key={it} onClick={() => setType(it)}
                  className={`btn btn-sm ${type === it ? 'btn-primary' : 'btn-secondary'}`}>
                  {t(`interactionTypes.${it}`, language)}
                </button>
              ))}
            </div>
            <label className="block text-sm font-medium text-text-secondary">{t('completeAction.result', language)}</label>
            <textarea autoFocus value={summary} onChange={e => setSummary(e.target.value)} rows={3} className={inputClass} />
          </div>
        )}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-secondary">{t('completeAction.next', language)}</label>
          <div className="flex gap-2">
            <input value={nextDesc} onChange={e => setNextDesc(e.target.value)} className={inputClass} />
            <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} className={`${inputClass} w-44`} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>{t('modal.cancel', language)}</button>
          <button type="submit" className={primaryBtn}>{t('completeAction.save', language)}</button>
        </div>
      </form>
    </Modal>
  );
};

// ---------- Smart capture: paste text, AI pre-fills the customer form ----------

export const SmartCaptureModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (prefill: Partial<Customer>, interactionSummary?: string) => void;
  language: Language;
}> = ({ isOpen, onClose, onExtracted, language }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gmail = useGmail();
  const [inbox, setInbox] = useState<GmailMessage[] | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);

  useEffect(() => { if (isOpen) { setText(''); setError(null); setInbox(null); } }, [isOpen]);

  const loadInbox = async () => {
    setInboxLoading(true);
    setError(null);
    try {
      setInbox(await listRecentInbox());
    } catch {
      setError(t('gmail.error', language));
    } finally {
      setInboxLoading(false);
    }
  };

  const pick = async (m: GmailMessage) => {
    setInboxLoading(true);
    try {
      const full = await getGmailText(m.id);
      setText(`From: ${full.from}\nSubject: ${full.subject}\n\n${full.text}`);
      setInbox(null);
    } catch {
      setError(t('gmail.error', language));
    } finally {
      setInboxLoading(false);
    }
  };

  const extract = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await extractCustomerFromText(text, language);
      onExtracted({
        name: r.name, company: r.company, email: r.email,
        dealValue: r.dealValue || undefined,
        keyContacts: (r.keyContacts ?? []).filter(c => c.name).map(c => ({ ...c, id: generateId() })),
        customerPainPoints: r.customerPainPoints ?? [],
        competitors: r.competitors ?? [],
        nextAction: r.nextActionDescription ? { description: r.nextActionDescription, dueDate: r.nextActionDueDate || addDays(todayISO(), 2) } : undefined,
      }, r.interactionSummary);
    } catch (e) {
      setError(aiErrorMessage(e, language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal size="md" isOpen={isOpen} onClose={onClose} title={t('capture.title', language)}>
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{t('capture.help', language)}</p>
        {gmail.status.connected && !inbox && (
          <button type="button" onClick={loadInbox} disabled={inboxLoading} className="btn btn-sm btn-secondary">
            {inboxLoading ? t('gmail.loadingInbox', language) : `✉ ${t('gmail.fromInbox', language)}`}
          </button>
        )}
        {inbox && (
          <ul className="max-h-56 overflow-y-auto border border-border rounded-md divide-y divide-border">
            {inbox.length === 0 && <li className="p-3 text-sm text-text-secondary">{t('gmail.inboxEmpty', language)}</li>}
            {inbox.map(m => (
              <li key={m.id}>
                <button type="button" onClick={() => pick(m)} disabled={inboxLoading} className="w-full text-left p-2 hover:bg-secondary disabled:opacity-50">
                  <p className="text-sm font-medium truncate">{m.from.replace(/<.*>/, '').trim()} · {m.subject}</p>
                  <p className="text-xs text-text-secondary truncate">{formatDate(toISODate(new Date(m.date)), language)} — {m.snippet}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={8} className={inputClass} placeholder={t('capture.placeholder', language)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && !loading) extract(); }} />
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>{t('modal.cancel', language)}</button>
          <button type="button" onClick={extract} disabled={!text.trim() || loading} className={primaryBtn}>
            <SparklesIcon className="w-4 h-4" />
            {t(loading ? 'capture.extracting' : 'capture.extract', language)}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ---------- Keyboard shortcut help ----------

export const SHORTCUTS: [string, string][] = [
  ['⌘K', 'shortcuts.palette'],
  ['N', 'shortcuts.newCustomer'],
  ['/', 'shortcuts.search'],
  ['L', 'shortcuts.logFocus'],
  ['1', 'shortcuts.goToday'],
  ['2', 'shortcuts.goManage'],
  ['3', 'shortcuts.goDashboard'],
  ['?', 'shortcuts.help'],
  ['Esc', 'shortcuts.close'],
];

export const ShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void; language: Language }> = ({ isOpen, onClose, language }) => (
  <Modal size="sm" isOpen={isOpen} onClose={onClose} title={t('shortcuts.title', language)}>
    <ul className="space-y-2">
      {SHORTCUTS.map(([key, label]) => (
        <li key={key} className="flex justify-between text-sm">
          <span>{t(label, language)}</span>
          <kbd className="kbd">{key}</kbd>
        </li>
      ))}
    </ul>
  </Modal>
);
