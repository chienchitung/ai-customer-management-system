import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Interaction, CustomerStatus, KeyContact, InteractionType, Sentiment } from './types';
import CustomerDashboard from './components/CustomerDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AddCustomerModal from './components/AddCustomerModal';
import { ViewListIcon, ViewGridIcon, PlusIcon, SunIcon, MoonIcon } from './components/icons';
import { t } from './localization';

// Function to generate a unique ID.
const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Initial mock data for customers to demonstrate the application's features.
const initialCustomers: Customer[] = [
  {
    id: '1',
    name: 'Eleanor Vance',
    company: 'Innovate Corp',
    email: 'eleanor.v@innovate.com',
    status: CustomerStatus.PROSPECT,
    lastContact: '2024-07-20',
    dealValue: 75000,
    customerPainPoints: ['Manual data entry is time-consuming', 'Lack of integration with existing tools'],
    competitors: ['OldGuard Solutions'],
    keyContacts: [
        { id: generateId(), name: 'David Chen', title: 'CTO' }
    ],
    nextAction: { description: 'Send over technical whitepaper for AI integration.', dueDate: '2024-08-05' },
    interactions: [
      { id: 'int1_1', type: InteractionType.EMAIL, date: '2024-07-20', summary: 'Sent follow-up email about the proposal.', sentiment: Sentiment.NEUTRAL },
      { id: 'int1_2', type: InteractionType.CALL, date: '2024-07-15', summary: 'Initial discovery call. Client showed strong interest in AI integration features and is excited about the potential.', sentiment: Sentiment.POSITIVE },
    ],
  },
  {
    id: '2',
    name: 'Marcus Holloway',
    company: 'Cyber Solutions',
    email: 'marcus.h@cybersolutions.net',
    status: CustomerStatus.NEGOTIATION,
    lastContact: '2024-07-22',
    dealValue: 120000,
    customerPainPoints: ['Security compliance concerns', 'High cost of current provider'],
    keyContacts: [
        { id: generateId(), name: 'Sarah Jenkins', title: 'Head of Security' },
        { id: generateId(), name: 'Tom Riley', title: 'IT Director' }
    ],
    competitors: ['Legacy Systems Inc.', 'SecureNet'],
    interactions: [
      { id: 'int2_1', type: InteractionType.MEETING, date: '2024-07-22', summary: 'Demo of the premium tier. They raised some concerns about the implementation timeline but were impressed with the features.', sentiment: Sentiment.NEUTRAL },
      { id: 'int2_2', type: InteractionType.EMAIL, date: '2024-07-18', summary: 'Confirmed meeting and sent agenda.', sentiment: Sentiment.NEUTRAL },
    ],
  },
  {
    id: '3',
    name: 'Chloe Decker',
    company: 'Logistics Prime',
    email: 'chloe.d@logiprime.com',
    status: CustomerStatus.LEAD,
    lastContact: '2024-07-25',
    dealValue: 45000,
    interactions: [
        { id: 'int3_1', type: InteractionType.NOTE, date: '2024-07-25', summary: 'New lead from marketing webinar. Downloaded our e-book on supply chain optimization.', sentiment: Sentiment.POSITIVE },
    ],
  },
  {
    id: '4',
    name: 'Aidan Gallagher',
    company: 'Quantum Dynamics',
    status: CustomerStatus.CLOSED_WON,
    email: 'aidan.g@quantum.dev',
    lastContact: '2024-06-30',
    dealValue: 95000,
    closedReason: 'Superior feature set compared to competitors.',
    interactions: [
      { id: 'int4_1', type: InteractionType.EMAIL, date: '2024-06-30', summary: 'Contract signed. Onboarding scheduled.', sentiment: Sentiment.POSITIVE },
    ],
  },
   {
    id: '5',
    name: 'Javier Castillo',
    company: 'HealthBridge',
    email: 'javier.c@healthbridge.io',
    status: CustomerStatus.LEAD,
    lastContact: '2024-07-28',
    dealValue: 60000,
    interactions: [],
  },
   {
    id: '6',
    name: 'Isabelle Rossi',
    company: 'Fintech United',
    email: 'isabelle.r@finu.com',
    status: CustomerStatus.PROSPECT,
    lastContact: '2024-07-19',
    dealValue: 85000,
    interactions: [
      { id: 'int6_1', type: InteractionType.CALL, date: '2024-07-19', summary: 'Good conversation, they are evaluating options and we are on the shortlist.', sentiment: Sentiment.POSITIVE },
    ],
  },
  {
    id: '7',
    name: 'Kenji Tanaka',
    company: 'AutoDrive Inc.',
    status: CustomerStatus.CLOSED_LOST,
    email: 'kenji.t@autodrive.com',
    lastContact: '2024-07-10',
    dealValue: 110000,
    closedReason: 'Decided to stay with their current provider due to budget constraints.',
    interactions: [
      { id: 'int7_1', type: InteractionType.EMAIL, date: '2024-07-10', summary: 'Received email informing us they will not be moving forward at this time.', sentiment: Sentiment.NEGATIVE },
    ],
  },
];

type ViewMode = 'list' | 'kanban';
type MainView = 'management' | 'dashboard';
type Language = 'en' | 'zh';
type Theme = 'light' | 'dark';

/**
 * Main application component.
 * Manages the entire application state including customers, selected customer, and current view.
 */
const App: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>('1');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [mainView, setMainView] = useState<MainView>('management');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customers]);
  
  const handleAddCustomer = (customerData: Omit<Customer, 'id' | 'interactions' | 'lastContact' | 'status'>) => {
    const newCustomer: Customer = {
      ...customerData,
      id: generateId(),
      interactions: [],
      status: CustomerStatus.LEAD,
      lastContact: new Date().toISOString().split('T')[0],
    };
    setCustomers(prev => [newCustomer, ...prev]);
    setSelectedCustomerId(newCustomer.id); // Select the new customer
  };

  const handleAddInteraction = (customerId: string, interactionData: Omit<Interaction, 'id'>) => {
    setCustomers(prevCustomers =>
      prevCustomers.map(customer => {
        if (customer.id === customerId) {
          const newInteraction: Interaction = { ...interactionData, id: generateId() };
          return {
            ...customer,
            interactions: [newInteraction, ...customer.interactions],
            lastContact: newInteraction.date,
          };
        }
        return customer;
      })
    );
  };
  
  const handleUpdateCustomer = (customerId: string, updatedData: Partial<Omit<Customer, 'id'>>) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, ...updatedData } : c));
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="bg-surface/80 backdrop-blur-md border-b border-border p-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-text-primary">AI CAMS</h1>
            <button
              onClick={() => setMainView('management')}
              className={`text-sm font-semibold transition-colors ${mainView === 'management' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {t('management', language)}
            </button>
            <button
              onClick={() => setMainView('dashboard')}
              className={`text-sm font-semibold transition-colors ${mainView === 'dashboard' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {t('dashboard', language)}
            </button>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={() => setLanguage(lang => (lang === 'en' ? 'zh' : 'en'))}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-secondary text-text-secondary hover:text-text-primary transition-colors text-sm font-semibold"
                title={t('buttons.toggleLanguage', language)}
            >
                {language.toUpperCase()}
            </button>
            <button
                onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-secondary text-text-secondary hover:text-text-primary transition-colors"
                title={t('buttons.toggleTheme', language)}
            >
                {theme === 'light' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>

            {mainView === 'management' && (
              <>
                <div className="bg-secondary p-1 rounded-lg flex items-center text-text-secondary">
                    <button 
                        onClick={() => setViewMode('list')} 
                        className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-primary text-white' : 'hover:text-text-primary'}`} 
                        title={t('buttons.listView', language)}
                    >
                        <ViewListIcon className="w-5 h-5"/>
                    </button>
                    <button 
                        onClick={() => setViewMode('kanban')} 
                        className={`p-1.5 rounded-md ${viewMode === 'kanban' ? 'bg-primary text-white' : 'hover:text-text-primary'}`} 
                        title={t('buttons.kanbanView', language)}
                    >
                        <ViewGridIcon className="w-5 h-5"/>
                    </button>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="p-2 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
                    aria-label={t('addNewCustomer', language)}
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
              </>
            )}
        </div>
      </header>
      
      <main className="p-4 md:p-6">
        {mainView === 'management' ? (
            <CustomerDashboard
                viewMode={viewMode}
                customers={customers}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomerId}
                onAddInteraction={handleAddInteraction}
                onUpdateCustomer={handleUpdateCustomer}
                onOpenAddCustomerModal={() => setIsModalOpen(true)}
                language={language}
            />
        ) : (
            <AnalyticsDashboard customers={customers} language={language} />
        )}
      </main>

      <AddCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddCustomer={handleAddCustomer}
        language={language}
      />
    </div>
  );
};

export default App;