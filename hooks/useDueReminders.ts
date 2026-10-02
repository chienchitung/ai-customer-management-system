import { useEffect } from 'react';
import { Customer } from '../types';
import { buildWorkList } from '../lib/insights';
import { todayISO } from '../lib/dates';

const LAST_NOTIFIED_KEY = 'aicms.reminder.lastNotified';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

/**
 * Due-date reminders without a server:
 * - the tab title shows how many follow-ups are due today or overdue;
 * - if enabled and permitted, one desktop notification per day lists them.
 */
export const useDueReminders = (customers: Customer[], enabled: boolean, language: 'en' | 'zh', onOpenToday: () => void, loaded: boolean) => {
  useEffect(() => {
    if (!loaded) return;
    const check = () => {
      const due = buildWorkList(customers, todayISO()).filter(i => i.kind === 'overdue' || i.kind === 'dueToday');
      document.title = due.length ? `(${due.length}) Pulse CRM` : 'Pulse CRM';
      if (!enabled || !due.length || !notificationsSupported() || Notification.permission !== 'granted') return;
      const today = todayISO();
      try { if (localStorage.getItem(LAST_NOTIFIED_KEY) === today) return; localStorage.setItem(LAST_NOTIFIED_KEY, today); } catch { return; }
      const names = due.slice(0, 3).map(i => i.customer.name).join('、');
      const n = new Notification(language === 'zh' ? `今天有 ${due.length} 件跟進待處理` : `${due.length} follow-ups need attention today`, {
        body: due.length > 3 ? `${names}${language === 'zh' ? ' 等' : ' and more'}` : names,
        tag: 'pulse-due-reminder',
      });
      n.onclick = () => { window.focus(); onOpenToday(); n.close(); };
    };
    check();
    // Re-check hourly so a tab left open still reminds the next morning.
    const timer = setInterval(check, 3600_000);
    return () => clearInterval(timer);
  }, [customers, enabled, language, onOpenToday, loaded]);
};
