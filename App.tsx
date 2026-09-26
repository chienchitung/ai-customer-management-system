import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Customer, Interaction, CustomerStatus, InteractionType, NextAction } from './types';
import CustomerDashboard from './components/CustomerDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AddCustomerModal from './components/AddCustomerModal';
import TodayView from './components/TodayView';
import { CloseReasonModal, CompleteActionModal, SmartCaptureModal, ShortcutsModal } from './components/Dialogs';
import { useToast } from './components/Toast';
import { ViewListIcon, ViewGridIcon, PlusIcon, SunIcon, MoonIcon, ChatbotIcon, SparklesIcon, DatabaseIcon } from './components/icons';
import { t, tf } from './localization';
import { generateId } from './lib/ids';
import { addDays, todayISO } from './lib/dates';
import { withStatus } from './lib/insights';
import { createDemoCustomers } from './data/demo';
import { Prefs, loadPrefs, savePrefs, loadCustomers, saveCustomers, exportJSON, exportCSV, downloadFile, parseCustomers } from './lib/storage';

export { generateId };

type MainView = Prefs['mainView'];

const isClosed = (s: CustomerStatus) => s === CustomerStatus.CLOSED_WON || s === CustomerStatus.CLOSED_LOST;

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Main application component.
 * Owns customer data (persisted locally), user preferences and all dialogs.
 */
const App: React.FC = () => {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>(() => loadCustomers(createDemoCustomers()));
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const { language, theme, viewMode, mainView, isAIAssistantOpen } = prefs;
  const updatePrefs = (patch: Partial<Prefs>) => setPrefs(p => ({ ...p, ...patch }));

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [prefill, setPrefill] = useState<Partial<Customer> | null>(null);
  const pendingInteraction = useRef<string | undefined>();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [closePrompt, setClosePrompt] = useState<{ id: string; status: CustomerStatus } | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Persist data and preferences.
  const warnedSaveFailure = useRef(false);
  useEffect(() => {
    if (!saveCustomers(customers) && !warnedSaveFailure.current) {
      warnedSaveFailure.current = true;
      toast(t('data.saveFailed', language), { tone: 'error' });
    }
  }, [customers]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => savePrefs(prefs), [prefs]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.lang = language === 'zh' ? 'zh-Hant' : 'en';
  }, [theme, language]);

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId) || null,
    [selectedCustomerId, customers],
  );

  // Select the first customer on desktop when entering management with nothing selected.
  useEffect(() => {
    if (mainView === 'management' && !selectedCustomerId && customers.length && window.innerWidth >= 768) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [mainView]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Customer mutations ----------

  const updateCustomer = useCallback((id: string, fn: (c: Customer) => Customer) => {
    setCustomers(prev => prev.map(c => (c.id === id ? fn(c) : c)));
  }, []);

  const handleAddInteraction = useCallback((customerId: string, data: Omit<Interaction, 'id'>) => {
    updateCustomer(customerId, c => ({
      ...c,
      interactions: [{ ...data, id: generateId() }, ...c.interactions],
      lastContact: !c.lastContact || data.date > c.lastContact ? data.date : c.lastContact,
    }));
  }, [updateCustomer]);

  const handleUpdateCustomer = useCallback((customerId: string, data: Partial<Omit<Customer, 'id'>>) => {
    if (data.status) {
      const { status, ...rest } = data;
      updateCustomer(customerId, c => ({ ...withStatus(c, status, todayISO()), ...rest }));
      if (isClosed(status)) setClosePrompt({ id: customerId, status });
    } else {
      updateCustomer(customerId, c => ({ ...c, ...data }));
    }
  }, [updateCustomer]);

  const handleSetNextAction = useCallback((customerId: string, nextAction: NextAction | undefined) => {
    updateCustomer(customerId, c => ({ ...c, nextAction }));
  }, [updateCustomer]);

  const handleSnooze = useCallback((customerId: string, days: number) => {
    updateCustomer(customerId, c => c.nextAction
      ? { ...c, nextAction: { ...c.nextAction, dueDate: addDays(c.nextAction.dueDate && c.nextAction.dueDate > todayISO() ? c.nextAction.dueDate : todayISO(), days) } }
      : c);
  }, [updateCustomer]);

  const handleComplete = (customerId: string, log: { type: InteractionType; summary: string } | null, next: NextAction | null) => {
    if (log) handleAddInteraction(customerId, { ...log, date: todayISO() });
    handleSetNextAction(customerId, next ?? undefined);
    setCompleteId(null);
  };

  const handleDeleteCustomers = useCallback((ids: string[]) => {
    const snapshot = customers;
    setCustomers(prev => prev.filter(c => !ids.includes(c.id)));
    if (selectedCustomerId && ids.includes(selectedCustomerId)) setSelectedCustomerId(null);
    toast(t('deleted', language), { actionLabel: t('undo', language), onAction: () => setCustomers(snapshot) });
  }, [customers, selectedCustomerId, language, toast]);

  const handleBulkUpdate = useCallback((ids: string[], patch: { status?: CustomerStatus; followUpDays?: number }) => {
    setCustomers(prev => prev.map(c => {
      if (!ids.includes(c.id)) return c;
      let next = c;
      if (patch.status) next = withStatus(next, patch.status, todayISO());
      if (patch.followUpDays !== undefined) {
        next = { ...next, nextAction: { description: next.nextAction?.description || tf('todayView.defaultAction', language, { name: next.name }), dueDate: addDays(todayISO(), patch.followUpDays) } };
      }
      return next;
    }));
  }, [language]);

  // ---------- Customer modal ----------

  const openAddModal = useCallback(() => {
    setCustomerToEdit(null);
    setPrefill(null);
    pendingInteraction.current = undefined;
    setIsCustomerModalOpen(true);
  }, []);

  const openEditModal = useCallback((customer: Customer) => {
    setCustomerToEdit(customer);
    setPrefill(null);
    setIsCustomerModalOpen(true);
  }, []);

  const closeCustomerModal = () => {
    setIsCustomerModalOpen(false);
    setCustomerToEdit(null);
    setPrefill(null);
  };

  const handleSaveCustomer = (data: Partial<Customer>, customerId?: string) => {
    if (customerId) {
      handleUpdateCustomer(customerId, data);
    } else {
      const today = todayISO();
      const summary = pendingInteraction.current;
      const newCustomer: Customer = {
        id: generateId(),
        interactions: summary ? [{ id: generateId(), type: InteractionType.NOTE, date: today, summary }] : [],
        status: CustomerStatus.LEAD,
        lastContact: today,
        createdAt: today,
        statusHistory: [{ status: CustomerStatus.LEAD, date: today }],
        name: data.name!,
        company: data.company!,
        email: data.email ?? '',
        ...data,
      };
      pendingInteraction.current = undefined;
      setCustomers(prev => [newCustomer, ...prev]);
      setSelectedCustomerId(newCustomer.id);
      updatePrefs({ mainView: 'management' });
    }
    closeCustomerModal();
  };

  const handleExtracted = (data: Partial<Customer>, interactionSummary?: string) => {
    setIsCaptureOpen(false);
    setCustomerToEdit(null);
    setPrefill(data);
    pendingInteraction.current = interactionSummary;
    setIsCustomerModalOpen(true);
  };

  // ---------- Kanban ----------

  const handleMoveCustomer = (draggedId: string, newStatus: CustomerStatus, newIndexInColumn: number) => {
    const dragged = customers.find(c => c.id === draggedId);
    if (!dragged) return;
    const statusChanged = dragged.status !== newStatus;
    setCustomers(current => {
      const draggedCustomer = current.find(c => c.id === draggedId);
      if (!draggedCustomer) return current;
      const without = current.filter(c => c.id !== draggedId);
      const column = without.filter(c => c.status === newStatus);
      const before = column[newIndexInColumn];
      const updated = withStatus(draggedCustomer, newStatus, todayISO());
      let insertionIndex: number;
      if (before) insertionIndex = without.findIndex(c => c.id === before.id);
      else if (column.length) insertionIndex = without.findIndex(c => c.id === column[column.length - 1].id) + 1;
      else insertionIndex = without.length;
      const next = [...without];
      next.splice(insertionIndex, 0, updated);
      return next;
    });
    if (statusChanged && isClosed(newStatus)) setClosePrompt({ id: draggedId, status: newStatus });
  };

  // ---------- Data menu ----------

  const stamp = () => todayISO();
  const handleImport = async (file: File) => {
    const list = parseCustomers(await file.text());
    if (!list) return toast(t('data.importFail', language), { tone: 'error' });
    if (!window.confirm(tf('data.confirmImport', language, { n: list.length }))) return;
    const snapshot = customers;
    setCustomers(list);
    setSelectedCustomerId(null);
    toast(tf('data.importOk', language, { n: list.length }), { actionLabel: t('undo', language), onAction: () => setCustomers(snapshot) });
  };

  // ---------- Navigation & shortcuts ----------

  const openCustomer = useCallback((id: string) => {
    setSelectedCustomerId(id);
    updatePrefs({ mainView: 'management', viewMode: 'list' });
  }, []);

  const anyModalOpen = isCustomerModalOpen || isCaptureOpen || !!closePrompt || !!completeId || isShortcutsOpen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || anyModalOpen || isTypingTarget(e.target)) return;
      const focus = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 50);
      switch (e.key) {
        case 'n': case 'N': e.preventDefault(); openAddModal(); break;
        case '/': e.preventDefault(); updatePrefs({ mainView: 'management', viewMode: 'list' }); focus('customer-search'); break;
        case 'l': case 'L': if (selectedCustomerId) { e.preventDefault(); updatePrefs({ mainView: 'management', viewMode: 'list' }); focus('interaction-log-input'); } break;
        case '1': updatePrefs({ mainView: 'today' }); break;
        case '2': updatePrefs({ mainView: 'management' }); break;
        case '3': updatePrefs({ mainView: 'dashboard' }); break;
        case '?': setIsShortcutsOpen(true); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModalOpen, selectedCustomerId, openAddModal]);

  const navButton = (view: MainView, labelKey: string, key: string) => (
    <button
      onClick={() => updatePrefs({ mainView: view })}
      title={`${t(labelKey, language)} (${key})`}
      className={`border-b-2 pb-1 text-sm font-semibold transition-all duration-200 focus:outline-none whitespace-nowrap ${
        mainView === view ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
      }`}
    >
      {t(labelKey, language)}
    </button>
  );

  const iconBtn = 'h-9 w-9 flex items-center justify-center rounded-full bg-surface border border-border text-text-secondary hover:bg-secondary transition-colors active:scale-95';
  const closeTarget = closePrompt ? customers.find(c => c.id === closePrompt.id) ?? null : null;

  return (
    <div className="h-screen bg-background font-sans flex flex-col overflow-hidden">
      <header className="bg-surface/80 backdrop-blur-md border-b border-border px-4 py-3 flex flex-wrap gap-3 justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-lg font-bold text-text-primary whitespace-nowrap hidden lg:block">{language === 'zh' ? 'AI 客戶管理系統' : 'AI Customer Management'}</h1>
          <nav className="flex items-center gap-4">
            {navButton('today', 'today', '1')}
            {navButton('management', 'management', '2')}
            {navButton('dashboard', 'dashboard', '3')}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => updatePrefs({ language: language === 'en' ? 'zh' : 'en' })} className={`${iconBtn} text-sm font-semibold`} title={t('buttons.toggleLanguage', language)}>
            {language === 'en' ? t('langName', 'zh') : t('langName', 'en')}
          </button>
          <button onClick={() => updatePrefs({ theme: theme === 'light' ? 'dark' : 'light' })} className={iconBtn} title={t('buttons.toggleTheme', language)}>
            {theme === 'light' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>

          <div className="relative">
            <button onClick={() => setIsDataMenuOpen(o => !o)} className={iconBtn} title={t('data.menu', language)} aria-haspopup="menu" aria-expanded={isDataMenuOpen}>
              <DatabaseIcon className="w-5 h-5" />
            </button>
            {isDataMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsDataMenuOpen(false)} />
                <div role="menu" className="absolute right-0 mt-2 w-60 bg-surface border border-border rounded-lg shadow-lg z-40 py-1 text-sm">
                  {[
                    ['data.exportJson', () => downloadFile(`customers-${stamp()}.json`, exportJSON(customers), 'application/json')],
                    ['data.exportCsv', () => downloadFile(`customers-${stamp()}.csv`, exportCSV(customers), 'text/csv;charset=utf-8')],
                    ['data.importJson', () => fileInput.current?.click()],
                    ['data.resetDemo', () => {
                      if (!window.confirm(t('data.confirmReset', language))) return;
                      const snapshot = customers;
                      setCustomers(createDemoCustomers());
                      setSelectedCustomerId(null);
                      toast(t('data.resetDemo', language), { actionLabel: t('undo', language), onAction: () => setCustomers(snapshot) });
                    }],
                  ].map(([key, fn]) => (
                    <button key={key as string} role="menuitem" onClick={() => { setIsDataMenuOpen(false); (fn as () => void)(); }} className="w-full text-left px-4 py-2 hover:bg-secondary">
                      {t(key as string, language)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
          </div>

          {mainView === 'management' && (
            <>
              <button
                onClick={() => updatePrefs({ isAIAssistantOpen: !isAIAssistantOpen })}
                className={`px-3 h-9 hidden lg:flex items-center justify-center gap-2 rounded-lg border transition-colors active:scale-95 ${
                  isAIAssistantOpen ? 'bg-primary border-primary text-white' : 'bg-surface border-border text-text-secondary hover:bg-secondary'
                }`}
                title={t('buttons.toggleAI', language)}
              >
                <ChatbotIcon className="w-5 h-5" />
                <span className="text-sm font-semibold hidden xl:inline">{t('aiAssistant', language)}</span>
              </button>
              <div className="bg-surface border border-border p-1 rounded-lg flex items-center text-text-secondary">
                <button onClick={() => updatePrefs({ viewMode: 'list' })} className={`p-1.5 rounded-md transition-transform active:scale-95 ${viewMode === 'list' ? 'bg-primary text-white' : 'hover:text-text-primary'}`} title={t('buttons.listView', language)}>
                  <ViewListIcon className="w-5 h-5" />
                </button>
                <button onClick={() => updatePrefs({ viewMode: 'kanban' })} className={`p-1.5 rounded-md transition-transform active:scale-95 ${viewMode === 'kanban' ? 'bg-primary text-white' : 'hover:text-text-primary'}`} title={t('buttons.kanbanView', language)}>
                  <ViewGridIcon className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
          <button onClick={() => setIsCaptureOpen(true)} className="px-3 h-9 flex items-center gap-2 rounded-lg border border-primary text-primary hover:bg-primary/10 transition active:scale-95" title={t('capture.title', language)}>
            <SparklesIcon className="w-5 h-5" />
            <span className="text-sm font-semibold hidden sm:inline">{t('capture.button', language)}</span>
          </button>
          <button onClick={openAddModal} className="h-9 w-9 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-all active:scale-95" aria-label={t('addNewCustomer', language)} title={`${t('addNewCustomer', language)} (N)`}>
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-4 md:p-6 flex-grow min-h-0">
        <div key={mainView} className="animate-fade-in h-full">
          {mainView === 'today' && (
            <TodayView
              customers={customers}
              language={language}
              onOpenCustomer={openCustomer}
              onComplete={id => setCompleteId(id)}
              onSnooze={handleSnooze}
              onSetNextAction={handleSetNextAction}
            />
          )}
          {mainView === 'management' && (
            <CustomerDashboard
              viewMode={viewMode}
              customers={customers}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomerId}
              onAddInteraction={handleAddInteraction}
              onUpdateCustomer={handleUpdateCustomer}
              onOpenAddCustomerModal={openAddModal}
              onEditCustomer={openEditModal}
              language={language}
              isAIAssistantOpen={isAIAssistantOpen}
              onMoveCustomer={handleMoveCustomer}
              onSetNextAction={handleSetNextAction}
              onSnooze={handleSnooze}
              onCompleteAction={id => setCompleteId(id)}
              onDeleteCustomers={handleDeleteCustomers}
              onBulkUpdate={handleBulkUpdate}
            />
          )}
          {mainView === 'dashboard' && <AnalyticsDashboard customers={customers} language={language} />}
        </div>
      </main>

      <AddCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={closeCustomerModal}
        onSave={handleSaveCustomer}
        customerToEdit={customerToEdit}
        prefill={prefill}
        language={language}
      />
      <SmartCaptureModal isOpen={isCaptureOpen} onClose={() => setIsCaptureOpen(false)} onExtracted={handleExtracted} language={language} />
      <CloseReasonModal
        customer={closeTarget}
        status={closePrompt?.status ?? null}
        language={language}
        onSkip={() => setClosePrompt(null)}
        onSave={reason => {
          if (closePrompt) updateCustomer(closePrompt.id, c => ({ ...c, closedReason: reason, nextAction: undefined }));
          setClosePrompt(null);
        }}
      />
      <CompleteActionModal customer={completeId ? customers.find(c => c.id === completeId) ?? null : null} onClose={() => setCompleteId(null)} onComplete={handleComplete} language={language} />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} language={language} />
    </div>
  );
};

export default App;
