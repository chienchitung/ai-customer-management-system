import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { Customer } from '../types';
import { buildImport, csvTemplate, ImportPreview, RowIssue } from '../lib/csvImport';
import { downloadFile } from '../lib/storage';

type Language = 'en' | 'zh';

const REASONS: Record<RowIssue['reason'], [string, string]> = {
  missingName: ['缺少姓名', 'Missing name'],
  missingCompany: ['缺少公司', 'Missing company'],
  badEmail: ['Email 格式錯誤', 'Invalid email'],
  badAmount: ['金額無效', 'Invalid amount'],
  badDate: ['日期格式錯誤（請用 YYYY-MM-DD）', 'Invalid date (use YYYY-MM-DD)'],
  duplicate: ['已存在的客戶', 'Already exists'],
  duplicateInFile: ['檔案內重複', 'Duplicate in file'],
};

const FIELD_LABELS: Record<string, [string, string]> = {
  name: ['姓名', 'Name'], company: ['公司', 'Company'], email: ['Email', 'Email'], status: ['階段', 'Stage'],
  dealValue: ['金額', 'Amount'], currency: ['幣別', 'Currency'], lastContact: ['最後聯絡', 'Last contact'],
  nextAction: ['下一步', 'Next action'], dueDate: ['到期日', 'Due date'], painPoints: ['痛點', 'Pain points'],
  competitors: ['競爭對手', 'Competitors'], closedReason: ['結案原因', 'Closed reason'], notes: ['備註', 'Notes'],
};

const ImportCsvModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  existing: Customer[];
  onImport: (customers: Customer[]) => void;
  language: Language;
}> = ({ isOpen, onClose, existing, onImport, language }) => {
  const zh = language === 'zh';
  const L = (pair: [string, string]) => (zh ? pair[0] : pair[1]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isOpen) { setPreview(null); setFileName(''); setError(null); } }, [isOpen]);

  const read = async (file: File) => {
    setError(null);
    setFileName(file.name);
    if (/\.xlsx?$/i.test(file.name)) {
      setPreview(null);
      setError(zh ? 'Excel 檔請先「另存新檔」為 CSV（UTF-8）再匯入。' : 'Save the Excel file as CSV (UTF-8) first, then import it.');
      return;
    }
    const p = buildImport(await file.text(), existing);
    if (!p.mapping.includes('name') || !p.mapping.includes('company')) {
      setPreview(null);
      setError(zh ? '找不到「姓名」與「公司」欄位，請確認第一列是欄位名稱，或下載範本參考。' : 'Could not find "Name" and "Company" columns. Make sure the first row has headers, or use the template.');
      return;
    }
    setPreview(p);
  };

  const recognised = preview?.mapping.filter((f): f is NonNullable<typeof f> => !!f) ?? [];
  const ignored = preview ? preview.mapping.filter(f => !f).length : 0;

  return (
    <Modal size="md" isOpen={isOpen} onClose={onClose} title={zh ? '匯入客戶（CSV）' : 'Import customers (CSV)'}>
      <div className="space-y-4 text-sm">
        <p className="text-text-secondary">
          {zh ? '第一列需為欄位名稱，至少包含「姓名」與「公司」。支援中英文欄位名稱；Excel 請另存為 CSV（UTF-8）。重複的客戶會自動略過。'
            : 'The first row must contain headers, including at least Name and Company. English or Chinese headers work. Save Excel files as CSV (UTF-8). Existing customers are skipped.'}
        </p>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void read(f); }}
          className="rounded-lg border border-dashed border-border p-5 text-center space-y-2"
        >
          <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()}>{zh ? '選擇檔案' : 'Choose file'}</button>
          <p className="text-xs text-text-secondary">{fileName || (zh ? '或將檔案拖曳到這裡' : 'or drop a file here')}</p>
          <input ref={input} type="file" accept=".csv,text/csv,.xlsx,.xls" className="hidden" aria-label={zh ? '選擇 CSV 檔案' : 'Choose CSV file'}
            onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />
        </div>
        <button type="button" className="btn btn-ghost btn-sm text-primary" onClick={() => downloadFile(zh ? '客戶匯入範本.csv' : 'customer-import-template.csv', csvTemplate(language), 'text/csv;charset=utf-8')}>
          {zh ? '下載範本' : 'Download template'}
        </button>

        {error && <p role="alert" className="text-rose-600 dark:text-rose-400">{error}</p>}

        {preview && (
          <div className="space-y-3" aria-live="polite">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="card p-3"><p className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{preview.customers.length}</p><p className="text-xs text-text-secondary">{zh ? '可匯入' : 'To import'}</p></div>
              <div className="card p-3"><p className="text-xl font-semibold tabular-nums">{preview.issues.filter(i => i.reason.startsWith('duplicate')).length}</p><p className="text-xs text-text-secondary">{zh ? '重複略過' : 'Duplicates skipped'}</p></div>
              <div className="card p-3"><p className="text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">{preview.issues.filter(i => !i.reason.startsWith('duplicate')).length}</p><p className="text-xs text-text-secondary">{zh ? '有問題的列' : 'Rows with errors'}</p></div>
            </div>
            <p className="text-xs text-text-secondary">
              {zh ? '辨識到的欄位：' : 'Recognised columns: '}{recognised.map(f => L(FIELD_LABELS[f])).join('、') || '—'}
              {ignored > 0 && (zh ? `（略過 ${ignored} 個無法辨識的欄位）` : ` (${ignored} unrecognised column(s) ignored)`)}
            </p>
            {preview.issues.length > 0 && (
              <ul className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border text-xs">
                {preview.issues.map((i, k) => (
                  <li key={k} className="px-3 py-1.5 flex gap-2">
                    <span className="text-text-secondary tabular-nums w-14 flex-shrink-0">{zh ? `第 ${i.row} 列` : `Row ${i.row}`}</span>
                    <span className={i.reason.startsWith('duplicate') ? 'text-text-secondary' : 'text-rose-600 dark:text-rose-400'}>{L(REASONS[i.reason])}</span>
                    {i.detail && <span className="text-text-secondary truncate">· {i.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">{zh ? '取消' : 'Cancel'}</button>
          <button type="button" disabled={!preview?.customers.length} onClick={() => preview && onImport(preview.customers)} className="btn btn-primary">
            {zh ? `匯入 ${preview?.customers.length ?? 0} 位客戶` : `Import ${preview?.customers.length ?? 0} customers`}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ImportCsvModal;
