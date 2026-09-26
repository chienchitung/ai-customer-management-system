import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { t } from '../localization';
import { Customer, KeyContact } from '../types';
import { PlusIcon, TrashIcon } from './icons';

import { generateId } from '../lib/ids';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Customer>, customerId?: string) => void;
  customerToEdit: Customer | null;
  /** Pre-filled values for a new customer (e.g. from smart capture). */
  prefill?: Partial<Customer> | null;
  language: 'en' | 'zh';
}

const getInitialState = (customer: Partial<Customer> | null) => {
    if (customer) {
        return {
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


const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, onSave, customerToEdit, prefill, language }) => {
  const [formData, setFormData] = useState(getInitialState(customerToEdit ?? prefill ?? null));
  const isEditMode = !!customerToEdit;

  useEffect(() => {
    if (isOpen) {
        setFormData(getInitialState(customerToEdit ?? prefill ?? null));
    }
  }, [isOpen, customerToEdit, prefill]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    const { name, company, email, dealValue, keyContacts, customerPainPoints, competitors, nextAction } = formData;
    if (!name.trim() || !company.trim()) return;

    const finalData: Partial<Customer> = {
        name: name.trim(), company: company.trim(), email: email.trim(),
        dealValue: dealValue ? parseFloat(dealValue) : undefined,
        keyContacts: keyContacts.filter(c => c.name.trim() !== ''),
        customerPainPoints: customerPainPoints.map(p => p.trim()).filter(p => p !== ''),
        competitors: competitors.map(c => c.trim()).filter(c => c !== ''),
        nextAction: nextAction.description.trim() ? { description: nextAction.description.trim(), dueDate: nextAction.dueDate } : undefined,
    };
    onSave(finalData, customerToEdit?.id);
  };

  const renderDynamicList = (listName: 'customerPainPoints' | 'competitors', labelKey: string, addActionKey: string) => (
    <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">{t(labelKey, language)}</label>
        <div className="space-y-2">
            {formData[listName].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                    <textarea
                        value={item}
                        onChange={(e) => handleDynamicListChange(listName, index, e.target.value)}
                        className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-inset focus:ring-primary/50 outline-none transition resize-y"
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
        <button type="button" onClick={() => addDynamicListItem(listName)} className="mt-2 text-sm font-semibold text-primary hover:text-primary/80 flex items-center gap-1">
            <PlusIcon className="w-4 h-4" />
            {t(addActionKey, language)}
        </button>
    </div>
  );


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(isEditMode ? 'modal.editTitle' : 'modal.addTitle', language)}>
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* Left Column: Primary & Deal Info */}
            <div className="space-y-4">
                <h4 className="text-base font-semibold text-text-primary border-b border-border pb-2">{t('modal.primaryInfo', language)}</h4>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">{t('modal.fullName', language)}</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-inset focus:ring-primary/50 outline-none transition" required autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">{t('modal.company', language)}</label>
                  <input type="text" name="company" value={formData.company} onChange={handleInputChange} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-inset focus:ring-primary/50 outline-none transition" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">{t('modal.emailAddress', language)}</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-inset focus:ring-primary/50 outline-none transition" />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">{t('modal.dealValue', language)}</label>
                  <input type="number" name="dealValue" placeholder={t('modal.dealValuePlaceholder', language)} value={formData.dealValue} onChange={handleInputChange} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-inset focus:ring-primary/50 outline-none transition" />
                </div>
            </div>

            {/* Right Column: Next Action */}
            <div className="space-y-4">
                 <h4 className="text-base font-semibold text-text-primary border-b border-border pb-2">{t('nextAction', language)}</h4>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">{t('modal.nextActionDesc', language)}</label>
                    <textarea name="description" value={formData.nextAction.description} onChange={handleNextActionChange} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-inset focus:ring-primary/50 outline-none transition" rows={6} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">{t('modal.nextActionDueDate', language)}</label>
                    <input type="date" name="dueDate" value={formData.nextAction.dueDate} onChange={handleNextActionChange} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-inset focus:ring-primary/50 outline-none transition" />
                </div>
            </div>
        </div>

        {/* Key Contacts (Full Width) */}
        <div className="pt-4">
            <h4 className="text-base font-semibold text-text-primary border-b border-border pb-2">{t('keyContacts', language)}</h4>
            <div className="space-y-3 mt-3">
            {formData.keyContacts.map((contact, index) => (
                <div key={contact.id} className="grid grid-cols-[1fr,1fr,auto] gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">{t('modal.contactName', language)}</label>
                        <input type="text" value={contact.name} onChange={e => handleContactChange(index, 'name', e.target.value)} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-inset focus:ring-primary/50 outline-none transition" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">{t('modal.contactTitle', language)}</label>
                        <input type="text" value={contact.title} onChange={e => handleContactChange(index, 'title', e.target.value)} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-inset focus:ring-primary/50 outline-none transition" />
                    </div>
                    <div>
                        <button type="button" onClick={() => removeListItem('keyContacts', index)} className={`p-2 text-text-secondary hover:text-red-500 transition ${formData.keyContacts.length === 1 ? 'opacity-0 cursor-default' : ''}`} disabled={formData.keyContacts.length === 1} aria-label={t('modal.remove', language)}><TrashIcon className="w-5 h-5" /></button>
                    </div>
                </div>
            ))}
            </div>
            <button type="button" onClick={addContact} className="mt-3 text-sm font-semibold text-primary hover:text-primary/80 flex items-center gap-1"><PlusIcon className="w-4 h-4" />{t('modal.addContact', language)}</button>
        </div>

        {/* Intelligence (Full Width) */}
        <div className="pt-4">
            <h4 className="text-base font-semibold text-text-primary border-b border-border pb-2">{t('customerPainPoints', language)} &amp; {t('knownCompetitors', language)}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-3">
                {renderDynamicList('customerPainPoints', 'customerPainPoints', 'modal.addPainPoint')}
                {renderDynamicList('competitors', 'knownCompetitors', 'modal.addCompetitor')}
            </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-secondary text-text-primary text-sm font-semibold rounded-md hover:bg-border dark:hover:bg-slate-600 transition">{t('modal.cancel', language)}</button>
            <button type="submit" className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition">{t(isEditMode ? 'modal.saveChanges' : 'modal.addCustomer', language)}</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddCustomerModal;