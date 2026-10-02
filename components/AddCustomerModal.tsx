import React, { useState, useEffect, useRef } from 'react';
import { CURRENCIES } from '../lib/currency';
import { DealAmount } from './Currency';
import { ChevronRight } from 'lucide-react';
import Modal from './Modal';
import { t, translateStatus } from '../localization';
import { Customer, CustomerStatus } from '../types';
import { PlusIcon, TrashIcon } from './icons';

import { generateId } from '../lib/ids';

type FieldErrors = Partial<Record<'name' | 'company' | 'email' | 'dealValue', string>>;

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? <p id={id} role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">{message}</p> : null;

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Customer>, customerId?: string) => void;
  customerToEdit: Customer | null;
  /** Pre-filled values for a new customer (e.g. from smart capture). */
  prefill?: Partial<Customer> | null;
  /** Existing customers, used to warn about likely duplicates when adding. */
  existing?: Customer[];
  onOpenExisting?: (customerId: string) => void;
  language: 'en' | 'zh';
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Same email (case-insensitive) or same name + company counts as a likely duplicate. */
export const findDuplicate = (existing: Customer[], name: string, company: string, email: string) =>
  existing.find(c =>
    (email.trim() && c.email && norm(c.email) === norm(email)) ||
    (norm(c.name) === norm(name) && norm(c.company) === norm(company)));

const getInitialState = (customer: Partial<Customer> | null) => {
    if (customer) {
        return {
            dealCurrency: customer.dealCurrency || 'USD',
            status: customer.status ?? CustomerStatus.LEAD,
            name: customer.name || '',
            company: customer.company || '',
            email: customer.email || '',
            dealValue: customer.dealValue?.toString() || '',
            keyContacts: customer.keyContacts?.length ? [...customer.keyContacts] : [{ id: generateId(), name: '', title: '' }],
            customerPainPoints: customer.customerPainPoints?.length ? [...customer.customerPainPoints] : [''],
            competitors: customer.competitors?.length ? [...customer.competitors] : [''],
            nextAction: {
                description: customer.nextAction?.description || '',
                dueDate: customer.nextAction?.dueDate || '',
            },
        };
    }
    return {
        dealCurrency: 'USD',
        status: CustomerStatus.LEAD,
        name: '',
        company: '',
        email: '',
        dealValue: '',
        keyContacts: [{ id: generateId(), name: '', title: '' }],
        customerPainPoints: [''],
        competitors: [''],
        nextAction: { description: '', dueDate: '' },
    };
};


const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, onSave, customerToEdit, prefill, existing = [], onOpenExisting, language }) => {
  const [formData, setFormData] = useState(getInitialState(customerToEdit ?? prefill ?? null));
  const [error, setError] = useState('');
  const isEditMode = !!customerToEdit;
  const source = customerToEdit ?? prefill;
  const hasDetails = !!(source?.keyContacts?.length || source?.customerPainPoints?.length || source?.competitors?.length);

  useEffect(() => {
    if (isOpen) {
        setError('');
        setFormData(getInitialState(customerToEdit ?? prefill ?? null));
    }
  }, [isOpen, customerToEdit, prefill]);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [duplicate, setDuplicate] = useState<Customer | null>(null);
  // A ref (not state) so "Add anyway" takes effect within the same submit.
  const allowDuplicate = useRef(false);
  useEffect(() => { if (isOpen) { setFieldErrors({}); setDuplicate(null); allowDuplicate.current = false; } }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (['name', 'company', 'email'].includes(name)) { setDuplicate(null); allowDuplicate.current = false; }
    // Clear a field's error as soon as the user edits it.
    setFieldErrors(prev => (name in prev ? { ...prev, [name]: undefined } : prev));
  };
  
  const handleNextActionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, nextAction: { ...prev.nextAction, [name]: value } }));
  };

  const handleDynamicListChange = (listName: 'customerPainPoints' | 'competitors', index: number, value: string) => {
    const newList = [...formData[listName]];
    newList[index] = value;
    setFormData(prev => ({ ...prev, [listName]: newList }));
  };

  const addDynamicListItem = (listName: 'customerPainPoints' | 'competitors') => {
    setFormData(prev => ({ ...prev, [listName]: [...prev[listName], ''] }));
  };

  const handleContactChange = (index: number, field: 'name' | 'title', value: string) => {
    const newContacts = [...formData.keyContacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setFormData(prev => ({ ...prev, keyContacts: newContacts }));
  };

  const addContact = () => {
    setFormData(prev => ({ ...prev, keyContacts: [...prev.keyContacts, { id: generateId(), name: '', title: '' }] }));
  };
  
  const removeListItem = (listName: 'keyContacts' | 'customerPainPoints' | 'competitors', index: number) => {
    if (formData[listName].length > 1) {
        const newList = formData[listName].filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, [listName]: newList }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { dealCurrency, status, name, company, email, dealValue, keyContacts, customerPainPoints, competitors, nextAction } = formData;
    // In-app validation (localized, shown next to each field) instead of the browser's own bubbles.
    const zh = language === 'zh';
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = zh ? '請輸入姓名。' : 'Enter a name.';
    if (!company.trim()) errors.company = zh ? '請輸入公司名稱。' : 'Enter a company.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = zh ? 'Email 格式不正確，例如 name@company.com。' : 'Enter a valid email, e.g. name@company.com.';
    if (dealValue !== '' && !(Number(dealValue) >= 0)) errors.dealValue = zh ? '金額不能是負數。' : 'Amount cannot be negative.';
    setFieldErrors(errors);
    const firstInvalid = (['name', 'company', 'email', 'dealValue'] as const).find(k => errors[k]);
    if (firstInvalid) {
      document.getElementById(`customer-${firstInvalid}`)?.focus();
      return;
    }

    const finalData: Partial<Customer> = {
        dealCurrency, status, name: name.trim(), company: company.trim(), email: email.trim(),
        dealValue: dealValue ? parseFloat(dealValue) : undefined,
        keyContacts: keyContacts.filter(c => c.name.trim() !== ''),
        customerPainPoints: customerPainPoints.map(p => p.trim()).filter(p => p !== ''),
        competitors: competitors.map(c => c.trim()).filter(c => c !== ''),
        nextAction: nextAction.description.trim() ? { description: nextAction.description.trim(), dueDate: nextAction.dueDate } : undefined,
    };
    if (!customerToEdit && !allowDuplicate.current) {
      const dup = findDuplicate(existing, name, company, email);
      if (dup) { setDuplicate(dup); return; }
    }
    onSave(finalData, customerToEdit?.id);
  };

  const renderDynamicList = (listName: 'customerPainPoints' | 'competitors', labelKey: string, addActionKey: string) => (
    <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">{t(labelKey, language)}</label>
        <div className="space-y-2">
            {formData[listName].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                    <textarea
                        aria-label={`${t(labelKey, language)} ${index + 1}`}
                        value={item}
                        onChange={(e) => handleDynamicListChange(listName, index, e.target.value)}
                        className="input resize-y"
                        rows={2}
                    />
                    <button
                        type="button"
                        onClick={() => removeListItem(listName, index)}
                        className={`p-2 text-text-secondary hover:text-red-500 transition ${formData[listName].length === 1 ? 'opacity-0 cursor-default' : ''}`}
                        disabled={formData[listName].length === 1}
                        aria-label={t('modal.remove', language)}
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
        <button type="button" onClick={() => addDynamicListItem(listName)} className="btn btn-ghost btn-sm mt-2 text-primary">
            <PlusIcon className="w-4 h-4" />
            {t(addActionKey, language)}
        </button>
    </div>
  );


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(isEditMode ? 'modal.editTitle' : 'modal.addTitle', language)}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {duplicate && (
          <div role="alert" className="rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm space-y-2">
            <p>{language === 'zh'
              ? `可能重複：已有「${duplicate.name}」（${duplicate.company}${duplicate.email ? `，${duplicate.email}` : ''}）。`
              : `Possible duplicate: "${duplicate.name}" (${duplicate.company}${duplicate.email ? `, ${duplicate.email}` : ''}) already exists.`}</p>
            <div className="flex flex-wrap gap-2">
              {onOpenExisting && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenExisting(duplicate.id)}>{language === 'zh' ? '開啟現有客戶' : 'Open existing customer'}</button>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={e => { allowDuplicate.current = true; e.currentTarget.form?.requestSubmit(); }}>{language === 'zh' ? '仍要新增' : 'Add anyway'}</button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* Left Column: Primary & Deal Info */}
            <div className="space-y-4">
                <h4 className="card-title">{t('modal.primaryInfo', language)}</h4>
                <div><label htmlFor="customer-status" className="block text-xs font-medium text-text-secondary mb-1">{language === 'zh' ? '商機階段' : 'Deal stage'}</label><select id="customer-status" name="status" value={formData.status} onChange={handleInputChange} className="input">{Object.values(CustomerStatus).map(status => <option key={status} value={status}>{translateStatus(status, language)}</option>)}</select></div>
                <div>
                  <label htmlFor="customer-name" className="block text-xs font-medium text-text-secondary mb-1">{t('modal.fullName', language)} *</label>
                  <input type="text" id="customer-name" name="name" value={formData.name} onChange={handleInputChange} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? "customer-name-error" : undefined} className={`input ${fieldErrors.name ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : ""}`} required autoFocus />
                  <FieldError id="customer-name-error" message={fieldErrors.name} />
                </div>
                <div>
                  <label htmlFor="customer-company" className="block text-xs font-medium text-text-secondary mb-1">{t('modal.company', language)} *</label>
                  <input type="text" id="customer-company" name="company" value={formData.company} onChange={handleInputChange} aria-invalid={!!fieldErrors.company} aria-describedby={fieldErrors.company ? "customer-company-error" : undefined} className={`input ${fieldErrors.company ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : ""}`} required />
                  <FieldError id="customer-company-error" message={fieldErrors.company} />
                </div>
                <div>
                  <label htmlFor="customer-email" className="block text-xs font-medium text-text-secondary mb-1">{t('modal.emailAddress', language)}</label>
                  <input type="email" id="customer-email" name="email" value={formData.email} onChange={handleInputChange} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "customer-email-error" : undefined} className={`input ${fieldErrors.email ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : ""}`} />
                  <FieldError id="customer-email-error" message={fieldErrors.email} />
                </div>
                <div>
                  <label htmlFor="customer-dealValue" className="block text-xs font-medium text-text-secondary mb-1">{language === 'zh' ? '交易金額' : 'Deal amount'}</label>
                  {/* Amount and its original currency sit together; the converted value is a hint below. */}
                  <div className="flex gap-2">
                    <input type="number" min="0" step="any" id="customer-dealValue" name="dealValue" placeholder="0.00" value={formData.dealValue} onChange={handleInputChange} aria-invalid={!!fieldErrors.dealValue} aria-describedby={fieldErrors.dealValue ? 'customer-dealValue-error' : undefined} className={`input flex-1 min-w-0 ${fieldErrors.dealValue ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} />
                    <select id="deal-currency" name="dealCurrency" aria-label={language === 'zh' ? '交易原幣' : 'Original currency'} className="input w-24 flex-shrink-0" value={formData.dealCurrency} onChange={handleInputChange}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <FieldError id="customer-dealValue-error" message={fieldErrors.dealValue} />
                  {formData.dealValue !== '' && !fieldErrors.dealValue && <p className="mt-1 text-xs text-text-secondary"><DealAmount equivalent customer={{ dealValue: Number(formData.dealValue), dealCurrency: formData.dealCurrency } as Customer} /></p>}
                </div>
            </div>

            {/* Right Column: Next Action */}
            <div className="space-y-4">
                 <h4 className="card-title">{t('nextAction', language)}</h4>
                <div>
                    <label htmlFor="customer-description" className="block text-xs font-medium text-text-secondary mb-1">{t('modal.nextActionDesc', language)}</label>
                    <textarea id="customer-description" name="description" value={formData.nextAction.description} onChange={handleNextActionChange} className="input" rows={3} />
                </div>
                <div>
                    <label htmlFor="customer-dueDate" className="block text-xs font-medium text-text-secondary mb-1">{t('modal.nextActionDueDate', language)}</label>
                    <input type="date" id="customer-dueDate" name="dueDate" value={formData.nextAction.dueDate} onChange={handleNextActionChange} className="input" />
                </div>
            </div>
        </div>

        {/* Optional details, collapsed unless they already contain data */}
        <details open={hasDetails} className="group rounded-lg border border-border">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-text-primary list-none flex items-center gap-2 hover:bg-secondary/50 rounded-lg">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-text-secondary" />{t('detailsMore', language)}
        </summary>
        <div className="px-4 pb-4 space-y-6">
        <div className="pt-2">
            <h4 className="card-title">{t('keyContacts', language)}</h4>
            <div className="space-y-3 mt-3">
            {formData.keyContacts.map((contact, index) => (
                <div key={contact.id} className="grid grid-cols-[1fr,1fr,auto] gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">{t('modal.contactName', language)}</label>
                        <input aria-label={`${t('modal.contactName', language)} ${index + 1}`} type="text" value={contact.name} onChange={e => handleContactChange(index, 'name', e.target.value)} className="input" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">{t('modal.contactTitle', language)}</label>
                        <input aria-label={`${t('modal.contactTitle', language)} ${index + 1}`} type="text" value={contact.title} onChange={e => handleContactChange(index, 'title', e.target.value)} className="input" />
                    </div>
                    <div>
                        <button type="button" onClick={() => removeListItem('keyContacts', index)} className={`p-2 text-text-secondary hover:text-red-500 transition ${formData.keyContacts.length === 1 ? 'opacity-0 cursor-default' : ''}`} disabled={formData.keyContacts.length === 1} aria-label={t('modal.remove', language)}><TrashIcon className="w-5 h-5" /></button>
                    </div>
                </div>
            ))}
            </div>
            <button type="button" onClick={addContact} className="btn btn-ghost btn-sm mt-2 text-primary"><PlusIcon className="w-4 h-4" />{t('modal.addContact', language)}</button>
        </div>

        {/* Intelligence (Full Width) */}
        <div className="pt-4">
            <h4 className="card-title">{t('customerPainPoints', language)} &amp; {t('knownCompetitors', language)}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-3">
                {renderDynamicList('customerPainPoints', 'customerPainPoints', 'modal.addPainPoint')}
                {renderDynamicList('competitors', 'knownCompetitors', 'modal.addCompetitor')}
            </div>
        </div>
        </div>
        </details>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border -mx-5 px-5 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">{t('modal.cancel', language)}</button>
            <button type="submit" className="btn btn-primary">{t(isEditMode ? 'modal.saveChanges' : 'modal.addCustomer', language)}</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddCustomerModal;
