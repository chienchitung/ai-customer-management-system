import React, { useState } from 'react';
import { Customer, CustomerStatus } from '../types';
import { statusColors } from './CustomerDashboard';
import { translateStatus } from '../localization';

interface KanbanBoardProps {
    customers: Customer[];
    onMoveCustomer: (draggedId: string, newStatus: CustomerStatus, newIndex: number) => void;
    language: 'en' | 'zh';
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ customers, onMoveCustomer, language }) => {
    const [draggedItem, setDraggedItem] = useState<Customer | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{ status: CustomerStatus, index: number } | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, customer: Customer) => {
        e.dataTransfer.setData('customerId', customer.id);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedItem(customer);
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
        if (!dropIndicator || !draggedItem) return;
        
        const isSamePosition = draggedItem.status === dropIndicator.status && 
                               customers.filter(c => c.status === draggedItem.status).findIndex(c => c.id === draggedItem.id) === dropIndicator.index;

        if (!isSamePosition) {
            onMoveCustomer(draggedItem.id, dropIndicator.status, dropIndicator.index);
        }
        setDropIndicator(null);
        setDraggedItem(null);
    };
    
    const columns = Object.values(CustomerStatus);

    return (
        <>
            <style>{`
                .kanban-card.dragging {
                    opacity: 0.8;
                    transform: rotate(3deg);
                    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                }
                .drop-placeholder {
                    height: 8px;
                    background-color: rgb(var(--color-primary) / 0.5);
                    border-radius: 4px;
                    margin: 4px 0;
                    transition: height 0.1s ease-out;
                }
            `}</style>
            <div 
                className="flex gap-4 overflow-x-auto p-1 h-[calc(100vh-104px)]"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()} // Allow drop on the container
            >
                {columns.map(status => {
                    const customersInColumn = customers.filter(c => c.status === status);
                    const statusStyle = statusColors[status];
                    return (
                        <div
                            key={status}
                            className={`w-72 flex-shrink-0 bg-surface rounded-lg border border-border p-3 flex flex-col`}
                        >
                            <h3 className={`font-semibold mb-3 px-2 py-1 rounded text-sm inline-block ${statusStyle.text} ${statusStyle.bg}`}>
                                {translateStatus(status, language)} ({customersInColumn.length})
                            </h3>
                            <div 
                                className="flex-grow space-y-3 overflow-y-auto pr-1 -mr-1"
                                onDragOver={(e) => {
                                  // This allows dropping into an empty column or at the end
                                  if (draggedItem && draggedItem.status !== status && customersInColumn.length === 0) {
                                      handleDragOver(e, status, 0);
                                  }
                                }}
                                onDragLeave={() => {
                                    // If leaving the list area, clear indicator for this column
                                    if(dropIndicator?.status === status) {
                                        // setDropIndicator(null); // This can cause flickering, better to just let dragOver handle it
                                    }
                                }}
                            >
                                {customersInColumn.map((customer, index) => (
                                  <React.Fragment key={customer.id}>
                                    {dropIndicator?.status === status && dropIndicator?.index === index && (
                                        <div className="drop-placeholder" style={{ height: draggedItem ? '60px' : '8px' }}></div>
                                    )}
                                    <div
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, customer)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => handleDragOver(e, status, index)}
                                        className={`kanban-card bg-surface p-3 rounded-md border border-border shadow-sm cursor-grab active:cursor-grabbing transition-all duration-150 ${draggedItem?.id === customer.id ? 'dragging' : ''}`}
                                        style={{ display: draggedItem?.id === customer.id ? 'none' : 'block' }}
                                    >
                                        <h4 className="font-semibold text-sm text-text-primary">{customer.name}</h4>
                                        <p className="text-xs text-text-secondary">{customer.company}</p>
                                        {customer.dealValue && (
                                            <p className="text-xs font-semibold text-primary mt-2">
                                                ${customer.dealValue.toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                  </React.Fragment>
                                ))}
                                {dropIndicator?.status === status && dropIndicator?.index === customersInColumn.length && (
                                    <div className="drop-placeholder" style={{ height: draggedItem ? '60px' : '8px' }}></div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
};

export default KanbanBoard;