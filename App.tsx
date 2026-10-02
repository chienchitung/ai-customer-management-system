import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Customer, Interaction, CustomerStatus, InteractionType, NextAction } from './types';
import CustomerDashboard, { WelcomeScreen } from './components/CustomerDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AddCustomerModal from './components/AddCustomerModal';
import TodayView from './components/TodayView';
import { CloseReasonModal, CompleteActionModal, SmartCaptureModal, ShortcutsModal } from './components/Dialogs';
import { useToast } from './components/Toast';
import { ConfirmProvider, useConfirm } from './components/ConfirmDialog';
import AuthScreen from './components/AuthScreen';
import ImportCsvModal from './components/ImportCsvModal';
import { BottomNav, SettingsMenu, SyncBadge, SettingsSection } from './components/AppChrome';
import SettingsPage from './components/SettingsPage';
import { CommandPalette, Sidebar } from './components/Shell';
import { ViewListIcon, ViewGridIcon, PlusIcon, ChatbotIcon, SparklesIcon, SearchIcon } from './components/icons';
import { useAuth } from './hooks/useAuth';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useDueReminders } from './hooks/useDueReminders';
import { useCustomerStore } from './hooks/useCustomerStore';
import { GmailProvider, useGmailState } from './hooks/useGmail';
import { isCloud } from './lib/supabase';
import { t, tf } from './localization';
import { generateId } from './lib/ids';
import { addDays, todayISO } from './lib/dates';
import { buildWorkList, withStatus } from './lib/insights';
import { createDemoCustomers, isDemoCustomer } from './data/demo';

const DEMO_BANNER_KEY = 'aicms.demoBannerHidden';
import { Prefs, loadPrefs, savePrefs, exportJSON, exportCSV, downloadFile, parseCustomers } from './lib/storage';

import { CurrencyProvider } from './components/Currency';
import { Moon, Languages, Download, CircleHelp } from 'lucide-react';
export { generateId };


const isClosed = (s: CustomerStatus) => s === CustomerStatus.CLOSED_WON || s === CustomerStatus.CLOSED_LOST;

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

// Keeps interactions newest-first and lastContact in step with the latest one.
const withInteractions = (c: Customer, interactions: Interaction[]): Customer => {
  const sorted = [...interactions].sort((a, b) => b.date.localeCompare(a.date));
  return { ...c, interactions: sorted, lastContact: sorted[0]?.date ?? c.createdAt ?? c.lastContact };
};

const LEGACY_KEY = 'aicms.customers.v1';

/** Customers saved in this browser before cloud sign-in (local mode), if any. */
const readLegacyCustomers = (): Customer[] => {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? parseCustomers(raw) ?? [] : [];
  } catch {
    return [];
  }
};

/**
 * Top-level shell: preferences, authentication (cloud mode) and Gmail state.
 */
const App: React.FC = () => {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const updatePrefs = useCallback((patch: Partial<Prefs>) => setPrefs(p => ({ ...p, ...patch })), []);
  const { language, theme } = prefs;

  useEffect(() => savePrefs(prefs), [prefs]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.lang = language === 'zh' ? 'zh-Hant' : 'en';
  }, [theme, language]);

  const refreshGmail = useRef<() => void>();
  const auth = useAuth(() => refreshGmail.current?.());
  const gmail = useGmailState(auth.userId);
  refreshGmail.current = gmail.refresh;

  let content: React.ReactNode;
  if (isCloud && auth.loading) {
    content = <div className="h-screen flex items-center justify-center text-text-secondary">{t('auth.loading', language)}</div>;
  } else if (isCloud && !auth.userId) {
    content = <AuthScreen language={language} onToggleLanguage={() => updatePrefs({ language: language === 'en' ? 'zh' : 'en' })} />;
  } else {
    content = <Workspace key={auth.userId ?? 'local'} prefs={prefs} updatePrefs={updatePrefs} userId={auth.userId} userEmail={auth.email} onSignOut={auth.signOut} />;
  }

  return (
    <ConfirmProvider language={language}>
      <GmailProvider value={gmail}><CurrencyProvider>{content}</CurrencyProvider></GmailProvider>
    </ConfirmProvider>
  );
};

interface WorkspaceProps {
  prefs: Prefs;
  updatePrefs: (patch: Partial<Prefs>) => void;
  userId: string | null;
  userEmail: string | null;
  onSignOut: () => void;
}

/**
 * The signed-in workspace. Owns customer data and all dialogs.
 */
const Workspace: React.FC<WorkspaceProps> = ({ prefs, updatePrefs, userId, userEmail, onSignOut }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const { language, theme, viewMode, mainView, isAIAssistantOpen } = prefs;
  // Below 1280px the expanded sidebar would squeeze the content, so it shows as an icon rail.
  const isWideScreen = useMediaQuery('(min-width: 1280px)');
  const sidebarCollapsed = prefs.sidebarCollapsed || !isWideScreen;
  const store = useCustomerStore(userId, () => createDemoCustomers(language));
  const { customers, setCustomers } = store;
  const [legacy, setLegacy] = useState<Customer[]>(() => (isCloud ? readLegacyCustomers() : []));

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [prefill, setPrefill] = useState<Partial<Customer> | null>(null);
  const pendingInteraction = useRef<string | undefined>();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [closePrompt, setClosePrompt] = useState<{ id: string; status: CustomerStatus } | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (store.localSaveFailed) toast(t('data.saveFailed', language), { tone: 'error' });
  }, [store.localSaveFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  const openToday = useCallback(() => { setSettingsSection(null); updatePrefs({ mainView: 'today' }); }, [updatePrefs]);
  useDueReminders(customers, prefs.dueReminders, language, openToday, store.loaded);

  const todayCount = useMemo(
    () => buildWorkList(customers, todayISO()).filter(i => i.kind === 'overdue' || i.kind === 'dueToday').length,
    [customers],
  );

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId) || null,
    [selectedCustomerId, customers],
  );

  // Select the first customer on desktop when entering management with nothing selected.
  useEffect(() => {
    if (mainView === 'management' && !selectedCustomerId && customers.length && window.innerWidth >= 1024) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [mainView, store.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Customer mutations ----------

  const updateCustomer = useCallback((id: string, fn: (c: Customer) => Customer) => {
    setCustomers(prev => prev.map(c => (c.id === id ? fn(c) : c)));
  }, [setCustomers]);

  const handleAddInteraction = useCallback((customerId: string, data: Omit<Interaction, 'id'>) => {
    updateCustomer(customerId, c => ({
      ...c,
      interactions: [{ ...data, id: generateId() }, ...c.interactions],
      lastContact: !c.lastContact || data.date > c.lastContact ? data.date : c.lastContact,
    }));
  }, [updateCustomer]);

  const handleUpdateInteraction = useCallback((customerId: string, interactionId: string, patch: Partial<Omit<Interaction, 'id'>>) => {
    updateCustomer(customerId, c => withInteractions(c, c.interactions.map(i => (i.id === interactionId ? { ...i, ...patch } : i))));
  }, [updateCustomer]);

  const handleDeleteInteraction = useCallback((customerId: string, interactionId: string) => {
    const removed = customers.find(c => c.id === customerId)?.interactions.find(i => i.id === interactionId);
    if (!removed) return;
    updateCustomer(customerId, c => withInteractions(c, c.interactions.filter(i => i.id !== interactionId)));
    toast(t('interactionEdit.deleted', language), {
      actionLabel: t('undo', language),
      onAction: () => updateCustomer(customerId, c => withInteractions(c, [removed, ...c.interactions])),
    });
  }, [customers, updateCustomer, toast, language]);

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
  }, [customers, selectedCustomerId, language, toast, setCustomers]);

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
  }, [language, setCustomers]);

  // ---------- Customer modal ----------

  // Callers may pass a stage (kanban column) or be wired straight to onClick, which passes
  // the click event — only accept a real stage, otherwise default to Lead.
  const openAddModal = useCallback((status?: unknown) => {
    const stage = Object.values(CustomerStatus).includes(status as CustomerStatus) ? (status as CustomerStatus) : CustomerStatus.LEAD;
    setCustomerToEdit(null);
    setPrefill({ status: stage });
    setSettingsSection(null);
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
        statusHistory: [{ status: data.status ?? CustomerStatus.LEAD, date: today }],
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
    if (!(await confirm(tf('data.confirmImport', language, { n: list.length }), { danger: true }))) return;
    const snapshot = customers;
    setCustomers(list);
    setSelectedCustomerId(null);
    toast(tf('data.importOk', language, { n: list.length }), { actionLabel: t('undo', language), onAction: () => setCustomers(snapshot) });
  };

  // ---------- Navigation & shortcuts ----------

  const openCustomer = useCallback((id: string) => {
    setSettingsSection(null);
    setSelectedCustomerId(id);
    updatePrefs({ mainView: 'management', viewMode: 'list' });
  }, [updatePrefs]);

  const loadDemo = () => { dismissDemoBanner(false); setCustomers(prev => [...createDemoCustomers(language), ...prev]); };

  // Demo customers are clearly marked and can be removed in one step, keeping the user's own data.
  const demoCount = customers.filter(isDemoCustomer).length;
  const [demoBannerHidden, setDemoBannerHidden] = useState(() => { try { return localStorage.getItem(DEMO_BANNER_KEY) === '1'; } catch { return false; } });
  const dismissDemoBanner = (hidden: boolean) => {
    setDemoBannerHidden(hidden);
    try { if (hidden) localStorage.setItem(DEMO_BANNER_KEY, '1'); else localStorage.removeItem(DEMO_BANNER_KEY); } catch { /* storage unavailable */ }
  };
  const clearDemo = () => {
    const snapshot = customers;
    setCustomers(prev => prev.filter(c => !isDemoCustomer(c)));
    setSelectedCustomerId(null);
    toast(tf('demo.cleared', language, { n: demoCount }), { actionLabel: t('undo', language), onAction: () => setCustomers(snapshot) });
  };

  const resetDemo = async () => {
    if (!(await confirm(t('data.confirmReset', language), { danger: true }))) return;
    const snapshot = customers;
    setCustomers(createDemoCustomers(language));
    setSelectedCustomerId(null);
    toast(t('data.resetDemo', language), { actionLabel: t('undo', language), onAction: () => setCustomers(snapshot) });
  };

  const uploadLegacy = () => {
    const existing = new Set(customers.map(c => c.id));
    const toAdd = legacy.filter(c => !existing.has(c.id));
    setCustomers(prev => [...toAdd, ...prev]);
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
    setLegacy([]);
    toast(tf('migrate.done', language, { n: toAdd.length }));
  };

  const dataItems = [
    { label: t('data.exportJson', language), onClick: () => downloadFile(`customers-${stamp()}.json`, exportJSON(customers), 'application/json') },
    { label: t('data.exportCsv', language), onClick: () => downloadFile(`customers-${stamp()}.csv`, exportCSV(customers), 'text/csv;charset=utf-8') },
    { label: t('data.importCsv', language), onClick: () => setIsImportCsvOpen(true) },
    { label: t('data.importJson', language), onClick: () => fileInput.current?.click() },
    { label: t('data.resetDemo', language), onClick: resetDemo, danger: true },
  ];

  const anyModalOpen = isCustomerModalOpen || isCaptureOpen || !!closePrompt || !!completeId || isShortcutsOpen || isPaletteOpen || isImportCsvOpen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen(open => !open);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || anyModalOpen || isTypingTarget(e.target)) return;
      const focus = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 50);
      switch (e.key) {
        case 'n': case 'N': e.preventDefault(); openAddModal(); break;
        case '/': e.preventDefault(); setSettingsSection(null); updatePrefs({ mainView: 'management', viewMode: 'list' }); focus('customer-search'); break;
        case 'l': case 'L': if (selectedCustomerId) { e.preventDefault(); setSettingsSection(null); updatePrefs({ mainView: 'management', viewMode: 'list' }); focus('interaction-log-input'); } break;
        case '1': setSettingsSection(null); updatePrefs({ mainView: 'today' }); break;
        case '2': setSettingsSection(null); updatePrefs({ mainView: 'management' }); break;
        case '3': setSettingsSection(null); updatePrefs({ mainView: 'dashboard' }); break;
        case '?': setIsShortcutsOpen(true); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModalOpen, selectedCustomerId, openAddModal, updatePrefs]);

  const closeTarget = closePrompt ? customers.find(c => c.id === closePrompt.id) ?? null : null;
  const toggleTheme = () => updatePrefs({ theme: theme === 'light' ? 'dark' : 'light' });
  const toggleLanguage = () => updatePrefs({ language: language === 'en' ? 'zh' : 'en' });

  const paletteActions = [
    { id: 'a-new', label: t('shell.newCustomer', language), hint: 'N', icon: <PlusIcon className="w-4 h-4" />, run: openAddModal },
    { id: 'a-capture', label: t('capture.button', language), icon: <SparklesIcon className="w-4 h-4" />, run: () => setIsCaptureOpen(true) },
    { id: 'a-theme', label: t('shell.toggleTheme', language), icon: <Moon className="w-4 h-4" />, run: toggleTheme },
    { id: 'a-lang', label: t('shell.toggleLanguage', language), icon: <Languages className="w-4 h-4" />, run: toggleLanguage },
    ...dataItems.filter(d => !d.danger).map((d, i) => ({ id: `a-data-${i}`, label: d.label, icon: <Download className="w-4 h-4" />, run: d.onClick })),
    { id: 'a-help', label: t('shortcuts.title', language), hint: '?', icon: <CircleHelp className="w-4 h-4" />, run: () => setIsShortcutsOpen(true) },
  ];

  const settingsProps = {
    language, userEmail,
    onOpenSettings: setSettingsSection,
    onShowShortcuts: () => setIsShortcutsOpen(true),
    onSignOut,
  };

  const viewToggle = (
    <div className="hidden sm:flex items-center h-9 p-[3px] gap-0.5 rounded-lg border border-border bg-secondary/60">
      {([['list', 'buttons.listView', <ViewListIcon key="l" className="w-4 h-4" />], ['kanban', 'buttons.kanbanView', <ViewGridIcon key="k" className="w-4 h-4" />]] as const).map(([mode, label, icon]) => (
        <button
          key={mode}
          onClick={() => updatePrefs({ viewMode: mode })}
          aria-pressed={viewMode === mode}
          title={t(label, language)}
          aria-label={t(label, language)}
          className={`h-7 w-8 flex items-center justify-center rounded-md transition-colors ${viewMode === mode ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
        >
          {icon}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen bg-background font-sans flex overflow-hidden text-text-primary">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] btn btn-primary">
        {language === 'zh' ? '跳到主要內容' : 'Skip to main content'}
      </a>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={isWideScreen ? () => updatePrefs({ sidebarCollapsed: !prefs.sidebarCollapsed }) : undefined}
        view={settingsSection ? undefined : mainView}
        onChange={v => { setSettingsSection(null); updatePrefs({ mainView: v }); }}
        todayCount={todayCount}
        customerCount={customers.length}
        language={language}
        onOpenPalette={() => setIsPaletteOpen(true)}
        onNewCustomer={openAddModal}
        onCapture={() => setIsCaptureOpen(true)}
        footer={
          <div className="space-y-2 border-t border-border pt-3">
            <div className={sidebarCollapsed ? 'hidden' : 'px-2 flex items-center justify-between'}><span className="text-[10px] font-semibold uppercase tracking-[.14em] text-text-secondary">{language === 'zh' ? '資料狀態' : 'Data status'}</span><SyncBadge status={store.status} onRetry={store.retry} language={language} /></div>
            <SettingsMenu {...settingsProps} variant={sidebarCollapsed ? 'icon' : 'account'} />
          </div>
        }
      />

      <div className="flex-grow min-w-0 flex flex-col bg-background overflow-hidden">
        <header className="h-16 flex-shrink-0 border-b border-border bg-surface/95 backdrop-blur-xl px-4 md:px-6 flex items-center gap-3">
          <div className="flex-grow min-w-0"><p className="text-xs text-text-secondary">Pulse CRM <span className="mx-1.5">/</span> {settingsSection ? (language === 'zh' ? '設定' : 'Settings') : t(`shell.titles.${mainView}`, language)}</p><h1 className="text-lg font-semibold tracking-tight truncate">{settingsSection ? (language === 'zh' ? '設定' : 'Settings') : t(`shell.titles.${mainView}`, language)}</h1></div>
          <span className="hidden sm:inline md:hidden"><SyncBadge status={store.status} onRetry={store.retry} language={language} /></span>
          {mainView === 'management' && !settingsSection && viewToggle}
          {mainView === 'management' && !settingsSection && (
            <button
              onClick={() => updatePrefs({ isAIAssistantOpen: !isAIAssistantOpen })}
              aria-pressed={isAIAssistantOpen}
              title={t('buttons.toggleAI', language)}
              className={`btn ${isAIAssistantOpen ? 'btn-secondary text-primary' : 'btn-ghost'}`}
            >
              <ChatbotIcon className="w-4 h-4" /><span className="hidden lg:inline">{t('aiAssistant', language)}</span>
            </button>
          )}
          <button onClick={() => setIsPaletteOpen(true)} className="btn btn-ghost btn-icon md:hidden" aria-label={t('shell.search', language)}>
            <SearchIcon className="w-5 h-5" />
          </button>
          <button onClick={() => setIsCaptureOpen(true)} className="btn btn-ghost btn-icon hidden sm:inline-flex md:hidden" aria-label={t('capture.button', language)}>
            <SparklesIcon className="w-5 h-5" />
          </button>
          <button onClick={() => openAddModal()} className="btn btn-primary" aria-label={t('addNewCustomer', language)} title={`${t('addNewCustomer', language)} (N)`}>
            <PlusIcon className="w-4 h-4" /><span className="hidden sm:inline">{t('shell.newCustomer', language)}</span>
          </button>
          <span className="md:hidden"><SettingsMenu {...settingsProps} /></span>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
        </header>

        {demoCount > 0 && !demoBannerHidden && store.loaded && !settingsSection && (
          <div className="border-b border-border bg-amber-50 dark:bg-amber-500/10 px-4 md:px-6 py-2 flex flex-wrap items-center gap-2 text-sm" role="status">
            <span className="flex-grow min-w-0">{tf('demo.banner', language, { n: demoCount })}</span>
            <button onClick={clearDemo} className="btn btn-secondary btn-sm">{t('demo.clear', language)}</button>
            <button onClick={() => dismissDemoBanner(true)} className="btn btn-ghost btn-sm">{t('demo.keep', language)}</button>
          </div>
        )}
        {legacy.length > 0 && store.loaded && (
          <div className="border-b border-border bg-primary/5 px-4 md:px-6 py-2 flex flex-wrap items-center gap-3 text-sm" role="status">
            <span className="flex-grow">{tf('migrate.found', language, { n: legacy.length })}</span>
            <button onClick={uploadLegacy} className="btn btn-primary btn-sm">{t('migrate.import', language)}</button>
            <button onClick={() => setLegacy([])} className="btn btn-ghost btn-sm">{t('migrate.dismiss', language)}</button>
          </div>
        )}

        <main id="main-content" tabIndex={-1} className={`flex-grow min-h-0 outline-none ${mainView === 'management' && !settingsSection && customers.length > 0 ? 'pb-16 md:pb-0' : 'p-4 md:p-6 pb-20 md:pb-6'}`}>
          <div key={mainView} className="animate-fade-in h-full">
            {settingsSection ? <SettingsPage section={settingsSection} onSection={setSettingsSection} language={language} theme={theme} userEmail={userEmail} onLanguage={language => updatePrefs({ language })} onTheme={theme => updatePrefs({ theme })} dueReminders={prefs.dueReminders} onDueReminders={on => updatePrefs({ dueReminders: on })} dataItems={dataItems} onBack={() => setSettingsSection(null)} /> : !store.loaded ? (
              <div className="space-y-3 max-w-5xl mx-auto" aria-busy="true">
                {[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-secondary animate-pulse" />)}
              </div>
            ) : customers.length === 0 ? (
              <WelcomeScreen onOpenAddCustomerModal={openAddModal} onOpenCapture={() => setIsCaptureOpen(true)} onLoadDemo={loadDemo} language={language} />
            ) : (<>
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
                onUpdateInteraction={handleUpdateInteraction}
                onDeleteInteraction={handleDeleteInteraction}
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
            </>)}
          </div>
        </main>
      </div>

      <BottomNav view={settingsSection ? undefined : mainView} onChange={v => { setSettingsSection(null); updatePrefs({ mainView: v }); }} todayCount={todayCount} language={language} />

      <ImportCsvModal
        isOpen={isImportCsvOpen}
        onClose={() => setIsImportCsvOpen(false)}
        existing={customers}
        language={language}
        onImport={imported => {
          const snapshot = customers;
          setCustomers(prev => [...imported, ...prev]);
          setIsImportCsvOpen(false);
          setSettingsSection(null);
          updatePrefs({ mainView: 'management' });
          toast(tf('data.importOk', language, { n: imported.length }), { actionLabel: t('undo', language), onAction: () => setCustomers(snapshot) });
        }}
      />
      {isPaletteOpen && <CommandPalette
        isOpen
        onClose={() => setIsPaletteOpen(false)}
        customers={customers}
        language={language}
        onOpenCustomer={openCustomer}
        onNavigate={v => { setSettingsSection(null); updatePrefs({ mainView: v }); }}
        actions={paletteActions}
      />}

      <AddCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={closeCustomerModal}
        onSave={handleSaveCustomer}
        customerToEdit={customerToEdit}
        prefill={prefill}
        existing={customers}
        onOpenExisting={id => { closeCustomerModal(); openCustomer(id); }}
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
