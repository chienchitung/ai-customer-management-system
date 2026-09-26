import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Customer, CustomerStatus, Interaction, InteractionType, KeyContact, NextAction } from '../types';
import { t, tf, translateStatus, translateInteractionType } from '../localization';
import AIAssistant from './AIAssistant';
import KanbanBoard from './KanbanBoard';
import { aiErrorMessage } from './Dialogs';
import { organizeMeetingNotes, OrganizedNotes } from '../services/geminiService';
import { daysBetween, todayISO, addDays } from '../lib/dates';
import { isOpen, STALE_DAYS } from '../lib/insights';
import { ArrowLeftIcon, CalendarIcon, IdentificationIcon, LightBulbIcon, PencilIcon, SearchIcon, FilterIcon, SparklesIcon, MicrophoneIcon, TrashIcon, CheckIcon } from './icons';

// Mapping customer statuses to specific Tailwind CSS classes for color-coding.
export const statusColors: { [key in CustomerStatus]: { text: string; bg: string; border: string; dropdown: string } } = {
  [CustomerStatus.LEAD]: { text: 'text-sky-800 dark:text-sky-200', bg: 'bg-sky-200/60 dark:bg-sky-500/30', border: 'border-sky-300 dark:border-sky-500/40', dropdown: 'border-sky-500/50 text-sky-800 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-200' },
  [CustomerStatus.PROSPECT]: { text: 'text-blue-800 dark:text-blue-200', bg: 'bg-blue-200/60 dark:bg-blue-500/30', border: 'border-blue-300 dark:border-blue-500/40', dropdown: 'border-blue-500/50 text-blue-800 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-200' },
  [CustomerStatus.NEGOTIATION]: { text: 'text-amber-800 dark:text-amber-200', bg: 'bg-amber-200/60 dark:bg-amber-500/30', border: 'border-amber-300 dark:border-amber-500/40', dropdown: 'border-amber-500/50 text-amber-800 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-200' },
  [CustomerStatus.CLOSED_WON]: { text: 'text-green-800 dark:text-green-200', bg: 'bg-green-200/70 dark:bg-green-500/30', border: 'border-green-300 dark:border-green-500/40', dropdown: 'border-green-500/50 text-green-800 bg-green-50 dark:bg-green-500/10 dark:text-green-200' },
  [CustomerStatus.CLOSED_LOST]: { text: 'text-rose-800 dark:text-rose-200', bg: 'bg-rose-200/60 dark:bg-rose-500/30', border: 'border-rose-300 dark:border-rose-500/40', dropdown: 'border-rose-500/50 text-rose-800 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-200' },
};


interface CustomerDashboardProps {
  viewMode: 'list' | 'kanban';
  customers: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (id: string | null) => void;
  onAddInteraction: (customerId: string, interaction: Omit<Interaction, 'id'>) => void;
  onUpdateCustomer: (customerId: string, updatedData: Partial<Omit<Customer, 'id'>>) => void;
  onMoveCustomer: (draggedId: string, newStatus: CustomerStatus, newIndex: number) => void;
  onOpenAddCustomerModal: () => void;
  onEditCustomer: (customer: Customer) => void;
  language: 'en' | 'zh';
  isAIAssistantOpen: boolean;
  onSetNextAction: (customerId: string, action: NextAction | undefined) => void;
  onSnooze: (customerId: string, days: number) => void;
  onCompleteAction: (customerId: string) => void;
  onDeleteCustomers: (ids: string[]) => void;
  onBulkUpdate: (ids: string[], patch: { status?: CustomerStatus; followUpDays?: number }) => void;
}

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
};

const CustomerDashboard: React.FC<CustomerDashboardProps> = (props) => {
  if (props.viewMode === 'kanban') {
    return <KanbanBoard 
      customers={props.customers} 
      onMoveCustomer={props.onMoveCustomer}
      language={props.language}
      onEditCustomer={props.onEditCustomer}
      onOpenAddCustomerModal={props.onOpenAddCustomerModal}
      selectedCustomerId={props.selectedCustomer?.id || null}
      onSelectCustomer={props.onSelectCustomer}
    />;
  }
  return <ListView {...props} />;
};

const ListView: React.FC<CustomerDashboardProps> = ({
  customers,
  selectedCustomer,
  onSelectCustomer,
  onAddInteraction,
  onUpdateCustomer,
  onOpenAddCustomerModal,
  onEditCustomer,
  language,
  isAIAssistantOpen,
  onSetNextAction,
  onSnooze,
  onCompleteAction,
  onDeleteCustomers,
  onBulkUpdate,
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const toggleSelected = (id: string) => setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    // Drop selections for customers that no longer exist.
    useEffect(() => {
        setSelectedIds(prev => new Set([...prev].filter(id => customers.some(c => c.id === id))));
    }, [customers]);
    const today = todayISO();
    const isLargeScreen = useMediaQuery('(min-width: 1024px)');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [lastContactStart, setLastContactStart] = useState('');
    const [lastContactEnd, setLastContactEnd] = useState('');
    const [dealValueMin, setDealValueMin] = useState('');
    const [dealValueMax, setDealValueMax] = useState('');

    const handleClearFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setLastContactStart('');
        setLastContactEnd('');
        setDealValueMin('');
        setDealValueMax('');
    };

    const filteredCustomers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return customers
            .filter(customer =>
                // Search across name, company, email and contacts
                !q ||
                customer.name.toLowerCase().includes(q) ||
                customer.company.toLowerCase().includes(q) ||
                customer.email.toLowerCase().includes(q) ||
                (customer.keyContacts ?? []).some(k => k.name.toLowerCase().includes(q))
            )
            .filter(customer => {
                // Status Filter
                if (statusFilter === 'all') return true;
                return customer.status === statusFilter;
            })
            .filter(customer => {
                // Last Contact Date Filter
                if (!lastContactStart && !lastContactEnd) return true;
                const customerDate = new Date(customer.lastContact);
                if (lastContactStart && customerDate < new Date(lastContactStart)) return false;
                if (lastContactEnd) {
                    const endDate = new Date(lastContactEnd);
                    endDate.setHours(23, 59, 59, 999);
                    if (customerDate > endDate) return false;
                }
                return true;
            })
            .filter(customer => {
                // Deal Value Filter
                const min = dealValueMin ? parseFloat(dealValueMin) : null;
                const max = dealValueMax ? parseFloat(dealValueMax) : null;
                if (min === null && max === null) return true;
                
                const value = customer.dealValue;
                if (value === undefined) return false;
                
                const minMatch = min === null || value >= min;
                const maxMatch = max === null || value <= max;
                return minMatch && maxMatch;
            });
    }, [customers, searchQuery, statusFilter, lastContactStart, lastContactEnd, dealValueMin, dealValueMax]);

    if (customers.length === 0) {
        return <WelcomeScreen onOpenAddCustomerModal={onOpenAddCustomerModal} language={language} />;
    }

    return (
         <div className="flex h-full overflow-hidden">
            {/* Customer List Panel (Sidebar on desktop, full view on mobile) */}
            <div className={`
                ${selectedCustomer ? 'hidden md:flex' : 'flex'}
                w-full md:w-80 lg:w-96 flex-shrink-0
                flex-col bg-surface rounded-lg border border-border
            `}>
                <div className="p-2 sticky top-0 bg-surface z-10 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-grow">
                      <input
                        id="customer-search"
                        type="search"
                        aria-label={t('searchCustomer', language)}
                        placeholder={`${t('searchCustomer', language)}  /`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-secondary border border-transparent rounded-md py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="w-5 h-5 text-text-secondary" />
                      </div>
                    </div>
                    <button 
                        onClick={() => setShowAdvancedFilters(prev => !prev)}
                        className={`p-2 rounded-md transition-colors ${showAdvancedFilters ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}
                        title={t('filters.advancedFilters', language)}
                    >
                        <FilterIcon className="w-5 h-5" />
                    </button>
                  </div>
                  {showAdvancedFilters && (
                    <div className="p-2 mt-2 space-y-3 bg-secondary/50 rounded-md">
                        <div>
                            <label className="text-xs font-medium text-text-secondary">{t('filters.status', language)}</label>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full mt-1 bg-surface border border-border rounded-md py-1 px-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition">
                                <option value="all">{t('filters.allStatuses', language)}</option>
                                {Object.values(CustomerStatus).map(s => <option key={s} value={s}>{translateStatus(s, language)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-text-secondary">{t('filters.lastContact', language)}</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input type="date" value={lastContactStart} onChange={e => setLastContactStart(e.target.value)} className="w-full bg-surface border border-border rounded-md py-1 px-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition" />
                                <span className="text-text-secondary text-sm">-</span>
                                <input type="date" value={lastContactEnd} onChange={e => setLastContactEnd(e.target.value)} min={lastContactStart} className="w-full bg-surface border border-border rounded-md py-1 px-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-text-secondary">{t('filters.dealValue', language)}</label>
                             <div className="flex items-center gap-2 mt-1">
                                <input type="number" placeholder={t('filters.min', language)} value={dealValueMin} onChange={e => setDealValueMin(e.target.value)} className="w-full bg-surface border border-border rounded-md py-1 px-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition" />
                                <span className="text-text-secondary text-sm">-</span>
                                <input type="number" placeholder={t('filters.max', language)} value={dealValueMax} onChange={e => setDealValueMax(e.target.value)} className="w-full bg-surface border border-border rounded-md py-1 px-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition" />
                            </div>
                        </div>
                        <button onClick={handleClearFilters} className="w-full text-center text-sm font-semibold text-primary hover:underline">{t('filters.clear', language)}</button>
                    </div>
                  )}
                </div>
                {selectedIds.size > 0 && (
                    <BulkBar
                        count={selectedIds.size}
                        language={language}
                        onSelectAll={() => setSelectedIds(new Set(filteredCustomers.map(c => c.id)))}
                        onClear={() => setSelectedIds(new Set())}
                        onStatus={status => onBulkUpdate([...selectedIds], { status })}
                        onFollowUp={() => onBulkUpdate([...selectedIds], { followUpDays: 3 })}
                        onDelete={() => {
                            if (window.confirm(tf('bulk.confirmDelete', language, { n: selectedIds.size }))) {
                                onDeleteCustomers([...selectedIds]);
                                setSelectedIds(new Set());
                            }
                        }}
                    />
                )}
                <ul className="p-2 space-y-1 flex-grow overflow-y-auto">
                {filteredCustomers.map(customer => {
                    const due = customer.nextAction?.dueDate;
                    const overdue = isOpen(customer) && !!due && due < today;
                    const dueToday = isOpen(customer) && due === today;
                    const since = customer.lastContact ? daysBetween(customer.lastContact, today) : null;
                    const stale = isOpen(customer) && since !== null && since >= STALE_DAYS;
                    return (
                    <li
                        key={customer.id}
                        onClick={() => onSelectCustomer(customer.id)}
                        className={`group p-3 rounded-md cursor-pointer transition-all flex gap-2 ${
                            selectedCustomer?.id === customer.id ? 'bg-primary/10' : 'hover:bg-secondary'
                        }`}
                    >
                        <input
                            type="checkbox"
                            aria-label={customer.name}
                            checked={selectedIds.has(customer.id)}
                            onClick={e => e.stopPropagation()}
                            onChange={() => toggleSelected(customer.id)}
                            className={`accent-primary w-4 h-4 mt-1 flex-shrink-0 transition-opacity ${selectedIds.size ? 'opacity-100' : 'opacity-30 group-hover:opacity-100 focus:opacity-100'}`}
                        />
                        <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-text-primary truncate">{customer.name}</h3>
                                    <p className="text-sm text-text-secondary truncate">{customer.company}</p>
                                </div>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[customer.status].bg} ${statusColors[customer.status].text}`}>
                                    {translateStatus(customer.status, language)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                                {customer.dealValue ? <span className="font-medium">${customer.dealValue.toLocaleString()}</span> : null}
                                {since !== null && <span className={stale ? 'text-sky-600 dark:text-sky-400 font-medium' : ''}>{tf('lastContactAgo', language, { n: since })}</span>}
                                {overdue && <span className="text-rose-600 dark:text-rose-400 font-semibold">● {t('todayView.overdue', language)}</span>}
                                {dueToday && <span className="text-amber-600 dark:text-amber-400 font-semibold">● {t('todayView.dueToday', language)}</span>}
                            </div>
                        </div>
                    </li>
                    );
                })}
                </ul>
            </div>

            {/* Main Content (Details + AI) */}
            <div className={`
                ${selectedCustomer ? 'flex' : 'hidden md:flex'}
                flex-grow flex-col md:pl-6 min-w-0
            `}>
                {selectedCustomer ? (
                <div className="flex gap-6 h-full min-w-0">
                    <div
                        key={`${selectedCustomer.id}-${language}`}
                        className="flex-auto space-y-6 overflow-y-auto pr-2 min-w-0"
                    >
                        {/* Back button for mobile */}
                        <button
                            onClick={() => onSelectCustomer(null)}
                            className="md:hidden flex items-center gap-2 text-sm font-semibold text-text-secondary mb-2 hover:text-text-primary"
                            aria-label={t('allCustomers', language)}
                        >
                            <ArrowLeftIcon className="w-4 h-4" />
                            <span>{t('allCustomers', language)}</span>
                        </button>

                        <CustomerDetails
                            customer={selectedCustomer}
                            onAddInteraction={onAddInteraction}
                            onUpdateCustomer={onUpdateCustomer}
                            onEditCustomer={() => onEditCustomer(selectedCustomer)}
                            onSetNextAction={onSetNextAction}
                            onSnooze={onSnooze}
                            onCompleteAction={onCompleteAction}
                            onDelete={() => {
                                if (window.confirm(tf('confirmDeleteOne', language, { name: selectedCustomer.name }))) onDeleteCustomers([selectedCustomer.id]);
                            }}
                            language={language}
                        />
                        {!isLargeScreen && (
                            <div className="h-[600px]">
                                <AIAssistant customer={selectedCustomer} language={language} onAddInteraction={onAddInteraction} onSetNextAction={onSetNextAction} />
                            </div>
                        )}
                    </div>
                    {isLargeScreen && (
                    <aside
                        className={`flex-shrink-0 transition-all duration-300 ease-in-out ${isAIAssistantOpen ? 'w-96' : 'w-0 opacity-0 pointer-events-none'}`}
                        aria-hidden={!isAIAssistantOpen}
                    >
                        <div className="h-full overflow-hidden">
                            <AIAssistant customer={selectedCustomer} language={language} onAddInteraction={onAddInteraction} onSetNextAction={onSetNextAction} />
                        </div>
                    </aside>
                    )}
                </div>
                ) : (
                <div className="hidden md:flex flex-col items-center justify-center h-full text-text-secondary bg-surface rounded-lg border border-border">
                    <p className="text-lg">{t('selectCustomerPrompt', language)}</p>
                    <p className="text-sm mt-2">{t('or', language)}</p>
                    <button onClick={onOpenAddCustomerModal} className="mt-4 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition active:scale-95">{t('addNewCustomer', language)}</button>
                </div>
                )}
            </div>
        </div>
    );
};

const WelcomeScreen: React.FC<{ onOpenAddCustomerModal: () => void, language: 'en' | 'zh' }> = ({ onOpenAddCustomerModal, language }) => {
    return (
        <div className="col-span-full h-full flex flex-col items-center justify-center text-center p-8 bg-surface rounded-lg border border-border">
            <div className="p-4 bg-primary/10 rounded-full mb-6">
                <LightBulbIcon className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary">{t('welcome.title', language)}</h2>
            <p className="mt-2 max-w-lg text-text-secondary">
                {t('welcome.message', language)}
            </p>
            <button 
                onClick={onOpenAddCustomerModal} 
                className="mt-8 px-6 py-3 bg-primary text-white text-base font-semibold rounded-lg hover:bg-primary/90 transition-transform active:scale-95"
            >
                {t('welcome.cta', language)}
            </button>
        </div>
    );
};

const CustomerDetails: React.FC<{
  customer: Customer;
  onAddInteraction: (customerId: string, interaction: Omit<Interaction, 'id'>) => void;
  onUpdateCustomer: (customerId: string, updatedData: Partial<Omit<Customer, 'id'>>) => void;
  onEditCustomer: () => void;
  onSetNextAction: (customerId: string, action: NextAction | undefined) => void;
  onSnooze: (customerId: string, days: number) => void;
  onCompleteAction: (customerId: string) => void;
  onDelete: () => void;
  language: 'en' | 'zh';
}> = ({ customer, onAddInteraction, onUpdateCustomer, onEditCustomer, onSetNextAction, onSnooze, onCompleteAction, onDelete, language }) => {
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [startDateFilter, setStartDateFilter] = useState<string>('');
    const [endDateFilter, setEndDateFilter] = useState<string>('');

    // Reset filters when the customer changes
    useEffect(() => {
        setTypeFilter('all');
        setStartDateFilter('');
        setEndDateFilter('');
    }, [customer.id]);

    const filteredInteractions = useMemo(() => {
        return customer.interactions.filter(interaction => {
            const typeMatch = typeFilter === 'all' || interaction.type === typeFilter;
            const date = new Date(interaction.date);
            const startDate = startDateFilter ? new Date(startDateFilter) : null;
            const endDate = endDateFilter ? new Date(endDateFilter) : null;

            // Adjust start date to the beginning of the day and end date to the end of the day
            if (startDate) startDate.setHours(0, 0, 0, 0);
            if (endDate) endDate.setHours(23, 59, 59, 999);

            const startDateMatch = !startDate || date >= startDate;
            const endDateMatch = !endDate || date <= endDate;

            return typeMatch && startDateMatch && endDateMatch;
        });
    }, [customer.interactions, typeFilter, startDateFilter, endDateFilter]);

    return (
    <>
        <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
            <h2 className="text-3xl font-bold text-text-primary">{customer.name}</h2>
            <p className="text-text-secondary mt-1">
                {customer.company}
                {customer.email && <> &middot; <a href={`mailto:${customer.email}`} className="hover:text-primary hover:underline">{customer.email}</a></>}
            </p>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={onDelete}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-surface border border-border text-text-secondary hover:text-rose-600 hover:bg-secondary transition-colors active:scale-95"
                title={t('deleteCustomer', language)}
                aria-label={t('deleteCustomer', language)}
            >
                <TrashIcon className="w-5 h-5" />
            </button>
            <button 
                onClick={onEditCustomer} 
                className="h-9 w-9 flex items-center justify-center rounded-full bg-surface border border-border text-text-secondary hover:bg-secondary transition-colors active:scale-95"
                title={t('editCustomer', language)}
                aria-label={t('editCustomer', language)}
            >
                <PencilIcon className="w-5 h-5" />
            </button>
            <select
                aria-label={t('filters.status', language)}
                value={customer.status}
                onChange={(e) => onUpdateCustomer(customer.id, { status: e.target.value as CustomerStatus })}
                className={`text-sm font-semibold px-3 py-1.5 rounded-md border-2 outline-none appearance-none focus:ring-2 focus:ring-primary/50 transition-all ${statusColors[customer.status].dropdown}`}
            >
                {Object.values(CustomerStatus).map(status => (
                    <option key={status} value={status} className="bg-surface text-text-primary font-medium">{translateStatus(status, language)}</option>
                ))}
            </select>
        </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <NextActionCard
                customer={customer}
                language={language}
                onComplete={() => onCompleteAction(customer.id)}
                onSnooze={days => onSnooze(customer.id, days)}
                onSet={action => onSetNextAction(customer.id, action)}
            />
            <KeyContactsCard contacts={customer.keyContacts} language={language} />
        </div>

        <CustomerProfileCard customer={customer} language={language} />
        
        <InteractionLogger customer={customer} onAddInteraction={onAddInteraction} onUpdateCustomer={onUpdateCustomer} onSetNextAction={onSetNextAction} language={language} />

        <div className="bg-surface p-4 rounded-lg border border-border">
        <h3 className="text-xl font-bold text-text-primary mb-4">{t('interactionHistory', language)}</h3>
        
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 bg-secondary/50 rounded-lg">
            <div>
                <label className="text-xs font-medium text-text-secondary">{t('filters.type', language)}</label>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="w-full mt-1 bg-surface border border-border rounded-md py-1.5 px-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition"
                >
                    <option value="all">{t('filters.all', language)}</option>
                    {Object.values(InteractionType).map(it => <option key={it} value={it}>{translateInteractionType(it, language)}</option>)}
                </select>
            </div>
            <div className="lg:col-span-2">
                <label className="text-xs font-medium text-text-secondary">{t('filters.dateRange', language)}</label>
                <div className="flex items-center gap-2 mt-1">
                     <input
                        type="date"
                        value={startDateFilter}
                        onChange={e => setStartDateFilter(e.target.value)}
                        className="w-full bg-surface border border-border rounded-md py-1.5 px-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition"
                        aria-label={t('filters.from', language)}
                    />
                     <span className="text-text-secondary">-</span>
                     <input
                        type="date"
                        value={endDateFilter}
                        onChange={e => setEndDateFilter(e.target.value)}
                        min={startDateFilter}
                        className="w-full bg-surface border border-border rounded-md py-1.5 px-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition"
                        aria-label={t('filters.to', language)}
                    />
                </div>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-text-secondary">
                    <tr>
                        <th className="font-semibold p-2">{t('table.date', language)}</th>
                        <th className="font-semibold p-2">{t('table.type', language)}</th>
                        <th className="font-semibold p-2">{t('table.summary', language)}</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredInteractions.length > 0 ? filteredInteractions.map(interaction => (
                    <tr key={interaction.id} className="border-b border-border last:border-b-0 hover:bg-secondary">
                        <td className="p-2 whitespace-nowrap text-text-secondary">{interaction.date}</td>
                        <td className="p-2">
                            <span className="font-semibold text-primary whitespace-nowrap">{translateInteractionType(interaction.type, language)}</span>
                        </td>
                        <td className="p-2 text-text-primary whitespace-pre-wrap">{interaction.summary}</td>
                    </tr>
                    )) : (
                    <tr>
                        <td colSpan={3} className="p-4 text-center text-text-secondary">
                            {t('noInteractions', language)}
                        </td>
                    </tr>
                    )}
                </tbody>
            </table>
        </div>
        </div>
    </>
    );
};

const NextActionCard: React.FC<{
    customer: Customer;
    language: 'en' | 'zh';
    onComplete: () => void;
    onSnooze: (days: number) => void;
    onSet: (action: NextAction | undefined) => void;
}> = ({ customer, language, onComplete, onSnooze, onSet }) => {
    const [editing, setEditing] = useState(false);
    const [desc, setDesc] = useState('');
    const [due, setDue] = useState('');
    const today = todayISO();
    const action = customer.nextAction;

    const startEdit = () => {
        setDesc(action?.description ?? '');
        setDue(action?.dueDate || addDays(today, 1));
        setEditing(true);
    };

    const dueTone = !action?.dueDate ? 'text-text-secondary'
        : action.dueDate < today ? 'text-rose-600 dark:text-rose-400'
        : action.dueDate === today ? 'text-amber-600 dark:text-amber-400'
        : 'text-text-secondary';
    const dueLabel = !action?.dueDate ? '' 
        : action.dueDate < today ? tf('nextActionCard.overdueBy', language, { n: daysBetween(action.dueDate, today) })
        : action.dueDate === today ? t('nextActionCard.dueTodayLabel', language)
        : `${t('dueDate', language)}: ${action.dueDate}`;

    const smallBtn = 'text-xs px-2 py-1 rounded-md font-semibold transition active:scale-95';

    return (
    <div className="bg-surface p-4 rounded-lg border border-border">
        <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-text-primary">{t('nextAction', language)}</h4>
            {!editing && (
                <button onClick={startEdit} className="p-1 rounded text-text-secondary hover:bg-secondary" aria-label={t('nextActionCard.edit', language)} title={t('nextActionCard.edit', language)}>
                    <PencilIcon className="w-4 h-4" />
                </button>
            )}
        </div>
        {editing ? (
            <form
                className="space-y-2"
                onSubmit={e => {
                    e.preventDefault();
                    onSet(desc.trim() ? { description: desc.trim(), dueDate: due } : undefined);
                    setEditing(false);
                }}
            >
                <textarea autoFocus value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="w-full bg-secondary rounded-md p-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
                <div className="flex gap-2 items-center">
                    <input type="date" value={due} onChange={e => setDue(e.target.value)} className="bg-secondary rounded-md p-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
                    <button type="submit" className={`${smallBtn} bg-primary text-white hover:bg-primary/90`}>{t('closeReason.save', language)}</button>
                    <button type="button" onClick={() => setEditing(false)} className={`${smallBtn} bg-secondary hover:bg-border`}>{t('modal.cancel', language)}</button>
                </div>
            </form>
        ) : action ? (
            <div>
                <p className="text-text-primary">{action.description}</p>
                {dueLabel && (
                    <div className={`flex items-center gap-2 mt-2 text-sm font-medium ${dueTone}`}>
                        <CalendarIcon className="w-4 h-4" />
                        <span>{dueLabel}</span>
                    </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={onComplete} className={`${smallBtn} bg-primary text-white hover:bg-primary/90 flex items-center gap-1`}><CheckIcon className="w-3.5 h-3.5" />{t('nextActionCard.complete', language)}</button>
                    <button onClick={() => onSnooze(1)} className={`${smallBtn} bg-secondary hover:bg-border`}>{t('nextActionCard.snooze', language)}</button>
                    <button onClick={() => onSnooze(7)} className={`${smallBtn} bg-secondary hover:bg-border`}>{t('nextActionCard.snoozeWeek', language)}</button>
                </div>
            </div>
        ) : (
            <div>
                <p className="text-text-secondary text-sm">{t('noNextAction', language)}</p>
                <button onClick={startEdit} className={`${smallBtn} mt-2 bg-primary text-white hover:bg-primary/90`}>{t('todayView.setAction', language)}</button>
            </div>
        )}
    </div>
    );
};

const KeyContactsCard: React.FC<{ contacts?: KeyContact[], language: 'en' | 'zh' }> = ({ contacts, language }) => (
    <div className="bg-surface p-4 rounded-lg border border-border">
        <div className="flex items-center gap-2 mb-2">
             <IdentificationIcon className="w-5 h-5 text-text-secondary" />
             <h4 className="font-semibold text-text-primary">{t('keyContacts', language)}</h4>
        </div>
        {contacts && contacts.length > 0 ? (
            <ul className="space-y-1">
                {contacts.map(contact => (
                    <li key={contact.id} className="text-sm">
                        <span className="font-medium text-text-primary">{contact.name}</span>
                        <span className="text-text-secondary"> - {contact.title}</span>
                    </li>
                ))}
            </ul>
        ) : (
            <p className="text-text-secondary text-sm">{t('noContacts', language)}</p>
        )}
    </div>
);

const CustomerProfileCard: React.FC<{customer: Customer, language: 'en' | 'zh'}> = ({ customer, language }) => (
    <div className="bg-surface p-4 rounded-lg border border-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
                <h5 className="text-sm font-semibold text-text-secondary mb-1">{t('dealValue', language)}</h5>
                <p className="text-lg font-bold text-primary">{customer.dealValue ? `$${customer.dealValue.toLocaleString()}` : 'N/A'}</p>
            </div>
             <div>
                <h5 className="text-sm font-semibold text-text-secondary mb-1">{t('knownCompetitors', language)}</h5>
                <p className="text-sm text-text-primary">{customer.competitors?.join(', ') || t('notAvailable', language)}</p>
            </div>
            <div className="md:col-span-2">
                <h5 className="text-sm font-semibold text-text-secondary mb-1">{t('customerPainPoints', language)}</h5>
                {customer.customerPainPoints && customer.customerPainPoints.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                       {customer.customerPainPoints.map((point, index) => (
                           <li key={index} className="text-sm text-text-primary">{point}</li>
                       ))}
                    </ul>
                ) : (
                    <p className="text-sm text-text-primary">{t('notAvailable', language)}</p>
                )}
            </div>
        </div>
    </div>
);

// Minimal typing for the Web Speech API (not in the standard TS DOM lib).
type SpeechRecognitionLike = {
    lang: string; continuous: boolean; interimResults: boolean;
    onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: (() => void) | null;
    start: () => void; stop: () => void;
};
const getSpeechRecognition = (): (new () => SpeechRecognitionLike) | null =>
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

const InteractionLogger: React.FC<{ 
    customer: Customer; 
    onAddInteraction: (customerId: string, interaction: Omit<Interaction, 'id'>) => void;
    onUpdateCustomer: (customerId: string, updatedData: Partial<Omit<Customer, 'id'>>) => void;
    onSetNextAction: (customerId: string, action: NextAction | undefined) => void;
    language: 'en' | 'zh'; 
}> = ({ customer, onAddInteraction, onUpdateCustomer, onSetNextAction, language }) => {
  const [summary, setSummary] = useState('');
  const [type, setType] = useState<InteractionType>(InteractionType.NOTE);
  const [organizing, setOrganizing] = useState(false);
  const [aiResult, setAiResult] = useState<OrganizedNotes | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  type QuickLogKey = 'followUp' | 'voicemail' | 'meetingScheduled';

  // Reset the draft when switching customers.
  useEffect(() => {
    setSummary('');
    setType(InteractionType.NOTE);
    setAiResult(null);
    setAiError(null);
    recognitionRef.current?.stop();
  }, [customer.id]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const log = (text: string, interactionType: InteractionType) => {
    onAddInteraction(customer.id, { type: interactionType, summary: text, date: todayISO() });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!summary.trim()) return;
    log(summary.trim(), type);
    setSummary('');
    setType(InteractionType.NOTE);
    setAiResult(null);
  };

  const handleQuickLog = (templateKey: QuickLogKey, interactionType: InteractionType) => {
      log(t(`quickLog.${templateKey}`, language), interactionType);
  };

  const organize = async () => {
    setOrganizing(true);
    setAiError(null);
    try {
      setAiResult(await organizeMeetingNotes(customer, summary, language));
    } catch (err) {
      setAiError(aiErrorMessage(err, language));
    } finally {
      setOrganizing(false);
    }
  };

  const applyAll = () => {
    if (!aiResult) return;
    log(aiResult.summary, aiResult.type);
    if (aiResult.nextActionDescription) {
      onSetNextAction(customer.id, { description: aiResult.nextActionDescription, dueDate: aiResult.nextActionDueDate || addDays(todayISO(), 3) });
    }
    const pains = (aiResult.newPainPoints ?? []).filter(p => !(customer.customerPainPoints ?? []).includes(p));
    const comps = (aiResult.newCompetitors ?? []).filter(c => !(customer.competitors ?? []).includes(c));
    if (pains.length || comps.length) {
      onUpdateCustomer(customer.id, {
        customerPainPoints: [...(customer.customerPainPoints ?? []), ...pains],
        competitors: [...(customer.competitors ?? []), ...comps],
      });
    }
    setSummary('');
    setAiResult(null);
  };

  const toggleDictation = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setAiError(t('logger.dictationUnsupported', language));
      return;
    }
    const rec = new Recognition();
    rec.lang = language === 'zh' ? 'zh-TW' : 'en-US';
    rec.continuous = true;
    rec.interimResults = false;
    const base = summary ? `${summary.trimEnd()} ` : '';
    let transcript = '';
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript;
      }
      setSummary(base + transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const chip = 'text-xs px-2 py-1 bg-secondary rounded-md hover:bg-border transition active:scale-95';

  return (
    <form onSubmit={handleSubmit} className="bg-surface p-4 rounded-lg border border-border">
      <h3 className="text-lg font-bold text-text-primary mb-2">{t('logNewInteraction', language)}</h3>
      <textarea
        id="interaction-log-input"
        value={summary}
        onChange={e => setSummary(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
        placeholder={t('logInteractionPlaceholder', language)}
        aria-label={t('logNewInteraction', language)}
        className="w-full bg-secondary rounded-md p-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition"
        rows={3}
      />
      <div className="flex items-center gap-2 mt-2 flex-wrap">
          <button type="button" onClick={() => handleQuickLog('followUp', InteractionType.EMAIL)} className={chip}>{t('quickLog.followUp', language)}</button>
          <button type="button" onClick={() => handleQuickLog('voicemail', InteractionType.CALL)} className={chip}>{t('quickLog.voicemail', language)}</button>
          <button type="button" onClick={() => handleQuickLog('meetingScheduled', InteractionType.MEETING)} className={chip}>{t('quickLog.meetingScheduled', language)}</button>
      </div>

      {aiError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-2">{aiError}</p>}

      {aiResult && (
        <div className="mt-3 p-3 rounded-md border border-primary/40 bg-primary/5 space-y-2 text-sm">
          <p className="font-semibold flex items-center gap-1 text-primary"><SparklesIcon className="w-4 h-4" />{t('logger.aiResult', language)}</p>
          <p><span className="font-semibold">{translateInteractionType(aiResult.type, language)}</span> · {aiResult.summary}</p>
          {aiResult.nextActionDescription && (
            <p className="flex items-center gap-1"><CalendarIcon className="w-4 h-4 text-text-secondary" />{aiResult.nextActionDescription} {aiResult.nextActionDueDate && <span className="text-text-secondary">({aiResult.nextActionDueDate})</span>}</p>
          )}
          {!!aiResult.newPainPoints?.length && <p><span className="text-text-secondary">{t('customerPainPoints', language)}:</span> {aiResult.newPainPoints.join('、')}</p>}
          {!!aiResult.newCompetitors?.length && <p><span className="text-text-secondary">{t('knownCompetitors', language)}:</span> {aiResult.newCompetitors.join('、')}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={applyAll} className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-md hover:bg-primary/90 active:scale-95">{t('logger.saveAll', language)}</button>
            <button type="button" onClick={() => { setSummary(aiResult.summary); setType(aiResult.type); setAiResult(null); }} className="px-3 py-1.5 bg-secondary text-xs font-semibold rounded-md hover:bg-border">{t('logger.applySummary', language)}</button>
            <button type="button" onClick={() => setAiResult(null)} className="px-3 py-1.5 text-xs font-semibold rounded-md hover:bg-secondary">{t('modal.cancel', language)}</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={e => setType(e.target.value as InteractionType)}
            aria-label={t('table.type', language)}
            className="bg-secondary rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition"
          >
            {Object.values(InteractionType).map(it => (
              <option key={it} value={it}>{translateInteractionType(it, language)}</option>
            ))}
          </select>
          <button type="button" onClick={toggleDictation} className={`px-3 py-2 text-sm rounded-md flex items-center gap-1 transition ${listening ? 'bg-rose-500 text-white animate-pulse' : 'bg-secondary hover:bg-border'}`} title={t('logger.dictate', language)}>
            <MicrophoneIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{t(listening ? 'logger.stopDictate' : 'logger.dictate', language)}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={organize} disabled={!summary.trim() || organizing} className="px-3 py-2 text-sm font-semibold rounded-md border border-primary text-primary hover:bg-primary/10 transition disabled:opacity-50 flex items-center gap-1">
            <SparklesIcon className="w-4 h-4" />
            {t(organizing ? 'logger.organizing' : 'logger.organize', language)}
          </button>
          <button type="submit" className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2 active:scale-95" disabled={!summary.trim()}>
            {t('logInteraction', language)}
          </button>
        </div>
      </div>
    </form>
  );
};

const BulkBar: React.FC<{
    count: number;
    language: 'en' | 'zh';
    onSelectAll: () => void;
    onClear: () => void;
    onStatus: (status: CustomerStatus) => void;
    onFollowUp: () => void;
    onDelete: () => void;
}> = ({ count, language, onSelectAll, onClear, onStatus, onFollowUp, onDelete }) => (
    <div className="p-2 border-b border-border bg-primary/5 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-primary">{tf('bulk.selected', language, { n: count })}</span>
        <select
            value=""
            onChange={e => { if (e.target.value) onStatus(e.target.value as CustomerStatus); }}
            className="bg-surface border border-border rounded-md px-1.5 py-1"
            aria-label={t('bulk.setStatus', language)}
        >
            <option value="">{t('bulk.setStatus', language)}</option>
            {Object.values(CustomerStatus).map(s => <option key={s} value={s}>{translateStatus(s, language)}</option>)}
        </select>
        <button onClick={onFollowUp} className="px-2 py-1 rounded-md bg-surface border border-border hover:bg-secondary">{t('bulk.followUp', language)}</button>
        <button onClick={onSelectAll} className="px-2 py-1 rounded-md hover:bg-secondary">{t('bulk.selectAll', language)}</button>
        <button onClick={onClear} className="px-2 py-1 rounded-md hover:bg-secondary">{t('bulk.clear', language)}</button>
        <button onClick={onDelete} className="px-2 py-1 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 ml-auto">{t('bulk.delete', language)}</button>
    </div>
);

export default CustomerDashboard;