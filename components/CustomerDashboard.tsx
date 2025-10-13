import React, { useState, useMemo, useEffect } from 'react';
import { Customer, CustomerStatus, Interaction, InteractionType, KeyContact } from '../types';
import { t, translateStatus } from '../localization';
import AIAssistant from './AIAssistant';
import KanbanBoard from './KanbanBoard';
import { ArrowLeftIcon, CalendarIcon, IdentificationIcon, LightBulbIcon, PencilIcon, SearchIcon, FilterIcon } from './icons';

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
}

const CustomerDashboard: React.FC<CustomerDashboardProps> = (props) => {
  if (props.viewMode === 'kanban') {
    return <KanbanBoard 
      customers={props.customers} 
      onMoveCustomer={props.onMoveCustomer}
      language={props.language} 
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
  isAIAssistantOpen
}) => {
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
        return customers
            .filter(customer =>
                // Search Query Filter
                customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                customer.company.toLowerCase().includes(searchQuery.toLowerCase())
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
                        type="text"
                        placeholder={t('searchCustomer', language)}
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
                <ul className="p-2 space-y-1 flex-grow overflow-y-auto">
                {filteredCustomers.map(customer => (
                    <li
                        key={customer.id}
                        onClick={() => onSelectCustomer(customer.id)}
                        className={`p-3 rounded-md cursor-pointer transition-all ${
                            selectedCustomer?.id === customer.id ? 'bg-primary/10' : 'hover:bg-secondary'
                        }`}
                    >
                        <div className="flex justify-between items-start gap-2">
                            <div>
                                <h3 className="font-semibold text-text-primary">{customer.name}</h3>
                                <p className="text-sm text-text-secondary">{customer.company}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[customer.status].bg} ${statusColors[customer.status].text}`}>
                                {translateStatus(customer.status, language)}
                            </span>
                        </div>
                    </li>
                ))}
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
                            language={language}
                        />
                    </div>
                    <aside
                        className={`flex-shrink-0 transition-all duration-300 ease-in-out ${isAIAssistantOpen ? 'w-96' : 'w-0 opacity-0 pointer-events-none'}`}
                        aria-hidden={!isAIAssistantOpen}
                    >
                        <div className="h-full overflow-hidden">
                            <AIAssistant customer={selectedCustomer} language={language} />
                        </div>
                    </aside>
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
  language: 'en' | 'zh';
}> = ({ customer, onAddInteraction, onUpdateCustomer, onEditCustomer, language }) => {
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
            <p className="text-text-secondary mt-1">{customer.company} &middot; {customer.email}</p>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={onEditCustomer} 
                className="h-9 w-9 flex items-center justify-center rounded-full bg-surface border border-border text-text-secondary hover:bg-secondary transition-colors active:scale-95"
                title={t('editCustomer', language)}
            >
                <PencilIcon className="w-5 h-5" />
            </button>
            <select
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
            <NextActionCard customer={customer} language={language} />
            <KeyContactsCard contacts={customer.keyContacts} language={language} />
        </div>

        <CustomerProfileCard customer={customer} language={language} />
        
        <InteractionLogger customerId={customer.id} onAddInteraction={onAddInteraction} language={language} />

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
                    {Object.values(InteractionType).map(it => <option key={it} value={it}>{it}</option>)}
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
                            <span className="font-semibold text-primary">{interaction.type}</span>
                        </td>
                        <td className="p-2 text-text-primary">{interaction.summary}</td>
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

const NextActionCard: React.FC<{customer: Customer, language: 'en' | 'zh'}> = ({ customer, language }) => (
    <div className="bg-surface p-4 rounded-lg border border-border">
        <h4 className="font-semibold text-text-primary mb-2">{t('nextAction', language)}</h4>
        {customer.nextAction ? (
            <div>
                <p className="text-text-primary">{customer.nextAction.description}</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{t('dueDate', language)}: {customer.nextAction.dueDate}</span>
                </div>
            </div>
        ) : (
            <p className="text-text-secondary text-sm">{t('noNextAction', language)}</p>
        )}
    </div>
);

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

const InteractionLogger: React.FC<{ 
    customerId: string; 
    onAddInteraction: (customerId: string, interaction: Omit<Interaction, 'id'>) => void;
    language: 'en' | 'zh'; 
}> = ({ customerId, onAddInteraction, language }) => {
  const [summary, setSummary] = React.useState('');
  const [type, setType] = React.useState<InteractionType>(InteractionType.NOTE);
  // FIX: Added a specific type for quick log keys to ensure type safety with the `t` function.
  type QuickLogKey = 'followUp' | 'voicemail' | 'meetingScheduled';

  const handleSubmit = (e?: React.FormEvent, quickLogSummary?: string, quickLogType?: InteractionType) => {
    if (e) e.preventDefault();
    const currentSummary = quickLogSummary || summary;
    if (!currentSummary.trim()) return;
    
    onAddInteraction(customerId, {
      type: quickLogType || type,
      summary: currentSummary,
      date: new Date().toISOString().split('T')[0],
    });
    setSummary('');
    if (!quickLogSummary) {
        setType(InteractionType.NOTE);
    }
  };

  const handleQuickLog = (templateKey: QuickLogKey, interactionType: InteractionType) => {
      const logText = t(`quickLog.${templateKey}`, language);
      handleSubmit(undefined, logText, interactionType);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface p-4 rounded-lg border border-border">
      <h3 className="text-lg font-bold text-text-primary mb-2">{t('logNewInteraction', language)}</h3>
      <textarea
        value={summary}
        onChange={e => setSummary(e.target.value)}
        placeholder={t('logInteractionPlaceholder', language)}
        className="w-full bg-secondary rounded-md p-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition"
        rows={3}
      />
      <div className="flex items-center gap-2 mt-2 flex-wrap">
          <button type="button" onClick={() => handleQuickLog('followUp', InteractionType.EMAIL)} className="text-xs px-2 py-1 bg-secondary rounded-md hover:bg-border dark:hover:bg-slate-600 transition active:scale-95">{t('quickLog.followUp', language)}</button>
          <button type="button" onClick={() => handleQuickLog('voicemail', InteractionType.CALL)} className="text-xs px-2 py-1 bg-secondary rounded-md hover:bg-border dark:hover:bg-slate-600 transition active:scale-95">{t('quickLog.voicemail', language)}</button>
          <button type="button" onClick={() => handleQuickLog('meetingScheduled', InteractionType.MEETING)} className="text-xs px-2 py-1 bg-secondary rounded-md hover:bg-border dark:hover:bg-slate-600 transition active:scale-95">{t('quickLog.meetingScheduled', language)}</button>
      </div>
      <div className="flex justify-between items-center mt-3">
        <select
          value={type}
          onChange={e => setType(e.target.value as InteractionType)}
          className="bg-secondary rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition appearance-none"
        >
          {Object.values(InteractionType).map(it => (
            <option key={it} value={it}>{it}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2 active:scale-95" disabled={!summary.trim()}>
          {t('logInteraction', language)}
        </button>
      </div>
    </form>
  );
};

export default CustomerDashboard;