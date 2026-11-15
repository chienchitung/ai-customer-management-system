import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import { createRoutes } from '../server/routes';
import { configFromEnv } from '../server/config';
import { Customer, CustomerStatus, InteractionType } from '../types';
import { DocumentAnalysis, applyDocument, documentLogText, matchCustomer, prefillFromDocument, proposeChanges } from '../lib/documentAgent';

// ---------- /api/documents/parse against a fake ComPDF ----------

const env = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', VERCEL: '1' };

type Seen = { url: string; headers: Record<string, string>; form?: FormData }[];
const fakeFetch = (seen: Seen, opts: { compdf?: unknown; download?: string; quota?: number } = {}) => {
  let quota = opts.quota ?? 5;
  return (async (input: any, init: any = {}) => {
    const url = String(input);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/auth/v1/user')) return init.headers.Authorization === 'Bearer good' ? json({ id: 'user-1' }) : json({}, 401);
    if (url.includes('/rpc/consume_ai_quota')) return json(--quota >= 0);
    if (url.startsWith('https://api-server.compdf.com/server/')) {
      seen.push({ url, headers: init.headers, form: init.body });
      return json(opts.compdf ?? { code: '200', msg: 'success', data: { taskId: 't-1', downloadUrl: 'https://files.compdf.com/out.md', status: 'TaskFinish', convertSize: 2 } });
    }
    if (url === 'https://files.compdf.com/out.md') return new Response(opts.download ?? '# Purchase Order\n\nTotal: USD 48,000');
    return json({ error: 'unexpected ' + url }, 500);
  }) as typeof fetch;
};

const call = async (routes: any, body: unknown, token = 'good') => {
  const req: any = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = 'POST'; req.url = '/api/documents/parse'; req.headers = { authorization: `Bearer ${token}` };
  let status = 0; let out = '';
  const res: any = { headersSent: false, statusCode: 200, setHeader() {}, write(c: string) { out += c; }, end(c?: string) { if (c) out += c; status = this.statusCode; } };
  await routes['/api/documents/parse'](req, res);
  return { status, body: JSON.parse(out) };
};

const pdf = { fileName: 'po.pdf', contentType: 'application/pdf', dataBase64: Buffer.from('%PDF-1.7 test').toString('base64') };

describe('/api/documents/parse', () => {
  it('sends the PDF to ComPDF pdf-to-markdown with OCR and returns the text', async () => {
    const seen: Seen = [];
    const routes = createRoutes(configFromEnv({ ...env, COMPDF_API_KEY: 'ck' }), fakeFetch(seen));
    const r = await call(routes, pdf);
    expect(r).toEqual({ status: 200, body: { text: '# Purchase Order\n\nTotal: USD 48,000', truncated: false, pages: 2, taskId: 't-1' } });
    expect(seen[0].url).toBe('https://api-server.compdf.com/server/v2/process/pdf/markdown');
    expect(seen[0].headers['x-api-key']).toBe('ck');
    expect(seen[0].form?.get('enableOcr')).toBe('1');
    expect(seen[0].form?.get('pageRanges')).toBe('1-15');
    expect((seen[0].form?.get('file') as File).name).toBe('po.pdf');
  });

  it('uses image-to-text for images', async () => {
    const seen: Seen = [];
    const routes = createRoutes(configFromEnv({ ...env, COMPDF_API_KEY: 'ck' }), fakeFetch(seen));
    await call(routes, { ...pdf, fileName: 'card.png', contentType: 'image/png' });
    expect(seen[0].url).toBe('https://api-server.compdf.com/server/v2/process/img/txt');
  });

  it('reports a missing key, bad types, oversize files, auth and quota', async () => {
    const seen: Seen = [];
    expect((await call(createRoutes(configFromEnv(env), fakeFetch(seen)), pdf)).body.error).toBe('compdf_not_configured');
    const routes = createRoutes(configFromEnv({ ...env, COMPDF_API_KEY: 'ck' }), fakeFetch(seen));
    expect((await call(routes, { ...pdf, contentType: 'text/html' })).body.error).toBe('unsupported_document');
    expect((await call(routes, { ...pdf, dataBase64: Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64') })).body.error).toBe('payload_too_large');
    expect((await call(routes, pdf, 'bad')).status).toBe(401);
    const noQuota = createRoutes(configFromEnv({ ...env, COMPDF_API_KEY: 'ck' }), fakeFetch(seen, { quota: 0 }));
    expect((await call(noQuota, pdf)).body.error).toBe('quota_exceeded');
    expect(seen).toHaveLength(0); // nothing reached ComPDF
  });

  it('maps ComPDF failures to readable codes', async () => {
    const seen: Seen = [];
    const failed = createRoutes(configFromEnv({ ...env, COMPDF_API_KEY: 'ck' }), fakeFetch(seen, { compdf: { code: '200', data: { taskId: 't', failureCode: 'E1', failureReason: 'damaged file' } } }));
    expect((await call(failed, pdf)).body.error).toBe('compdf_unreadable');
    const badKey = createRoutes(configFromEnv({ ...env, COMPDF_API_KEY: 'ck' }), fakeFetch(seen, { compdf: { code: '401', msg: 'Invalid API key' } }));
    expect((await call(badKey, pdf)).body.error).toBe('compdf_unauthorized');
  });

  it('treats the real ComPDF key errors as a key problem, and trims the configured key', async () => {
    // Observed against the live API: a wrong key returns 403 with an empty body; no key returns 200 + code 01001.
    const routesFor = (fetchImpl: typeof fetch) => createRoutes(configFromEnv({ ...env, COMPDF_API_KEY: ' ck\n' }), fetchImpl);
    const base = fakeFetch([]);
    const emptyForbidden = (async (input: any, init: any) => String(input).includes('api-server.compdf.com') ? new Response('', { status: 403 }) : base(input, init)) as typeof fetch;
    expect((await call(routesFor(emptyForbidden), pdf)).body.error).toBe('compdf_unauthorized');
    const seen: Seen = [];
    const unknownUser = routesFor(fakeFetch(seen, { compdf: { code: '01001', msg: '未知用户类型！', data: null } }));
    expect((await call(unknownUser, pdf)).body.error).toBe('compdf_unauthorized');
    expect(seen[0].headers['x-api-key']).toBe('ck');
  });
});

// ---------- document agent logic ----------

const TODAY = '2026-11-15';
const amy: Customer = {
  id: 'c1', name: 'Amy Lin', company: 'Acme Co., Ltd.', email: 'amy@acme.com', status: CustomerStatus.PROSPECT,
  lastContact: '2026-11-01', interactions: [], dealValue: 30000, dealCurrency: 'USD', customerPainPoints: ['Manual quoting'], competitors: ['Zoho'],
};
const bob: Customer = { id: 'c2', name: 'Bob Wu', company: '台灣電子股份有限公司', email: 'bob@twe.com.tw', status: CustomerStatus.LEAD, lastContact: '2026-10-01', interactions: [] };

const po: DocumentAnalysis = {
  documentType: 'purchase_order', title: 'PO-2026-118', summary: 'Acme orders 40 licenses for USD 48,000, delivery by 2026-12-01.',
  counterpartyName: 'Amy Lin', counterpartyCompany: 'ACME Co Ltd', counterpartyEmail: 'AMY@acme.com', matchedCustomerId: '',
  amount: 48000, currency: 'usd', suggestedStatus: CustomerStatus.CLOSED_WON,
  nextActionDescription: 'Send contract for signature', nextActionDueDate: '2026-11-18',
  newPainPoints: ['manual quoting', 'Slow approvals'], newCompetitors: ['Zoho', 'HubSpot'], watchItems: ['Net 60 payment terms'],
};

describe('matchCustomer', () => {
  it('prefers an exact email, then the model, then a unique company name', () => {
    expect(matchCustomer(po, [amy, bob])).toEqual({ customerId: 'c1', reason: 'email' });
    expect(matchCustomer({ ...po, counterpartyEmail: '', matchedCustomerId: 'c2' }, [amy, bob])).toEqual({ customerId: 'c2', reason: 'ai' });
    expect(matchCustomer({ ...po, counterpartyEmail: '' }, [amy, bob])).toEqual({ customerId: 'c1', reason: 'company' });
    expect(matchCustomer({ ...po, counterpartyEmail: '', counterpartyCompany: '台灣電子' }, [amy, bob])).toEqual({ customerId: 'c2', reason: 'company' });
  });

  it('ignores ids the model made up and returns null when nothing matches', () => {
    expect(matchCustomer({ ...po, counterpartyEmail: 'x@y.com', counterpartyCompany: 'Other', matchedCustomerId: 'nope' }, [amy, bob])).toBeNull();
  });
});

describe('proposeChanges / applyDocument', () => {
  it('proposes only real changes: new amount, a forward stage move, next action, new items', () => {
    const changes = proposeChanges(amy, po, TODAY);
    expect(changes.map(c => c.key)).toEqual(['dealValue', 'status', 'nextAction', 'painPoints', 'competitors']);
    expect(changes.find(c => c.key === 'dealValue')).toEqual({ key: 'dealValue', from: 'USD 30,000', to: 'USD 48,000' });
    expect(changes.find(c => c.key === 'painPoints')?.to).toBe('Slow approvals');
    expect(changes.find(c => c.key === 'competitors')?.to).toBe('HubSpot');
  });

  it('never moves a deal backwards or to Closed (Lost), and fixes past due dates', () => {
    const won = { ...amy, status: CustomerStatus.NEGOTIATION };
    expect(proposeChanges(won, { ...po, suggestedStatus: CustomerStatus.PROSPECT }, TODAY).some(c => c.key === 'status')).toBe(false);
    expect(proposeChanges(won, { ...po, suggestedStatus: CustomerStatus.CLOSED_LOST }, TODAY).some(c => c.key === 'status')).toBe(false);
    expect(proposeChanges(amy, { ...po, nextActionDueDate: '2020-01-01' }, TODAY).find(c => c.key === 'nextAction')?.to).toContain(TODAY);
  });

  it('applies only the selected changes and always logs the document', () => {
    const log = documentLogText(po, 'po.pdf', 'Purchase order', 'Check');
    expect(log).toBe('Purchase order「PO-2026-118」(po.pdf): Acme orders 40 licenses for USD 48,000, delivery by 2026-12-01.\nCheck: Net 60 payment terms');
    const out = applyDocument(amy, po, ['dealValue', 'status'], log, TODAY);
    expect(out.dealValue).toBe(48000);
    expect(out.dealCurrency).toBe('USD');
    expect(out.status).toBe(CustomerStatus.CLOSED_WON);
    expect(out.statusHistory?.at(-1)).toEqual({ status: CustomerStatus.CLOSED_WON, date: TODAY });
    expect(out.closedReason).toBe('PO-2026-118');
    expect(out.nextAction).toBeUndefined();
    expect(out.customerPainPoints).toEqual(['Manual quoting']);
    expect(out.interactions[0]).toMatchObject({ type: InteractionType.NOTE, date: TODAY, summary: log });
    expect(out.lastContact).toBe(TODAY);
    expect(amy.interactions).toHaveLength(0); // input untouched
  });

  it('builds a new-customer prefill from an unknown sender', () => {
    expect(prefillFromDocument({ ...po, counterpartyEmail: 'new@x.com' }, TODAY)).toMatchObject({
      name: 'Amy Lin', company: 'ACME Co Ltd', email: 'new@x.com', dealValue: 48000, dealCurrency: 'USD',
      nextAction: { description: 'Send contract for signature', dueDate: '2026-11-18' },
    });
  });
});
