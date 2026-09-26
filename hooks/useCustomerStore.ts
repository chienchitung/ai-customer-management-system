import { useCallback, useEffect, useRef, useState } from 'react';
import { Customer } from '../types';
import { isCloud } from '../lib/supabase';
import { loadCustomers, saveCustomers } from '../lib/storage';
import { deleteCustomers, fetchCustomers, upsertCustomers } from '../lib/remoteStore';
import { Snapshot, diffCustomers, snapshotOf } from '../lib/sync';

export type SyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error';

const cacheKey = (userId: string) => `aicms.cache.${userId}`;
const SAVE_DEBOUNCE_MS = 600;

/**
 * Owns the customer list.
 * - Local mode: persisted to localStorage.
 * - Cloud mode: loaded from Supabase for the signed-in user; edits are diffed
 *   and written back (debounced), with a per-user cache for instant startup.
 */
export const useCustomerStore = (userId: string | null, localFallback: () => Customer[]) => {
  const [customers, setCustomers] = useState<Customer[]>(() => (isCloud ? [] : loadCustomers(localFallback())));
  const [status, setStatus] = useState<SyncStatus>(isCloud ? 'loading' : 'local');
  const [loaded, setLoaded] = useState(!isCloud);
  const synced = useRef<Snapshot>(new Map());
  const latest = useRef(customers);
  latest.current = customers;
  const flushing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [localSaveFailed, setLocalSaveFailed] = useState(false);

  // Initial load for the signed-in user.
  useEffect(() => {
    if (!isCloud || !userId) return;
    let cancelled = false;
    setLoaded(false);
    setStatus('loading');
    try {
      const cached = localStorage.getItem(cacheKey(userId));
      if (cached) setCustomers(JSON.parse(cached));
    } catch { /* ignore */ }
    fetchCustomers()
      .then(remote => {
        if (cancelled) return;
        synced.current = snapshotOf(remote);
        setCustomers(remote);
        setLoaded(true);
        setStatus('saved');
      })
      .catch(err => {
        console.error('Failed to load customers:', err);
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, [userId]);

  const flush = useCallback(async () => {
    if (!isCloud || !userId || flushing.current) return;
    const current = latest.current;
    const { upserts, deletes } = diffCustomers(synced.current, current);
    if (!upserts.length && !deletes.length) {
      setStatus('saved');
      return;
    }
    flushing.current = true;
    setStatus('saving');
    try {
      await upsertCustomers(upserts);
      await deleteCustomers(deletes);
      synced.current = snapshotOf(current);
      flushing.current = false;
      // More edits may have arrived while saving.
      if (latest.current !== current) await flush();
      else setStatus('saved');
    } catch (err) {
      flushing.current = false;
      console.error('Failed to save customers:', err);
      setStatus('error');
    }
  }, [userId]);

  // Persist on every change.
  useEffect(() => {
    if (!isCloud) {
      if (!saveCustomers(customers)) setLocalSaveFailed(true);
      return;
    }
    if (!userId || !loaded) return;
    try { localStorage.setItem(cacheKey(userId), JSON.stringify(customers)); } catch { /* ignore */ }
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [customers, userId, loaded, flush]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'saving' || status === 'error') e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  return { customers, setCustomers, status, loaded, retry: flush, localSaveFailed };
};
