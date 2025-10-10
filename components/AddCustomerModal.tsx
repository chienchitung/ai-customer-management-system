import React, { useState } from 'react';
import Modal from './Modal';
import { t } from '../localization';
import { Customer } from '../types';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomer: (customerData: Omit<Customer, 'id' | 'interactions' | 'lastContact' | 'status'>) => void;
  language: 'en' | 'zh';
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, onAddCustomer, language }) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && company && email) {
      onAddCustomer({ name, company, email });
      setName('');
      setCompany('');
      setEmail('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modalTitle', language)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{t('fullName', language)}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{t('company', language)}</label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{t('emailAddress', language)}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition" required />
        </div>
        <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-secondary text-text-primary text-sm font-semibold rounded-md hover:bg-border transition">{t('cancel', language)}</button>
            <button type="submit" className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition">{t('addCustomer', language)}</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddCustomerModal;