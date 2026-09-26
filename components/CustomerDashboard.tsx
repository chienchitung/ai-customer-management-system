import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Customer, CustomerStatus, Interaction, InteractionType, KeyContact, NextAction } from '../types';
import { t, tf, translateStatus, translateInteractionType } from '../localization';
import AIAssistant from './AIAssistant';
import KanbanBoard from './KanbanBoard';
import { aiErrorMessage } from './Dialogs';
import { useConfirm } from './ConfirmDialog';
import { GmailPanel } from './Gmail';
import { useGmail } from '../hooks/useGmail';
import { Avatar, STATUS_DOT, Tabs } from './ui';
import { formatDate, friendlyDate } from '../lib/format';
import { organizeMeetingNotes, OrganizedNotes } from '../services/geminiService';
import { daysBetween, todayISO, addDays } from '../lib/dates';
import { isOpen, STALE_DAYS } from '../lib/insights';
import { PlusIcon, ArrowLeftIcon, CalendarIcon, IdentificationIcon, LightBulbIcon, PencilIcon, SearchIcon, FilterIcon, SparklesIcon, MicrophoneIcon, TrashIcon, CheckIcon } from './icons';

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
  // Kanban isn't practical on phones (and its toggle is hidden there), so phones always get the list.
  const isPhone = useMediaQuery('(max-width: 639px)');
  if (props.viewMode === 'kanban' && !isPhone) {
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
    const confirm = useConfirm();
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


    return (
         <div className="flex h-full overflow-hidden">
            {/* Customer List Panel (Sidebar on desktop, full view on mobile) */}
            <div className={`
                ${selectedCustomer ? 'hidden md:flex' : 'flex'}
                w-full md:w-72 xl:w-80 flex-shrink-0
                flex-col md:border-r border-border
            `}>
                <div className="p-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-grow">
                      <input
                        id="customer-search"
                        type="search"
                        aria-label={t('searchCustomer', language)}
                        placeholder={`${t('searchCustomer', language)}  /`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-8"
                      />
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <SearchIcon className="w-4 h-4 text-text-secondary" />
                      </div>
                    </div>
                    <button 
                        onClick={() => setShowAdvancedFilters(prev => !prev)}
                        className={`btn btn-icon ${showAdvancedFilters ? 'btn-secondary text-primary' : 'btn-ghost'}`}
                        title={t('filters.advancedFilters', language)}
                        aria-label={t('filters.advancedFilters', language)}
                        aria-expanded={showAdvancedFilters}
                    >
                        <FilterIcon className="w-4 h-4" />
                    </button>
                  </div>
                  {showAdvancedFilters && (
                    <div className="p-3 mt-3 space-y-3 rounded-md border border-border bg-secondary/40">
                        <div>
                            <label className="text-xs font-medium text-text-secondary">{t('filters.status', language)}</label>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input mt-1">
                                <option value="all">{t('filters.allStatuses', language)}</option>
                                {Object.values(CustomerStatus).map(s => <option key={s} value={s}>{translateStatus(s, language)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-text-secondary">{t('filters.lastContact', language)}</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input type="date" value={lastContactStart} onChange={e => setLastContactStart(e.target.value)} className="input" />
                                <span className="text-text-secondary text-sm">-</span>
                                <input type="date" value={lastContactEnd} onChange={e => setLastContactEnd(e.target.value)} min={lastContactStart} className="input" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-text-secondary">{t('filters.dealValue', language)}</label>
                             <div className="flex items-center gap-2 mt-1">
                                <input type="number" placeholder={t('filters.min', language)} value={dealValueMin} onChange={e => setDealValueMin(e.target.value)} className="input" />
                                <span className="text-text-secondary text-sm">-</span>
                                <input type="number" placeholder={t('filters.max', language)} value={dealValueMax} onChange={e => setDealValueMax(e.target.value)} className="input" />
                            </div>
                        </div>
                        <button onClick={handleClearFilters} className="btn btn-ghost btn-sm w-full">{t('filters.clear', language)}</button>
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
                        onDelete={async () => {
                            if (await confirm(tf('bulk.confirmDelete', language, { n: selectedIds.size }), { danger: true, confirmLabel: t('bulk.delete', language) })) {
                                onDeleteCustomers([...selectedIds]);
                                setSelectedIds(new Set());
                            }
                        }}
                    />
                )}
                <ul className="p-2 space-y-px flex-grow overflow-y-auto">
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
                        aria-current={selectedCustomer?.id === customer.id ? 'true' : undefined}
                        className={`group px-2 py-2 rounded-md cursor-pointer transition-colors flex items-center gap-2.5 ${
                            selectedCustomer?.id === customer.id ? 'bg-secondary' : 'hover:bg-secondary/60'
                        }`}
                    >
                        <span className="relative flex-shrink-0 w-8 h-8">
                            <span className={`absolute inset-0 transition-opacity ${selectedIds.size ? 'opacity-0' : 'group-hover:opacity-0'}`}><Avatar name={customer.name} /></span>
                            <input
                                type="checkbox"
                                aria-label={customer.name}
                                checked={selectedIds.has(customer.id)}
                                onClick={e => e.stopPropagation()}
                                onChange={() => toggleSelected(customer.id)}
                                className={`absolute inset-0 m-auto accent-primary w-4 h-4 transition-opacity ${selectedIds.size ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                            />
                        </span>
                        <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-center gap-2">
                                <h3 className="text-sm font-medium text-text-primary truncate">{customer.name}</h3>
                                {customer.dealValue ? <span className="text-xs text-text-secondary tabular-nums">${Math.round(customer.dealValue / 1000)}k</span> : null}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[customer.status]}`} title={translateStatus(customer.status, language)} />
                                <span className="truncate">{customer.company}</span>
                                <span className="ml-auto flex-shrink-0 whitespace-nowrap">
                                    {overdue ? <span className="text-rose-600 dark:text-rose-400 font-medium">{t('todayView.overdue', language)}</span>
                                    : dueToday ? <span className="text-amber-700 dark:text-amber-400 font-medium">{t('todayView.dueToday', language)}</span>
                                    : since !== null ? <span className={stale ? 'text-sky-700 dark:text-sky-400 font-medium' : ''}>{tf('lastContactAgo', language, { n: since })}</span> : null}
                                </span>
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
                flex-grow flex-col min-w-0
            `}>
                {selectedCustomer ? (
                <div className="flex h-full min-w-0">
                    <div
                        key={`${selectedCustomer.id}-${language}`}
                        className="flex-auto overflow-y-auto min-w-0"
                    >
                      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5">
                        {/* Back button for mobile */}
                        <button
                            onClick={() => onSelectCustomer(null)}
                            className="md:hidden btn btn-ghost btn-sm -ml-2"
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
                            onDelete={async () => {
                                if (await confirm(tf('confirmDeleteOne', language, { name: selectedCustomer.name }), { danger: true, confirmLabel: t('bulk.delete', language) })) onDeleteCustomers([selectedCustomer.id]);
                            }}
                            language={language}
                        />
                        {!isLargeScreen && (
                            <div className="h-[600px] card overflow-hidden">
                                <AIAssistant customer={selectedCustomer} language={language} onAddInteraction={onAddInteraction} onSetNextAction={onSetNextAction} />
                            </div>
                        )}
                      </div>
                    </div>
                    {isLargeScreen && (
                    <aside
                        className={`flex-shrink-0 border-l border-border transition-all duration-200 ease-out ${isAIAssistantOpen ? 'w-80 2xl:w-96' : 'w-0 opacity-0 pointer-events-none border-l-0'}`}
                        aria-hidden={!isAIAssistantOpen}
                    >
                        <div className="h-full overflow-hidden">
                            <AIAssistant customer={selectedCustomer} language={language} onAddInteraction={onAddInteraction} onSetNextAction={onSetNextAction} />
                        </div>
                    </aside>
                    )}
                </div>
                ) : (
                <div className="hidden md:flex flex-col items-center justify-center h-full text-text-secondary">
                    <p className="text-sm">{t('selectCustomerPrompt', language)}</p>
                    <button onClick={onOpenAddCustomerModal} className="btn btn-secondary mt-4"><PlusIcon className="w-4 h-4" />{t('addNewCustomer', language)}</button>
                </div>
                )}
            </div>
        </div>
    );
};

export const WelcomeScreen: React.FC<{
    onOpenAddCustomerModal: () => void;
    onOpenCapture: () => void;
    onLoadDemo: () => void;
    language: 'en' | 'zh';
}> = ({ onOpenAddCustomerModal, onOpenCapture, onLoadDemo, language }) => (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="p-3 bg-primary/10 rounded-xl mb-5">
            <LightBulbIcon className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">{t('welcome.title', language)}</h2>
        <p className="mt-2 max-w-md text-sm text-text-secondary">{t('welcome.message', language)}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button onClick={onOpenAddCustomerModal} className="btn btn-primary h-9 px-4">
                {t('welcome.cta', language)}
            </button>
            <button onClick={onOpenCapture} className="btn btn-secondary h-9 px-4">
                <SparklesIcon className="w-4 h-4" />{t('capture.button', language)}
            </button>
            <button onClick={onLoadDemo} className="btn btn-ghost h-9 px-4">
                {t('emptyCloud.demo', language)}
            </button>
        </div>
    </div>
);

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

    const gmail = useGmail();
    const [tab, setTab] = useState<'overview' | 'activity' | 'gmail'>('overview');
    useEffect(() => setTab('overview'), [customer.id]);

    const tabs = [
        { key: 'overview' as const, label: t('shell.overview', language) },
        { key: 'activity' as const, label: t('shell.activity', language), count: customer.interactions.length },
        ...(gmail.status.available ? [{ key: 'gmail' as const, label: 'Gmail' }] : []),
    ];

    return (
    <>
        <div className="flex flex-wrap items-start gap-4">
            <Avatar name={customer.name} size="lg" />
            <div className="flex-grow min-w-0">
                <h2 className="text-xl font-semibold tracking-tight">{customer.name}</h2>
                <p className="text-sm text-text-secondary mt-0.5 truncate">
                    {customer.company}
                    {customer.email && <> &middot; <a href={`mailto:${customer.email}`} className="hover:text-primary hover:underline">{customer.email}</a></>}
                    {customer.dealValue ? <> &middot; <span className="text-text-primary font-medium">${customer.dealValue.toLocaleString()}</span></> : null}
                </p>
            </div>
            <div className="flex items-center gap-1">
                <label className="relative">
                    <span className="sr-only">{t('filters.status', language)}</span>
                    <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none ${STATUS_DOT[customer.status]}`} aria-hidden="true" />
                    <select
                        aria-label={t('filters.status', language)}
                        value={customer.status}
                        onChange={(e) => onUpdateCustomer(customer.id, { status: e.target.value as CustomerStatus })}
                        className="btn btn-secondary pl-6 pr-2 appearance-none cursor-pointer"
                    >
                        {Object.values(CustomerStatus).map(status => (
                            <option key={status} value={status}>{translateStatus(status, language)}</option>
                        ))}
                    </select>
                </label>
                <button onClick={onEditCustomer} className="btn btn-ghost btn-icon" title={t('editCustomer', language)} aria-label={t('editCustomer', language)}>
                    <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={onDelete} className="btn btn-ghost btn-icon hover:text-rose-600" title={t('deleteCustomer', language)} aria-label={t('deleteCustomer', language)}>
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>

        <InteractionLogger customer={customer} onAddInteraction={onAddInteraction} onUpdateCustomer={onUpdateCustomer} onSetNextAction={onSetNextAction} language={language} />

        <Tabs tabs={tabs} active={tab} onChange={setTab} label={customer.name} />

        {tab === 'overview' && (
            <div className="space-y-4">
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
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
                <div className="card">
                    <div className="flex items-center justify-between px-4 pt-3">
                        <h3 className="card-title">{t('shell.recent', language)}</h3>
                        {customer.interactions.length > 3 && (
                            <button onClick={() => setTab('activity')} className="btn btn-ghost btn-sm">{t('shell.viewAll', language)} →</button>
                        )}
                    </div>
                    <InteractionTable interactions={customer.interactions.slice(0, 3)} language={language} />
                </div>
            </div>
        )}

        {tab === 'activity' && (
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        aria-label={t('filters.type', language)}
                        className="input w-auto"
                    >
                        <option value="all">{t('filters.all', language)}</option>
                        {Object.values(InteractionType).map(it => <option key={it} value={it}>{translateInteractionType(it, language)}</option>)}
                    </select>
                    <input type="date" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="input w-auto" aria-label={t('filters.from', language)} />
                    <span className="text-text-secondary text-sm">–</span>
                    <input type="date" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} min={startDateFilter} className="input w-auto" aria-label={t('filters.to', language)} />
                </div>
                <div className="card">
                    <InteractionTable interactions={filteredInteractions} language={language} />
                </div>
            </div>
        )}

        {tab === 'gmail' && (
            <GmailPanel customer={customer} language={language} onAddInteraction={onAddInteraction} onSetNextAction={(id, a) => onSetNextAction(id, a)} />
        )}
    </>
    );
};

const InteractionTable: React.FC<{ interactions: Interaction[]; language: 'en' | 'zh' }> = ({ interactions, language }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
            <thead className="text-xs text-text-secondary">
                <tr className="border-b border-border">
                    <th className="font-medium px-4 py-2 w-32">{t('table.date', language)}</th>
                    <th className="font-medium px-4 py-2 w-24">{t('table.type', language)}</th>
                    <th className="font-medium px-4 py-2">{t('table.summary', language)}</th>
                </tr>
            </thead>
            <tbody>
                {interactions.length > 0 ? interactions.map(interaction => (
                <tr key={interaction.id} className="border-b border-border last:border-b-0 align-top">
                    <td className="px-4 py-2.5 whitespace-nowrap text-text-secondary tabular-nums">{formatDate(interaction.date, language)}{interaction.source === 'gmail' && <span className="ml-1 text-rose-500" title="Gmail">✉</span>}</td>
                    <td className="px-4 py-2.5"><span className="chip">{translateInteractionType(interaction.type, language)}</span></td>
                    <td className="px-4 py-2.5 text-text-primary whitespace-pre-wrap">{interaction.summary}</td>
                </tr>
                )) : (
                <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-text-secondary">{t('noInteractions', language)}</td>
                </tr>
                )}
            </tbody>
        </table>
    </div>
);

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
        : action.dueDate === today ? 'text-amber-700 dark:text-amber-400'
        : 'text-text-secondary';
    const dueLabel = !action?.dueDate ? '' 
        : action.dueDate < today ? tf('nextActionCard.overdueBy', language, { n: daysBetween(action.dueDate, today) })
        : action.dueDate === today ? t('nextActionCard.dueTodayLabel', language)
        : friendlyDate(action.dueDate, language);

    const smallBtn = 'btn btn-sm';

    return (
    <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
            <h4 className="card-title">{t('nextAction', language)}</h4>
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
                <textarea autoFocus value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="input" />
                <div className="flex gap-2 items-center">
                    <input type="date" value={due} onChange={e => setDue(e.target.value)} className="input w-auto" />
                    <button type="submit" className={`${smallBtn} btn-primary`}>{t('closeReason.save', language)}</button>
                    <button type="button" onClick={() => setEditing(false)} className={`${smallBtn} btn-secondary`}>{t('modal.cancel', language)}</button>
                </div>
            </form>
        ) : action ? (
            <div>
                <p className="text-sm text-text-primary">{action.description}</p>
                {dueLabel && (
                    <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${dueTone}`}>
                        <CalendarIcon className="w-4 h-4" />
                        <span>{dueLabel}</span>
                    </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={onComplete} className={`${smallBtn} btn-primary flex items-center gap-1`}><CheckIcon className="w-3.5 h-3.5" />{t('nextActionCard.complete', language)}</button>
                    <button onClick={() => onSnooze(1)} className={`${smallBtn} btn-secondary`}>{t('nextActionCard.snooze', language)}</button>
                    <button onClick={() => onSnooze(7)} className={`${smallBtn} btn-secondary`}>{t('nextActionCard.snoozeWeek', language)}</button>
                </div>
            </div>
        ) : (
            <div>
                <p className="text-text-secondary text-sm">{t('noNextAction', language)}</p>
                <button onClick={startEdit} className={`${smallBtn} mt-2 btn-primary`}>{t('todayView.setAction', language)}</button>
            </div>
        )}
    </div>
    );
};

const KeyContactsCard: React.FC<{ contacts?: KeyContact[], language: 'en' | 'zh' }> = ({ contacts, language }) => (
    <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
             <IdentificationIcon className="w-4 h-4 text-text-secondary" />
             <h4 className="card-title">{t('keyContacts', language)}</h4>
        </div>
        {contacts && contacts.length > 0 ? (
            <ul className="space-y-2">
                {contacts.map(contact => (
                    <li key={contact.id} className="text-sm flex items-center gap-2">
                        <Avatar name={contact.name} size="sm" />
                        <span className="font-medium text-text-primary">{contact.name}</span>
                        <span className="text-text-secondary text-xs">{contact.title}</span>
                    </li>
                ))}
            </ul>
        ) : (
            <p className="text-text-secondary text-sm">{t('noContacts', language)}</p>
        )}
    </div>
);

const CustomerProfileCard: React.FC<{customer: Customer, language: 'en' | 'zh'}> = ({ customer, language }) => (
    <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
                <h5 className="text-xs font-medium text-text-secondary mb-1">{t('dealValue', language)}</h5>
                <p className="text-base font-semibold tabular-nums">{customer.dealValue ? `$${customer.dealValue.toLocaleString()}` : 'N/A'}</p>
            </div>
             <div>
                <h5 className="text-xs font-medium text-text-secondary mb-1">{t('knownCompetitors', language)}</h5>
                <p className="text-sm text-text-primary">{customer.competitors?.join(', ') || t('notAvailable', language)}</p>
            </div>
            <div className="md:col-span-2">
                <h5 className="text-xs font-medium text-text-secondary mb-1">{t('customerPainPoints', language)}</h5>
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

  return (
    <form onSubmit={handleSubmit} className="card overflow-hidden focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 transition" aria-label={t('logNewInteraction', language)}>
      <textarea
        id="interaction-log-input"
        value={summary}
        onChange={e => setSummary(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
        placeholder={`${t('logNewInteraction', language)} — ${t('logInteractionPlaceholder', language)}`}
        aria-label={t('logNewInteraction', language)}
        className="block w-full bg-transparent px-4 pt-3 pb-1 text-sm outline-none focus-visible:outline-none resize-none placeholder:text-text-secondary/70"
        rows={2}
      />
      <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
          <button type="button" onClick={() => handleQuickLog('followUp', InteractionType.EMAIL)} className="btn btn-sm btn-ghost border border-dashed border-border">{t('quickLog.followUp', language)}</button>
          <button type="button" onClick={() => handleQuickLog('voicemail', InteractionType.CALL)} className="btn btn-sm btn-ghost border border-dashed border-border">{t('quickLog.voicemail', language)}</button>
          <button type="button" onClick={() => handleQuickLog('meetingScheduled', InteractionType.MEETING)} className="btn btn-sm btn-ghost border border-dashed border-border">{t('quickLog.meetingScheduled', language)}</button>
      </div>

      {aiError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 px-4 pb-2">{aiError}</p>}

      {aiResult && (
        <div className="mx-3 mb-3 p-3 rounded-md border border-primary/30 bg-primary/5 space-y-1.5 text-sm">
          <p className="text-xs font-medium flex items-center gap-1 text-primary"><SparklesIcon className="w-3.5 h-3.5" />{t('logger.aiResult', language)}</p>
          <p><span className="chip mr-1.5">{translateInteractionType(aiResult.type, language)}</span>{aiResult.summary}</p>
          {aiResult.nextActionDescription && (
            <p className="flex items-center gap-1.5"><CalendarIcon className="w-4 h-4 text-text-secondary" />{aiResult.nextActionDescription} {aiResult.nextActionDueDate && <span className="text-text-secondary">({aiResult.nextActionDueDate})</span>}</p>
          )}
          {!!aiResult.newPainPoints?.length && <p><span className="text-text-secondary">{t('customerPainPoints', language)}:</span> {aiResult.newPainPoints.join('、')}</p>}
          {!!aiResult.newCompetitors?.length && <p><span className="text-text-secondary">{t('knownCompetitors', language)}:</span> {aiResult.newCompetitors.join('、')}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={applyAll} className="btn btn-sm btn-primary">{t('logger.saveAll', language)}</button>
            <button type="button" onClick={() => { setSummary(aiResult.summary); setType(aiResult.type); setAiResult(null); }} className="btn btn-sm btn-secondary">{t('logger.applySummary', language)}</button>
            <button type="button" onClick={() => setAiResult(null)} className="btn btn-sm btn-ghost">{t('modal.cancel', language)}</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center gap-2 flex-wrap px-3 py-2 border-t border-border bg-secondary/40">
        <div className="flex items-center gap-1">
          <select
            value={type}
            onChange={e => setType(e.target.value as InteractionType)}
            aria-label={t('table.type', language)}
            className="btn btn-sm btn-ghost bg-transparent pr-1 cursor-pointer"
          >
            {Object.values(InteractionType).map(it => (
              <option key={it} value={it}>{translateInteractionType(it, language)}</option>
            ))}
          </select>
          <button type="button" onClick={toggleDictation} className={`btn btn-sm ${listening ? 'bg-rose-500 text-white animate-pulse' : 'btn-ghost'}`} title={t('logger.dictate', language)}>
            <MicrophoneIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{t(listening ? 'logger.stopDictate' : 'logger.dictate', language)}</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={organize} disabled={!summary.trim() || organizing} className="btn btn-sm btn-ghost text-primary">
            <SparklesIcon className="w-4 h-4" />
            {t(organizing ? 'logger.organizing' : 'logger.organize', language)}
          </button>
          <button type="submit" className="btn btn-sm btn-primary" disabled={!summary.trim()}>
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
    <div className="px-3 py-2 border-b border-border bg-primary/5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-primary">{tf('bulk.selected', language, { n: count })}</span>
        <select
            value=""
            onChange={e => { if (e.target.value) onStatus(e.target.value as CustomerStatus); }}
            className="btn btn-sm btn-secondary cursor-pointer"
            aria-label={t('bulk.setStatus', language)}
        >
            <option value="">{t('bulk.setStatus', language)}</option>
            {Object.values(CustomerStatus).map(s => <option key={s} value={s}>{translateStatus(s, language)}</option>)}
        </select>
        <button onClick={onFollowUp} className="btn btn-sm btn-secondary">{t('bulk.followUp', language)}</button>
        <button onClick={onSelectAll} className="btn btn-sm btn-ghost">{t('bulk.selectAll', language)}</button>
        <button onClick={onClear} className="btn btn-sm btn-ghost">{t('bulk.clear', language)}</button>
        <button onClick={onDelete} className="btn btn-sm btn-ghost text-rose-600 dark:text-rose-400 ml-auto">{t('bulk.delete', language)}</button>
    </div>
);

export default CustomerDashboard;