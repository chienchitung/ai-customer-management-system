import React, { useState } from 'react';
import { Customer, CustomerStatus } from '../types';
// FIX: Import the 't' function for localization.
import { t, translateStatus } from '../localization';
import { todayISO } from '../lib/dates';
import { PencilIcon, PlusIcon } from './icons';

interface KanbanBoardProps {
    customers: Customer[];
    onMoveCustomer: (draggedId: string, newStatus: CustomerStatus, newIndex: number) => void;
    language: 'en' | 'zh';
    onEditCustomer: (customer: Customer) => void;
    onOpenAddCustomerModal: () => void;
    selectedCustomerId: string | null;
    onSelectCustomer: (id: string | null) => void;
}

const columnStyles: { [key in CustomerStatus]: { bg: string; dot: string; } } = {
  [CustomerStatus.LEAD]: { bg: 'bg-slate-100 dark:bg-slate-800/50', dot: 'bg-slate-400' },
  [CustomerStatus.PROSPECT]: { bg: 'bg-blue-100/50 dark:bg-blue-900/20', dot: 'bg-blue-500' },
  [CustomerStatus.NEGOTIATION]: { bg: 'bg-amber-100/50 dark:bg-amber-900/20', dot: 'bg-amber-500' },
  [CustomerStatus.CLOSED_WON]: { bg: 'bg-green-100/50 dark:bg-green-900/20', dot: 'bg-green-500' },
  [CustomerStatus.CLOSED_LOST]: { bg: 'bg-rose-100/50 dark:bg-rose-900/20', dot: 'bg-rose-500' },
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
    customers, 
    onMoveCustomer, 
    language, 
    onEditCustomer, 
    onOpenAddCustomerModal,
    selectedCustomerId,
    onSelectCustomer
}) => {
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
            className="flex gap-4 overflow-x-auto p-1 h-full"
            onDragOver={(e) => e.preventDefault()}
        >
            {columns.map(status => {
                const customersInColumn = customers.filter(c => c.status === status);
                return (
                    <div
                        key={status}
                        className={`w-72 flex-shrink-0 rounded-lg flex flex-col ${columnStyles[status].bg}`}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={handleDrop}
                    >
                        <div className="p-3 sticky top-0 z-10 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${columnStyles[status].dot}`}></span>
                                <h3 className="font-semibold text-text-primary text-sm">
                                    {translateStatus(status, language)}
                                </h3>
                                <span className="text-sm font-medium text-text-secondary">{customersInColumn.length}</span>
                                <span className="text-xs text-text-secondary">· ${customersInColumn.reduce((sum, c) => sum + (c.dealValue ?? 0), 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center">
                                <button onClick={onOpenAddCustomerModal} className="w-6 h-6 flex items-center justify-center text-text-secondary hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors">
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
                                    className={`bg-surface p-2.5 rounded-md border cursor-pointer active:cursor-grabbing transition-all duration-150 shadow-sm ${draggedItem?.id === customer.id ? 'opacity-40 rotate-2 shadow-lg' : ''} ${selectedCustomerId === customer.id ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                                >
                                    <div className="flex items-start gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditCustomer(customer);
                                            }}
                                            className="p-1 rounded text-text-secondary hover:bg-secondary"
                                            aria-label={`${t('editCustomer', language)}: ${customer.name}`}
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <div className="flex-grow min-w-0">
                                            <h4 className="font-medium text-sm text-text-primary truncate">{customer.name}</h4>
                                            <p className="text-xs text-text-secondary truncate">{customer.company}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs">
                                                {customer.dealValue ? <span className="font-semibold text-primary">${customer.dealValue.toLocaleString()}</span> : null}
                                                {customer.nextAction?.dueDate && (
                                                    <span className={customer.nextAction.dueDate < today ? 'text-rose-600 dark:text-rose-400 font-semibold' : customer.nextAction.dueDate === today ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-text-secondary'}>
                                                        {customer.nextAction.dueDate}
                                                    </span>
                                                )}
                                            </div>
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
                             <button onClick={onOpenAddCustomerModal} className="w-full text-left text-sm font-medium text-text-secondary hover:bg-black/5 dark:hover:bg-white/10 p-2 rounded-md flex items-center gap-2 transition-colors">
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