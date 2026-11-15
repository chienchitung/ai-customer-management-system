import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Customer, CustomerStatus } from '../types';

const calls: { systemInstruction: string; contents: { text: string }[] }[] = [];
vi.mock('../lib/api', () => ({
  ApiError: class extends Error {},
  apiFetch: vi.fn(async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ text: '{"subject":"s","body":"b"}' }), { status: 200 });
  }),
}));

const { WRITING_RULES, salesSystemInstruction, draftFollowUpEmail, analyzeClosedDeals } = await import('../services/geminiService');

const customer: Customer = {
  id: '1', name: 'Eleanor Vance', company: 'Innovate Corp', email: 'e@x.com',
  status: CustomerStatus.PROSPECT, lastContact: '2026-11-10', interactions: [], dealValue: 75000,
};

beforeEach(() => { calls.length = 0; });

describe('AI writing rules', () => {
  it('ban the common slop patterns in both languages', () => {
    for (const s of ['I hope this helps', '希望對您有幫助', 'em dashes', '不只是…更是…', 'delve', '賦能', 'exactly as given']) {
      expect(WRITING_RULES).toContain(s);
    }
  });

  it('are part of the sales system instruction, with the reply language and the customer profile', () => {
    const si = salesSystemInstruction(customer, 'zh');
    expect(si).toContain(WRITING_RULES);
    expect(si).toContain('Traditional Chinese');
    expect(si).toContain('Eleanor Vance');
    expect(si).toContain('75,000');
  });

  it('are sent with email drafts, and the email prompt asks for a specific, short message', async () => {
    await draftFollowUpEmail(customer, 'en');
    expect(calls).toHaveLength(1);
    expect(calls[0].systemInstruction).toContain(WRITING_RULES);
    expect(calls[0].contents[0].text).toMatch(/under 150 words/);
    expect(calls[0].contents[0].text).not.toMatch(/professional and friendly/);
  });

  it('are sent with the closed-deal analysis', async () => {
    await analyzeClosedDeals([{ ...customer, status: CustomerStatus.CLOSED_WON }], 'en');
    expect(calls[0].systemInstruction).toContain(WRITING_RULES);
  });
});
