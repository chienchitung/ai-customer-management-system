import React from 'react';
import { Customer, CustomerStatus } from '../types';
import { statusColors } from './CustomerDashboard';
import { translateStatus } from '../localization';

interface KanbanBoardProps {
    customers: Customer[];
    onUpdateCustomer: (customerId: string, updatedData: Partial<Omit<Customer, 'id'>>) => void;
    language: 'en' | 'zh';
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ customers, onUpdateCustomer, language }) => {
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, customerId: string) => {
        e.dataTransfer.setData('customerId', customerId);
        e.currentTarget.classList.add('opacity-50', 'scale-105');
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('opacity-50', 'scale-105');
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-secondary');
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-secondary');
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: CustomerStatus) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-secondary');
        const customerId = e.dataTransfer.getData('customerId');
        const customer = customers.find(c => c.id === customerId);
        if (customer && customer.status !== newStatus) {
            onUpdateCustomer(customerId, { status: newStatus });
        }
    };
    
    const columns = Object.values(CustomerStatus);

    return (
        <div className="flex gap-4 overflow-x-auto p-1 h-[calc(100vh-104px)]">
            {columns.map(status => {
                const customersInColumn = customers.filter(c => c.status === status);
                const statusStyle = statusColors[status];
                return (
                    <div
                        key={status}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, status)}
                        className={`w-72 flex-shrink-0 bg-surface rounded-lg border border-border p-3 flex flex-col transition-colors`}
                    >
                        <h3 className={`font-semibold mb-3 px-2 py-1 rounded text-sm inline-block ${statusStyle.text} ${statusStyle.bg}`}>
                            {translateStatus(status, language)} ({customersInColumn.length})
                        </h3>
                        <div className="flex-grow space-y-3 overflow-y-auto pr-1 -mr-1">
                            {customersInColumn.map(customer => (
                                <div
                                    key={customer.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, customer.id)}
                                    onDragEnd={handleDragEnd}
                                    className="bg-surface p-3 rounded-md border border-border shadow-sm cursor-grab active:cursor-grabbing transition-transform"
                                >
                                    <h4 className="font-semibold text-sm text-text-primary">{customer.name}</h4>
                                    <p className="text-xs text-text-secondary">{customer.company}</p>
                                    {customer.dealValue && (
                                        <p className="text-xs font-semibold text-primary mt-2">
                                            ${customer.dealValue.toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default KanbanBoard;