import { HttpError } from './http.js';
import { ServerConfig } from './config.js';

// Thin Gmail API client using a stored OAuth refresh token.

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string; // ISO
  snippet: string;
  direction: 'in' | 'out';
}

export const refreshAccessToken = async (config: ServerConfig, refreshToken: string, fetchImpl: typeof fetch = fetch) => {
  if (!config.googleClientId || !config.googleClientSecret) throw new HttpError(500, 'google_not_configured');
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; scope?: string; error?: string };
  if (!res.ok || !data.access_token) {
    // invalid_grant: the user revoked access or the token expired -> must reconnect.
    throw new HttpError(data.error === 'invalid_grant' ? 409 : 502, data.error === 'invalid_grant' ? 'google_reauth_required' : 'google_error');
  }
  return { accessToken: data.access_token, scope: data.scope ?? '' };
};

export const revokeToken = (token: string, fetchImpl: typeof fetch = fetch) =>
  fetchImpl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined);

const gmail = async (accessToken: string, path: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch) => {
  const res = await fetchImpl(`${GMAIL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 401 || res.status === 403) throw new HttpError(409, 'google_reauth_required');
  if (!res.ok) throw new HttpError(502, 'google_error');
  return res.json() as Promise<any>;
};

export const getProfileEmail = async (accessToken: string, fetchImpl: typeof fetch = fetch): Promise<string> =>
  (await gmail(accessToken, '/profile', {}, fetchImpl)).emailAddress;

const header = (msg: any, name: string): string =>
  msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

/** Lists recent messages exchanged with the given address. */
export const listMessagesWith = (accessToken: string, email: string, ownEmail: string | null, max: number, fetchImpl: typeof fetch = fetch) =>
  listMessages(accessToken, `{from:${email} to:${email} cc:${email}} -in:chats`, ownEmail, email, max, fetchImpl);

/** Recent primary-inbox messages, for creating customers from new leads. */
export const listRecentInbox = (accessToken: string, ownEmail: string | null, max: number, fetchImpl: typeof fetch = fetch) =>
  listMessages(accessToken, 'in:inbox newer_than:14d -category:promotions -category:social -category:updates -category:forums', ownEmail, null, max, fetchImpl);

const listMessages = async (
  accessToken: string, q: string, ownEmail: string | null, counterpart: string | null, max: number, fetchImpl: typeof fetch,
): Promise<GmailMessageSummary[]> => {
  const list = await gmail(accessToken, `/messages?maxResults=${max}&q=${encodeURIComponent(q)}`, {}, fetchImpl);
  const ids: { id: string }[] = list.messages ?? [];
  const params = 'format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date';
  const messages = await Promise.all(ids.map(({ id }) => gmail(accessToken, `/messages/${id}?${params}`, {}, fetchImpl)));
  return messages.map(m => {
    const from = header(m, 'From');
    const isOut = ownEmail
      ? from.toLowerCase().includes(ownEmail.toLowerCase())
      : !!counterpart && !from.toLowerCase().includes(counterpart.toLowerCase());
    return {
      id: m.id,
      threadId: m.threadId,
      subject: header(m, 'Subject'),
      from,
      to: header(m, 'To'),
      date: new Date(Number(m.internalDate)).toISOString(),
      snippet: decodeEntities(m.snippet ?? ''),
      direction: isOut ? 'out' : 'in',
    };
  });
};

const decodeEntities = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const b64urlDecode = (data: string) => Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

const findPart = (part: any, mime: string): any => {
  if (part?.mimeType === mime && part.body?.data) return part;
  for (const p of part?.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
};

/** Returns a message's plain-text body (falls back to stripped HTML), truncated. */
export const getMessageText = async (accessToken: string, id: string, fetchImpl: typeof fetch = fetch) => {
  const m = await gmail(accessToken, `/messages/${encodeURIComponent(id)}?format=full`, {}, fetchImpl);
  const plain = findPart(m.payload, 'text/plain');
  const html = plain ? null : findPart(m.payload, 'text/html');
  let text = plain ? b64urlDecode(plain.body.data) : html ? b64urlDecode(html.body.data).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ') : m.snippet ?? '';
  text = decodeEntities(text).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { id: m.id, subject: header(m, 'Subject'), from: header(m, 'From'), date: new Date(Number(m.internalDate)).toISOString(), text: text.slice(0, 8000) };
};

/** RFC 2047 encoding so non-ASCII (e.g. Chinese) subjects display correctly. */
const encodeHeader = (value: string) =>
  /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;

export const buildRawEmail = (to: string, subject: string, body: string) => {
  const cleanTo = to.replace(/[\r\n]/g, '');
  const mime = [
    `To: ${cleanTo}`,
    `Subject: ${encodeHeader(subject.replace(/[\r\n]/g, ' '))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body, 'utf8').toString('base64'),
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const sendEmail = async (accessToken: string, to: string, subject: string, body: string, threadId?: string, fetchImpl: typeof fetch = fetch) => {
  const res = await gmail(accessToken, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw: buildRawEmail(to, subject, body), ...(threadId ? { threadId } : {}) }),
  }, fetchImpl);
  return { id: res.id as string, threadId: res.threadId as string };
};
