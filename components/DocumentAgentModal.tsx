import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { t, tf, translateStatus } from '../localization';
import { Customer, CustomerStatus } from '../types';
import { ApiError } from '../lib/api';
import { ACCEPTED_DOCUMENTS, MAX_UPLOAD_BYTES, ParsedDocument, documentContentType, parseDocument } from '../lib/documents';
import { ChangeKey, DocumentAnalysis, applyDocument, documentLogText, matchCustomer, prefillFromDocument, proposeChanges } from '../lib/documentAgent';
import { analyzeDocument } from '../services/geminiService';
import { aiErrorMessage } from './Dialogs';
import { todayISO } from '../lib/dates';
import { CheckIcon } from './icons';

type Language = 'en' | 'zh';
type Step = 'pick' | 'reading' | 'analyzing' | 'review';
const NEW = '__new__';

const DOC_ERRORS = ['compdf_not_configured', 'compdf_unauthorized', 'compdf_unreadable', 'compdf_failed', 'unsupported_document', 'payload_too_large'];

const errorText = (e: unknown, language: Language) =>
  e instanceof ApiError && DOC_ERRORS.includes(e.code) ? t(`docAgent.errors.${e.code}`, language) : aiErrorMessage(e, language);

const StepRow: React.FC<{ label: string; state: 'todo' | 'active' | 'done' }> = ({ label, state }) => (
  <li className={`flex items-center gap-2 text-sm ${state === 'todo' ? 'text-text-secondary' : 'text-text-primary'}`}>
    <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${state === 'done' ? 'bg-primary border-primary text-on-primary' : state === 'active' ? 'border-primary' : 'border-border'}`} aria-hidden="true">
      {state === 'done' ? <CheckIcon className="w-3 h-3" /> : state === 'active' ? <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> : null}
    </span>
    {label}
  </li>
);

export const DocumentAgentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  /** Preselects this customer, e.g. when opened from a customer's page. */
  customerId?: string | null;
  language: Language;
  onApply: (updated: Customer) => void;
  onCreateCustomer: (prefill: Partial<Customer>, logText: string) => void;
}> = ({ isOpen, onClose, customers, customerId, language, onApply, onCreateCustomer }) => {
  const [step, setStep] = useState<Step>('pick');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [target, setTarget] = useState<string>(NEW);
  const [selected, setSelected] = useState<Set<ChangeKey>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = todayISO();

  useEffect(() => {
    if (!isOpen) return;
    setStep('pick'); setError(null); setFileName(''); setParsed(null); setAnalysis(null); setSelected(new Set());
  }, [isOpen]);

  const match = useMemo(() => (analysis ? matchCustomer(analysis, customers) : null), [analysis, customers]);
  const customer = customers.find(c => c.id === target) ?? null;
  const changes = useMemo(() => (analysis && customer ? proposeChanges(customer, analysis, today) : []), [analysis, customer, today]);

  // Every proposed change starts selected; the user unticks what they disagree with.
  useEffect(() => { setSelected(new Set(changes.map(c => c.key))); }, [changes]);

  const run = async (file: File) => {
    setError(null);
    if (!documentContentType(file)) return setError(t('docAgent.errors.unsupported_document', language));
    if (file.size > MAX_UPLOAD_BYTES) return setError(t('docAgent.errors.payload_too_large', language));
    setFileName(file.name);
    setStep('reading');
    try {
      const doc = await parseDocument(file);
      setParsed(doc);
      setStep('analyzing');
      const a = await analyzeDocument(doc.text, file.name, customers, language);
      setAnalysis(a);
      const m = matchCustomer(a, customers);
      setTarget(customerId && customers.some(c => c.id === customerId) && !m ? customerId : m?.customerId ?? (customerId || NEW));
      setStep('review');
    } catch (e) {
      setError(errorText(e, language));
      setStep('pick');
    }
  };

  const typeLabel = analysis ? t(`docAgent.type.${analysis.documentType}`, language) : '';
  const logText = analysis ? documentLogText(analysis, fileName, typeLabel, t('docAgent.watch', language)) : '';

  const apply = () => {
    if (!analysis) return;
    if (!customer) {
      onCreateCustomer(prefillFromDocument(analysis, today), logText);
      return;
    }
    onApply(applyDocument(customer, analysis, [...selected], logText, today));
  };

  const changeValue = (key: ChangeKey, value: string) => (key === 'status' && value ? translateStatus(value as CustomerStatus, language) : value);
  const busy = step === 'reading' || step === 'analyzing';

  return (
    <Modal size="md" isOpen={isOpen} onClose={busy ? () => {} : onClose} title={t('docAgent.title', language)}>
      <div className="space-y-4">
        {step === 'pick' && (
          <>
            <p className="text-sm text-text-secondary">{t('docAgent.help', language)}</p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void run(f); }}
              className={`rounded-lg border-2 border-dashed px-4 py-8 flex flex-col items-center gap-2 transition-colors ${dragOver ? 'border-primary bg-secondary/60' : 'border-border'}`}
            >
              <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-primary">{t('docAgent.choose', language)}</button>
              <span className="text-xs text-text-secondary">{t('docAgent.drop', language)} · PDF, PNG, JPG · ≤ 3 MB</span>
              <input ref={inputRef} type="file" accept={ACCEPTED_DOCUMENTS} className="hidden" tabIndex={-1} aria-hidden="true"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(f); }} />
            </div>
          </>
        )}

        {busy && (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <ol className="space-y-2">
              <StepRow label={t('docAgent.stepRead', language)} state={step === 'reading' ? 'active' : 'done'} />
              <StepRow label={t('docAgent.stepAnalyze', language)} state={step === 'analyzing' ? 'active' : 'todo'} />
            </ol>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        {step === 'review' && analysis && parsed && (
          <>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="chip">{typeLabel}</span>
                <h3 className="text-sm font-semibold">{analysis.title || fileName}</h3>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {fileName}{parsed.pages ? ` · ${tf('docAgent.pages', language, { n: parsed.pages })}` : ''}
              </p>
              <p className="text-sm mt-2">{analysis.summary}</p>
              {parsed.truncated && <p className="text-xs text-text-secondary mt-1">{t('docAgent.truncated', language)}</p>}
            </div>

            <div>
              <label htmlFor="doc-customer" className="text-xs font-medium text-text-secondary">{t('docAgent.customer', language)}</label>
              <select id="doc-customer" value={target} onChange={e => setTarget(e.target.value)} className="input mt-1">
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.company}</option>)}
                <option value={NEW}>{t('docAgent.newCustomer', language)}</option>
              </select>
              <p className="text-xs text-text-secondary mt-1">
                {[analysis.counterpartyName, analysis.counterpartyCompany, analysis.counterpartyEmail].filter(Boolean).join(' · ')}
                {' · '}{t(`docAgent.match.${match?.reason ?? 'none'}`, language)}
              </p>
            </div>

            {(analysis.keyDates?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1">{t('docAgent.dates', language)}</p>
                <ul className="text-sm space-y-0.5">
                  {analysis.keyDates!.map((d, i) => <li key={i} className="flex justify-between gap-3"><span>{d.label}</span><span className="tabular-nums text-text-secondary">{d.date}</span></li>)}
                </ul>
              </div>
            )}

            {(analysis.watchItems?.length ?? 0) > 0 && (
              <div className="rounded-md border border-border bg-secondary/50 p-3">
                <p className="text-xs font-medium text-text-secondary mb-1">{t('docAgent.watch', language)}</p>
                <ul className="text-sm list-disc pl-5 space-y-0.5">{analysis.watchItems!.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}

            {customer && (
              <fieldset>
                <legend className="text-xs font-medium text-text-secondary mb-1">{t('docAgent.changes', language)}</legend>
                {changes.length === 0 ? (
                  <p className="text-sm text-text-secondary">{t('docAgent.noChanges', language)}</p>
                ) : (
                  <ul className="divide-y divide-border border border-border rounded-md">
                    {changes.map(ch => (
                      <li key={ch.key}>
                        <label className="flex items-start gap-3 p-2.5 cursor-pointer">
                          <input type="checkbox" className="mt-0.5" checked={selected.has(ch.key)}
                            onChange={e => setSelected(prev => { const next = new Set(prev); if (e.target.checked) next.add(ch.key); else next.delete(ch.key); return next; })} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{t(`docAgent.change.${ch.key}`, language)}</span>
                            <span className="block text-sm text-text-secondary break-words">
                              {ch.from && <><span className="line-through">{changeValue(ch.key, ch.from)}</span>{' → '}</>}
                              <span className="text-text-primary">{changeValue(ch.key, ch.to)}</span>
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-text-secondary hover:text-text-primary">{t('docAgent.showText', language)}</summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-secondary/40 p-3 text-xs">{parsed.text}</pre>
            </details>
          </>
        )}

        <div className="flex justify-end gap-2 flex-wrap">
          {step === 'review' && <button type="button" onClick={() => setStep('pick')} className="btn btn-ghost mr-auto">{t('docAgent.pick', language)}</button>}
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-secondary">{t('modal.cancel', language)}</button>
          {step === 'review' && (
            <button type="button" onClick={apply} className="btn btn-primary">
              {t(customer ? 'docAgent.apply' : 'docAgent.createCustomer', language)}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
