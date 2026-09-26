import { apiJson } from './api';

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string; // ISO timestamp
  snippet: string;
  direction: 'in' | 'out';
}

export interface GmailStatus {
  available: boolean;
  connected: boolean;
  email: string | null;
}

export const getGmailStatus = () => apiJson<GmailStatus>('/api/google/connect');
export const disconnectGmail = () => apiJson('/api/google/connect', { method: 'DELETE' });
export const listGmailWith = (email: string) =>
  apiJson<{ messages: GmailMessage[] }>(`/api/gmail/messages?email=${encodeURIComponent(email)}`).then(r => r.messages);
export const listRecentInbox = () =>
  apiJson<{ messages: GmailMessage[] }>('/api/gmail/messages?inbox=1').then(r => r.messages);
export const getGmailText = (id: string) =>
  apiJson<{ id: string; subject: string; from: string; date: string; text: string }>(`/api/gmail/message?id=${encodeURIComponent(id)}`);
export const sendGmail = (to: string, subject: string, body: string) =>
  apiJson<{ id: string; threadId: string }>('/api/gmail/send', { method: 'POST', body: JSON.stringify({ to, subject, body }) });
