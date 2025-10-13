import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Interaction, CustomerStatus, KeyContact, InteractionType } from './types';
import CustomerDashboard from './components/CustomerDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AddCustomerModal from './components/AddCustomerModal';
import { ViewListIcon, ViewGridIcon, PlusIcon, SunIcon, MoonIcon, ChatbotIcon } from './components/icons';
import { t } from './localization';

// Function to generate a unique ID.
export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      { id: 'int1_1', type: InteractionType.EMAIL, date: '2024-07-20', summary: 'Sent follow-up email about the proposal.' },
      { id: 'int1_2', type: InteractionType.CALL, date: '2024-07-15', summary: 'Initial discovery call. Client showed strong interest in AI integration features and is excited about the potential.' },
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
      { id: 'int2_1', type: InteractionType.MEETING, date: '2024-07-22', summary: 'Demo of the premium tier. They raised some concerns about the implementation timeline but were impressed with the features.' },
      { id: 'int2_2', type: InteractionType.EMAIL, date: '2024-07-18', summary: 'Confirmed meeting and sent agenda.' },
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
        { id: 'int3_1', type: InteractionType.NOTE, date: '2024-07-25', summary: 'New lead from marketing webinar. Downloaded our e-book on supply chain optimization.' },
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
      { id: 'int4_1', type: InteractionType.EMAIL, date: '2024-06-30', summary: 'Contract signed. Onboarding scheduled.' },
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
      { id: 'int6_1', type: InteractionType.CALL, date: '2024-07-19', summary: 'Good conversation, they are evaluating options and we are on the shortlist.' },
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
      { id: 'int7_1', type: InteractionType.EMAIL, date: '2024-07-10', summary: 'Received email informing us they will not be moving forward at this time.' },
    ],
  },
];

type ViewMode = 'list' | 'kanban';
type MainView = 'management' | 'dashboard';
type Language = 'en' | 'zh';
type Theme = 'light' | 'dark';

// Helper function to find the last index of an element in an array.
function findLastIndex<T>(array: T[], predicate: (value: T, index: number, obj: T[]) => boolean): number {
    for (let i = array.length - 1; i >= 0; i--) {
        if (predicate(array[i], i, array)) {
            return i;
        }
    }
    return -1;
}

/**
 * Main application component.
 * Manages the entire application state including customers, selected customer, and current view.
 */
const App: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>('1');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [mainView, setMainView] = useState<MainView>('management');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [animationKey, setAnimationKey] = useState(0);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(true);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [mainView]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customers]);
  
  const handleOpenAddModal = () => {
    setCustomerToEdit(null);
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsCustomerModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCustomerModalOpen(false);
    setCustomerToEdit(null);
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
  
  const handleSaveCustomer = (data: Partial<Customer>, customerId?: string) => {
    if (customerId) {
        // Update existing customer
        handleUpdateCustomer(customerId, data);
    } else {
        // Add new customer
        const newCustomer: Customer = {
            id: generateId(),
            interactions: [],
            status: CustomerStatus.LEAD,
            lastContact: new Date().toISOString().split('T')[0],
            name: data.name!,
            company: data.company!,
            email: data.email!,
            ...data,
        };
        setCustomers(prev => [newCustomer, ...prev]);
        setSelectedCustomerId(newCustomer.id);
    }
    handleCloseModal();
  };

  const handleMoveCustomer = (draggedId: string, newStatus: CustomerStatus, newIndexInColumn: number) => {
    setCustomers(currentCustomers => {
        const draggedCustomer = currentCustomers.find(c => c.id === draggedId);
        if (!draggedCustomer) return currentCustomers;

        const filteredCustomers = currentCustomers.filter(c => c.id !== draggedId);
        const targetColumn = filteredCustomers.filter(c => c.status === newStatus);
        
        const customerBeforeDrop = targetColumn[newIndexInColumn];
        const overId = customerBeforeDrop ? customerBeforeDrop.id : null;
        
        let insertionIndex;
        if (overId) {
            insertionIndex = filteredCustomers.findIndex(c => c.id === overId);
        } else {
            const lastInColumn = targetColumn.length > 0 ? targetColumn[targetColumn.length - 1] : null;
            if (lastInColumn) {
                insertionIndex = filteredCustomers.findIndex(c => c.id === lastInColumn.id) + 1;
            } else {
                const columnOrder = Object.values(CustomerStatus);
                const targetColumnOrderIndex = columnOrder.indexOf(newStatus);
                
                for (let i = targetColumnOrderIndex - 1; i >= 0; i--) {
                    const status = columnOrder[i];
                    const lastIndex = findLastIndex(filteredCustomers, c => c.status === status);
                    if (lastIndex !== -1) {
                        insertionIndex = lastIndex + 1;
                        break;
                    }
                }

                if (insertionIndex === undefined) {
                    for (let i = targetColumnOrderIndex + 1; i < columnOrder.length; i++) {
                        const status = columnOrder[i];
                        const firstIndex = filteredCustomers.findIndex(c => c.status === status);
                        if (firstIndex !== -1) {
                            insertionIndex = firstIndex;
                            break;
                        }
                    }
                }
                
                if (insertionIndex === undefined) {
                    insertionIndex = filteredCustomers.length;
                }
            }
        }

        const newCustomers = [...filteredCustomers];
        newCustomers.splice(insertionIndex, 0, { ...draggedCustomer, status: newStatus });
        
        return newCustomers;
    });
  };


  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <header className="bg-surface/80 backdrop-blur-md border-b border-border p-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-text-primary whitespace-nowrap">AI Customer Management System</h1>
            <nav className="flex items-center gap-4">
                <button
                onClick={() => setMainView('management')}
                className={`border-b-2 pb-1 text-sm font-semibold transition-all duration-200 focus:outline-none ${
                    mainView === 'management'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
                }`}
                >
                {t('management', language)}
                </button>
                <button
                onClick={() => setMainView('dashboard')}
                className={`border-b-2 pb-1 text-sm font-semibold transition-all duration-200 focus:outline-none ${
                    mainView === 'dashboard'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
                }`}
                >
                {t('dashboard', language)}
                </button>
            </nav>
        </div>
        <div className="flex items-center gap-3">
            <button
                onClick={() => setLanguage(lang => (lang === 'en' ? 'zh' : 'en'))}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-surface border border-border text-text-secondary hover:bg-secondary transition-colors text-sm font-semibold active:scale-95"
                title={t('buttons.toggleLanguage', language)}
            >
                {language === 'en' ? t('langName', 'zh') : t('langName', 'en')}
            </button>
            <button
                onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-surface border border-border text-text-secondary hover:bg-secondary transition-colors active:scale-95"
                title={t('buttons.toggleTheme', language)}
            >
                {theme === 'light' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>

            {mainView === 'management' && (
              <>
                <button
                    onClick={() => setIsAIAssistantOpen(prev => !prev)}
                    className={`px-3 h-9 flex items-center justify-center gap-2 rounded-lg border transition-colors active:scale-95 ${
                        isAIAssistantOpen 
                        ? 'bg-primary border-primary text-white' 
                        : 'bg-surface border-border text-text-secondary hover:bg-secondary'
                    }`}
                    title={t('buttons.toggleAI', language)}
                >
                    <ChatbotIcon className="w-5 h-5" />
                    <span className="text-sm font-semibold">{t('aiAssistant', language)}</span>
                </button>
                <div className="bg-surface border border-border p-1 rounded-lg flex items-center text-text-secondary">
                    <button 
                        onClick={() => setViewMode('list')} 
                        className={`p-1.5 rounded-md transition-transform active:scale-95 ${viewMode === 'list' ? 'bg-primary text-white' : 'hover:text-text-primary'}`} 
                        title={t('buttons.listView', language)}
                    >
                        <ViewListIcon className="w-5 h-5"/>
                    </button>
                    <button 
                        onClick={() => setViewMode('kanban')} 
                        className={`p-1.5 rounded-md transition-transform active:scale-95 ${viewMode === 'kanban' ? 'bg-primary text-white' : 'hover:text-text-primary'}`} 
                        title={t('buttons.kanbanView', language)}
                    >
                        <ViewGridIcon className="w-5 h-5"/>
                    </button>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="h-9 w-9 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-all active:scale-95"
                    aria-label={t('addNewCustomer', language)}
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
              </>
            )}
        </div>
      </header>
      
      <main className="p-4 md:p-6 flex-grow">
        <div key={animationKey} className="animate-fade-in h-full">
            {mainView === 'management' ? (
                <CustomerDashboard
                    viewMode={viewMode}
                    customers={customers}
                    selectedCustomer={selectedCustomer}
                    onSelectCustomer={setSelectedCustomerId}
                    onAddInteraction={handleAddInteraction}
                    onUpdateCustomer={handleUpdateCustomer}
                    onOpenAddCustomerModal={handleOpenAddModal}
                    onEditCustomer={handleOpenEditModal}
                    language={language}
                    isAIAssistantOpen={isAIAssistantOpen}
                    onMoveCustomer={handleMoveCustomer}
                />
            ) : (
                <AnalyticsDashboard customers={customers} language={language} />
            )}
        </div>
      </main>

      <AddCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveCustomer}
        customerToEdit={customerToEdit}
        language={language}
      />
    </div>
  );
};

export default App;