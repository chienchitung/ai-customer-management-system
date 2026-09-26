import React, { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import { Customer, Interaction, InteractionType, NextAction } from '../types';
import { t, tf } from '../localization';
import { useGmail } from '../hooks/useGmail';
import { useToast } from './Toast';
import { GmailMessage, getGmailText, listGmailWith, sendGmail } from '../lib/gmail';
import { ApiError } from '../lib/api';
import { organizeMeetingNotes } from '../services/geminiService';
import { toISODate, todayISO } from '../lib/dates';
import { formatDate } from '../lib/format';
import { aiErrorMessage } from './Dialogs';
import { SparklesIcon } from './icons';

type Language = 'en' | 'zh';

export const gmailErrorMessage = (e: unknown, language: Language) =>
  t((e as ApiError)?.code === 'google_reauth_required' || (e as ApiError)?.code === 'google_not_connected' ? 'gmail.reauth' : 'gmail.error', language);

const isReauth = (e: unknown) => ['google_reauth_required', 'google_not_connected'].includes((e as ApiError)?.code);

const localDate = (iso: string) => toISODate(new Date(iso));

// ---------- Customer email history ----------

export const GmailPanel: React.FC<{
  customer: Customer;
  language: Language;
  onAddInteraction: (customerId: string, interaction: Omit<Interaction, 'id'>) => void;
  onSetNextAction: (customerId: string, action: NextAction) => void;
}> = ({ customer, language, onAddInteraction, onSetNextAction }) => {
  const gmail = useGmail();
  const toast = useToast();
  const [messages, setMessages] = useState<GmailMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customer.email) return;
    setLoading(true);
    setError(null);
    try {
      setMessages(await listGmailWith(customer.email));
    } catch (e) {
      setError(gmailErrorMessage(e, language));
      if (isReauth(e)) gmail.markDisconnected();
    } finally {
      setLoading(false);
    }
  }, [customer.email, language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMessages(null);
    if (gmail.status.connected) load();
  }, [customer.id, gmail.status.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!gmail.status.available) return null;

  const loggedIds = new Set(customer.interactions.map(i => i.externalId).filter(Boolean));
  const fresh = (messages ?? []).filter(m => !loggedIds.has(m.id));

  const quickLog = (m: GmailMessage) => onAddInteraction(customer.id, {
    type: InteractionType.EMAIL,
    date: localDate(m.date),
    summary: `${t(m.direction === 'out' ? 'gmail.sentPrefix' : 'gmail.receivedPrefix', language)}${m.subject}${m.snippet ? ` — ${m.snippet}` : ''}`,
    source: 'gmail',
    externalId: m.id,
  });

  const aiLog = async (m: GmailMessage) => {
    setBusyId(m.id);
    try {
      const full = await getGmailText(m.id);
      const notes = `${m.direction === 'out' ? 'Email I sent' : 'Email I received'} on ${localDate(m.date)}\nSubject: ${full.subject}\nFrom: ${full.from}\n\n${full.text}`;
      const r = await organizeMeetingNotes(customer, notes, language);
      onAddInteraction(customer.id, { type: InteractionType.EMAIL, date: localDate(m.date), summary: r.summary, source: 'gmail', externalId: m.id });
      if (r.nextActionDescription) {
        const action = { description: r.nextActionDescription, dueDate: r.nextActionDueDate || todayISO() };
        toast(`${t('gmail.loggedToast', language)} ${t('ai.nextStepTitle', language)}: ${action.description}`, {
          actionLabel: t('ai.setNext', language),
          onAction: () => onSetNextAction(customer.id, action),
        });
      } else {
        toast(t('gmail.loggedToast', language));
      }
    } catch (e) {
      toast(e instanceof ApiError ? gmailErrorMessage(e, language) : aiErrorMessage(e, language), { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const btn = 'text-xs px-2 py-1 rounded-md font-semibold transition disabled:opacity-50';

  return (
    <section className="bg-surface p-4 rounded-lg border border-border" aria-label={t('gmail.title', language)}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500" aria-hidden="true" />{t('gmail.title', language)}
        </h3>
        {gmail.status.connected && customer.email && (
          <div className="flex gap-2">
            {fresh.length > 0 && (
              <button className={`${btn} bg-primary text-on-primary hover:bg-primary/90`} onClick={() => { fresh.forEach(quickLog); toast(tf('gmail.loggedAllToast', language, { n: fresh.length })); }}>
                {tf('gmail.logAll', language, { n: fresh.length })}
              </button>
            )}
            <button className={`${btn} bg-secondary hover:bg-border`} onClick={load} disabled={loading}>{t('gmail.refresh', language)}</button>
          </div>
        )}
      </div>

      {!gmail.status.connected ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-text-secondary flex-grow">{t('gmail.connectHint', language)}</p>
          <button onClick={gmail.connect} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-primary text-on-primary hover:bg-primary/90">{t('gmail.connect', language)}</button>
        </div>
      ) : !customer.email ? (
        <p className="text-sm text-text-secondary">{t('gmail.noEmail', language)}</p>
      ) : error ? (
        <div className="flex items-center gap-3">
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          {gmail.status.connected ? (
            <button className={`${btn} bg-secondary hover:bg-border`} onClick={load}>{t('ai.retry', language)}</button>
          ) : null}
        </div>
      ) : loading && !messages ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-md bg-secondary animate-pulse" />)}
        </div>
      ) : messages && messages.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('gmail.none', language)}</p>
      ) : (
        <ul className="divide-y divide-border">
          {(messages ?? []).map(m => {
            const logged = loggedIds.has(m.id);
            return (
              <li key={m.id} className="py-2 flex gap-3 items-start">
                <span className={`mt-0.5 text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${m.direction === 'out' ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'}`}>
                  {t(m.direction === 'out' ? 'gmail.outbound' : 'gmail.inbound', language)}
                </span>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium truncate">{m.subject || '(no subject)'}</p>
                  <p className="text-xs text-text-secondary line-clamp-2">{m.snippet}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{formatDate(localDate(m.date), language)}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 flex-shrink-0">
                  {logged ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-1">✓ {t('gmail.logged', language)}</span>
                  ) : (
                    <>
                      <button className={`${btn} bg-secondary hover:bg-border`} onClick={() => { quickLog(m); toast(t('gmail.loggedToast', language)); }}>{t('gmail.log', language)}</button>
                      <button className={`${btn} border border-primary text-primary hover:bg-primary/10 flex items-center gap-1`} disabled={busyId !== null} onClick={() => aiLog(m)}>
                        <SparklesIcon className="w-3.5 h-3.5" />{busyId === m.id ? t('logger.organizing', language) : t('gmail.aiLog', language)}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// ---------- Review & send ----------

export const SendEmailModal: React.FC<{
  draft: { to: string; subject: string; body: string } | null;
  language: Language;
  onClose: () => void;
  onSent: (info: { id: string; subject: string }) => void;
}> = ({ draft, language, onClose, onSent }) => {
  const gmail = useGmail();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    setTo(draft.to);
    setSubject(draft.subject);
    setBody(draft.body);
    setError(null);
  }, [draft]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await sendGmail(to.trim(), subject.trim(), body);
      onSent({ id: res.id, subject: subject.trim() });
    } catch (err) {
      setError(gmailErrorMessage(err, language));
      if (isReauth(err)) gmail.markDisconnected();
    } finally {
      setSending(false);
    }
  };

  const input = 'w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none';
  return (
    <Modal size="md" isOpen={!!draft} onClose={onClose} title={t('gmail.sendTitle', language)}>
      <form onSubmit={send} className="space-y-3">
        <label className="block text-sm font-medium text-text-secondary">{t('gmail.to', language)}
          <input type="email" required value={to} onChange={e => setTo(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-text-secondary">{t('gmail.subject', language)}
          <input required value={subject} onChange={e => setSubject(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-text-secondary">{t('gmail.body', language)}
          <textarea required rows={10} value={body} onChange={e => setBody(e.target.value)} className={`${input} mt-1 text-text-primary`} />
        </label>
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-secondary text-sm font-semibold rounded-md hover:bg-border">{t('modal.cancel', language)}</button>
          <button type="submit" disabled={sending} className="px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50">
            {t(sending ? 'gmail.sending' : 'gmail.send', language)}
          </button>
        </div>
      </form>
    </Modal>
  );
};
