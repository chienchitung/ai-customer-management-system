import React, { useState } from 'react';
import { Customer, CustomerStatus, Interaction, InteractionType, Sentiment, KeyContact } from '../types';
import { analyzeSentiment } from '../services/geminiService';
import { t, translateStatus } from '../localization';
import AIAssistant from './AIAssistant';
import KanbanBoard from './KanbanBoard';
import { HappyIcon, NeutralIcon, SadIcon, CalendarIcon } from './icons';

// Mapping customer statuses to specific Tailwind CSS classes for color-coding.
export const statusColors: { [key in CustomerStatus]: { text: string; bg: string; border: string; dropdown: string } } = {
  [CustomerStatus.LEAD]: { text: 'text-cyan-800 dark:text-cyan-300', bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-200 dark:border-cyan-500/30', dropdown: 'border-cyan-500/50 text-cyan-800 bg-cyan-50 dark:bg-cyan-500/10 dark:text-cyan-300' },
  [CustomerStatus.PROSPECT]: { text: 'text-blue-800 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', dropdown: 'border-blue-500/50 text-blue-800 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-300' },
  [CustomerStatus.NEGOTIATION]: { text: 'text-yellow-800 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/30', dropdown: 'border-yellow-500/50 text-yellow-800 bg-yellow-50 dark:bg-yellow-500/10 dark:text-yellow-300' },
  [CustomerStatus.CLOSED_WON]: { text: 'text-green-800 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30', dropdown: 'border-green-500/50 text-green-800 bg-green-50 dark:bg-green-500/10 dark:text-green-300' },
  [CustomerStatus.CLOSED_LOST]: { text: 'text-red-800 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', dropdown: 'border-red-500/50 text-red-800 bg-red-50 dark:bg-red-500/10 dark:text-red-300' },
};

interface CustomerDashboardProps {
  viewMode: 'list' | 'kanban';
  customers: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (id: string) => void;
  onAddInteraction: (customerId: string, interaction: Omit<Interaction, 'id'>) => void;
  onUpdateCustomer: (customerId: string, updatedData: Partial<Omit<Customer, 'id'>>) => void;
  onOpenAddCustomerModal: () => void;
  language: 'en' | 'zh';
}

const CustomerDashboard: React.FC<CustomerDashboardProps> = (props) => {
  if (props.viewMode === 'kanban') {
    return <KanbanBoard customers={props.customers} onUpdateCustomer={props.onUpdateCustomer} language={props.language} />;
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
  language
}) => {
    return (
         <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 h-[calc(100vh-104px)]">
            <div className="md:col-span-1 lg:col-span-1 bg-surface rounded-lg border border-border overflow-y-auto">
                <ul className="p-2 space-y-1">
                {customers.map(customer => (
                    <li
                        key={customer.id}
                        onClick={() => onSelectCustomer(customer.id)}
                        className={`p-3 rounded-md cursor-pointer transition-all ${
                            selectedCustomer?.id === customer.id ? 'bg-primary/10' : 'hover:bg-secondary'
                        }`}
                    >
                        <h3 className="font-semibold text-text-primary">{customer.name}</h3>
                        <p className="text-sm text-text-secondary">{customer.company}</p>
                    </li>
                ))}
                </ul>
            </div>

            <div className="md:col-span-3 lg:col-span-4 overflow-y-auto">
                {selectedCustomer ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                    <CustomerDetails
                        customer={selectedCustomer}
                        onAddInteraction={onAddInteraction}
                        onUpdateCustomer={onUpdateCustomer}
                        language={language}
                    />
                    </div>
                    <div className="xl:col-span-1">
                    <AIAssistant customer={selectedCustomer} language={language} />
                    </div>
                </div>
                ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-secondary bg-surface rounded-lg border border-border">
                    <p className="text-lg">{t('selectCustomerPrompt', language)}</p>
                    <p className="text-sm mt-2">{t('or', language)}</p>
                    <button onClick={onOpenAddCustomerModal} className="mt-4 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition">{t('addNewCustomer', language)}</button>
                </div>
                )}
            </div>
        </div>
    );
};

const SentimentIcon: React.FC<{ sentiment?: Sentiment }> = ({ sentiment }) => {
    if (!sentiment) return null;
    switch (sentiment) {
        case Sentiment.POSITIVE: return <HappyIcon title="Positive Sentiment" />;
        case Sentiment.NEUTRAL: return <NeutralIcon title="Neutral Sentiment" />;
        case Sentiment.NEGATIVE: return <SadIcon title="Negative Sentiment" />;
        default: return null;
    }
};

const CustomerDetails: React.FC<{
  customer: Customer;
  onAddInteraction: CustomerDashboardProps['onAddInteraction'];
  onUpdateCustomer: CustomerDashboardProps['onUpdateCustomer'];
  language: 'en' | 'zh';
}> = ({ customer, onAddInteraction, onUpdateCustomer, language }) => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
      <div>
        <h2 className="text-3xl font-bold text-text-primary">{customer.name}</h2>
        <p className="text-text-secondary mt-1">{customer.company} &middot; {customer.email}</p>
      </div>
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
    
    <InteractionLogger customerId={customer.id} onAddInteraction={onAddInteraction} language={language} />

    <div>
      <h3 className="text-xl font-bold text-text-primary mb-4">{t('interactionHistory', language)}</h3>
      <ul className="space-y-4">
        {customer.interactions.length > 0 ? customer.interactions.map(interaction => (
          <li key={interaction.id} className="p-4 bg-surface rounded-lg border border-border">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                    <p className="font-semibold text-primary">{interaction.type}</p>
                    <SentimentIcon sentiment={interaction.sentiment} />
                </div>
                <p className="mt-2 text-sm text-text-primary">{interaction.summary}</p>
              </div>
              <p className="text-xs text-text-secondary flex-shrink-0 ml-4">{interaction.date}</p>
            </div>
          </li>
        )) : (
            <li className="p-4 bg-surface rounded-lg border border-border text-center text-text-secondary text-sm">
                {t('noInteractions', language)}
            </li>
        )}
      </ul>
    </div>
  </div>
);

const InteractionLogger: React.FC<{ 
    customerId: string; 
    onAddInteraction: CustomerDashboardProps['onAddInteraction'];
    language: 'en' | 'zh'; 
}> = ({ customerId, onAddInteraction, language }) => {
  const [summary, setSummary] = useState('');
  const [type, setType] = useState<InteractionType>(InteractionType.NOTE);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || isAnalyzing) return;
    
    setIsAnalyzing(true);
    const sentiment = await analyzeSentiment(summary);
    
    onAddInteraction(customerId, {
      type,
      summary,
      date: new Date().toISOString().split('T')[0],
      sentiment,
    });
    setSummary('');
    setIsAnalyzing(false);
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
        disabled={isAnalyzing}
      />
      <div className="flex justify-between items-center mt-3">
        <select
          value={type}
          onChange={e => setType(e.target.value as InteractionType)}
          className="bg-secondary rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition appearance-none"
          disabled={isAnalyzing}
        >
          {Object.values(InteractionType).map(it => (
            <option key={it} value={it}>{it}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2" disabled={!summary.trim() || isAnalyzing}>
          {isAnalyzing && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
          {isAnalyzing ? t('analyzing', language) : t('logInteraction', language)}
        </button>
      </div>
    </form>
  );
};

export default CustomerDashboard;