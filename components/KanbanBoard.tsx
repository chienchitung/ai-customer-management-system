import { DealAmount, useCurrency } from './Currency';
import { convertMoney, formatMoney } from '../lib/currency';
import React, { useState } from 'react';
import { Customer, CustomerStatus } from '../types';
// FIX: Import the 't' function for localization.
import { t, translateStatus } from '../localization';
import { todayISO } from '../lib/dates';
import { formatDate } from '../lib/format';
import { PencilIcon, PlusIcon } from './icons';
import { Avatar, STATUS_DOT } from './ui';

interface KanbanBoardProps {
    customers: Customer[];
    onMoveCustomer: (draggedId: string, newStatus: CustomerStatus, newIndex: number) => void;
    language: 'en' | 'zh';
    onEditCustomer: (customer: Customer) => void;
    onOpenAddCustomerModal: (status?: CustomerStatus) => void;
    selectedCustomerId: string | null;
    onSelectCustomer: (id: string | null) => void;
}

const columnStyles = Object.fromEntries(
  Object.values(CustomerStatus).map(s => [s, { bg: 'bg-secondary/50', dot: STATUS_DOT[s] }]),
) as Record<CustomerStatus, { bg: string; dot: string }>;

const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
    customers, 
    onMoveCustomer, 
    language, 
    onEditCustomer, 
    onOpenAddCustomerModal,
    selectedCustomerId,
    onSelectCustomer
}) => {
    const fx = useCurrency();
    const [draggedItem, setDraggedItem] = useState<Customer | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{ status: CustomerStatus, index: number } | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, customer: Customer) => {
        e.dataTransfer.setData('customerId', customer.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            setDraggedItem(customer);
        }, 0);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDropIndicator(null);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, status: CustomerStatus, index: number) => {
        e.preventDefault();
        if (dropIndicator?.status === status && dropIndicator?.index === index) return;
        setDropIndicator({ status, index });
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const customerId = e.dataTransfer.getData('customerId');
        if (!dropIndicator || !customerId) {
            handleDragEnd();
            return;
        };
        onMoveCustomer(customerId, dropIndicator.status, dropIndicator.index);
        handleDragEnd();
    };
    
    const columns = Object.values(CustomerStatus);
    const today = todayISO();

    return (
        <div 
            className="flex gap-3 overflow-x-auto p-4 md:p-6 h-full"
            onDragOver={(e) => e.preventDefault()}
        >
            {columns.map(status => {
                const customersInColumn = customers.filter(c => c.status === status);
                return (
                    <div
                        key={status}
                        className={`w-72 flex-shrink-0 rounded-lg flex flex-col border border-border ${columnStyles[status].bg}`}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={handleDrop}
                    >
                        <div className="p-3 sticky top-0 z-10 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${columnStyles[status].dot}`}></span>
                                <h3 className="font-medium text-text-primary text-sm">
                                    {translateStatus(status, language)}
                                </h3>
                                <span className="text-sm font-medium text-text-secondary">{customersInColumn.length}</span>
                                <span className="text-xs text-text-secondary">· {customersInColumn.some(c => c.dealValue != null && convertMoney(c.dealValue, c.dealCurrency || 'USD', fx.currency, fx.rates) == null) ? '—' : formatMoney(customersInColumn.reduce((sum, c) => sum + (convertMoney(c.dealValue ?? 0, c.dealCurrency || 'USD', fx.currency, fx.rates) ?? 0), 0), fx.currency)}</span>
                            </div>
                            <div className="flex items-center">
                                <button onClick={() => onOpenAddCustomerModal(status)} aria-label={`${t('addNewCustomer', language)}: ${translateStatus(status, language)}`} title={t('addNewCustomer', language)} className="w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors">
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div 
                            className="flex-grow space-y-2 overflow-y-auto px-2"
                            onDragOver={(e) => {
                                e.stopPropagation();
                                handleDragOver(e, status, customersInColumn.length);
                            }}
                        >
                            {customersInColumn.map((customer, index) => (
                              <React.Fragment key={customer.id}>
                                {dropIndicator?.status === status && dropIndicator?.index === index && (
                                    <div className="w-full h-1 bg-primary rounded-full" />
                                )}
                                <div
                                    draggable
                                    onClick={() => onSelectCustomer(customer.id)}
                                    onDragStart={(e) => handleDragStart(e, customer)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => {
                                        e.stopPropagation();
                                        handleDragOver(e, status, index);
                                    }}
                                    className={`bg-surface p-2.5 rounded-md border cursor-pointer active:cursor-grabbing transition-all duration-150 shadow-sm hover:shadow ${draggedItem?.id === customer.id ? 'opacity-40 rotate-2 shadow-lg' : ''} ${selectedCustomerId === customer.id ? 'border-primary ring-1 ring-primary/40' : 'border-border'}`}
                                >
                                    <div className="flex items-start gap-2 relative group/card">
                                        <Avatar name={customer.name} size="sm" />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditCustomer(customer);
                                            }}
                                            className="btn btn-ghost btn-icon btn-sm w-6 h-6 absolute -top-1 -right-1 opacity-0 group-hover/card:opacity-100 focus:opacity-100"
                                            aria-label={`${t('editCustomer', language)}: ${customer.name}`}
                                        >
                                            <PencilIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="flex-grow min-w-0">
                                            <h4 className="font-medium text-sm text-text-primary truncate">{customer.name}</h4>
                                            <p className="text-xs text-text-secondary truncate">{customer.company}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs">
                                                {customer.dealValue ? <span className="font-medium tabular-nums"><DealAmount customer={customer} /></span> : null}
                                                {customer.nextAction?.dueDate && (
                                                    <span className={customer.nextAction.dueDate < today ? 'text-rose-600 dark:text-rose-400 font-medium' : customer.nextAction.dueDate === today ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-text-secondary'}>
                                                        {formatDate(customer.nextAction.dueDate, language)}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Drag and drop doesn't work on touch screens; offer a menu instead. */}
                                            <select
                                                value=""
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => {
                                                    const next = e.target.value as CustomerStatus;
                                                    if (next) onMoveCustomer(customer.id, next, customers.filter(c => c.status === next).length);
                                                }}
                                                aria-label={`${t('moveTo', language)} ${customer.name}`}
                                                className="coarse-only mt-2 w-full text-xs bg-secondary rounded-md px-2 py-1"
                                            >
                                                <option value="">{t('moveTo', language)}</option>
                                                {columns.filter(s => s !== status).map(s => <option key={s} value={s}>{translateStatus(s, language)}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                              </React.Fragment>
                            ))}
                            {dropIndicator?.status === status && dropIndicator?.index === customersInColumn.length && (
                                 <div className="w-full h-1 bg-primary rounded-full" />
                            )}
                        </div>
                        <div className="px-2 pt-1 pb-2">
                             <button onClick={() => onOpenAddCustomerModal(status)} className="btn btn-ghost btn-sm w-full justify-start">
                                <PlusIcon className="w-4 h-4" />
                                {t('addNewCustomer', language)}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default KanbanBoard;
