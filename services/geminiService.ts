// Schema type names (mirrors @google/genai's Type enum without bundling the SDK in the browser).
const Type = { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY' } as const;
import { Customer, CustomerStatus, InteractionType, NextAction } from '../types';
import { todayISO, addDays } from '../lib/dates';
import { apiFetch, ApiError } from '../lib/api';
import { DOCUMENT_KINDS, DocumentAnalysis } from '../lib/documentAgent';

// All AI calls go through the server-side proxy at /api/ai, which holds the Gemini key.

export type Language = 'en' | 'zh';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export type AIErrorCode = 'rate_limited' | 'quota_exceeded' | 'unauthorized' | 'missing_api_key' | 'network' | 'upstream_error' | 'bad_response';

const KNOWN_CODES: AIErrorCode[] = ['rate_limited', 'quota_exceeded', 'unauthorized', 'missing_api_key', 'network', 'bad_response'];

export class AIError extends Error {
  constructor(public code: AIErrorCode) {
    super(code);
  }
}

const post = async (body: object, signal?: AbortSignal): Promise<Response> => {
  try {
    return await apiFetch('/api/ai', { method: 'POST', body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    const code = (e as ApiError).code as AIErrorCode;
    throw new AIError(KNOWN_CODES.includes(code) ? code : 'upstream_error');
  }
};

const generateText = async (contents: ChatTurn[], systemInstruction: string): Promise<string> => {
  const res = await post({ contents, systemInstruction });
  const data = await res.json();
  return data.text as string;
};

const generateJson = async <T>(prompt: string, systemInstruction: string, responseSchema: object): Promise<T> => {
  const res = await post({ contents: [{ role: 'user', text: prompt }], systemInstruction, responseSchema });
  const data = await res.json();
  try {
    return JSON.parse(data.text) as T;
  } catch {
    throw new AIError('bad_response');
  }
};

/** Streams a response, calling onChunk with the accumulated text. Returns the full text. */
export const streamText = async (
  contents: ChatTurn[],
  systemInstruction: string,
  onChunk: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<string> => {
  const res = await post({ contents, systemInstruction, stream: true }, signal);
  if (!res.body) throw new AIError('bad_response');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onChunk(full);
  }
  full += decoder.decode();
  if (!full.trim()) throw new AIError('upstream_error');
  onChunk(full);
  return full.trim();
};

const languageName = (language: Language) => (language === 'zh' ? 'Traditional Chinese (繁體中文)' : 'English');

export const buildCustomerContext = (customer: Customer): string => {
  const lines = [
    `Name: ${customer.name}`,
    `Company: ${customer.company}`,
    `Email: ${customer.email}`,
    `Current Status: ${customer.status}`,
    `Last Contact: ${customer.lastContact}`,
    customer.dealValue ? `Estimated Deal Value: $${customer.dealValue.toLocaleString()}` : null,
    customer.keyContacts?.length ? `Key Contacts: ${customer.keyContacts.map(c => `${c.name} (${c.title})`).join(', ')}` : null,
    customer.customerPainPoints?.length ? `Pain Points: ${customer.customerPainPoints.join('; ')}` : null,
    customer.competitors?.length ? `Known Competitors: ${customer.competitors.join(', ')}` : null,
    customer.nextAction ? `Next Action: ${customer.nextAction.description} (Due: ${customer.nextAction.dueDate || 'unset'})` : null,
    customer.closedReason ? `Closed Reason: ${customer.closedReason}` : null,
  ].filter(Boolean).map(l => `- ${l}`);
  const history = customer.interactions.slice(0, 30).map(i => `- ${i.date} (${i.type}): ${i.summary}`).join('\n');
  return `**Customer Profile**\n${lines.join('\n')}\n\n**Interaction History (newest first)**\n${history || 'No interactions logged yet.'}`;
};

// Plain-writing rules, adapted from the unslop project's list of AI writing tells.
// They apply to everything the model writes for the user: chat answers, emails,
// summaries, log entries and analyses.
export const WRITING_RULES = `Writing rules (follow them in every language):
- Start with the answer or the content. No opener such as "Great question", "Certainly", "Here is", "好的", "以下是", "當然".
- No closing pleasantries or offers, such as "I hope this helps", "Let me know if you need anything else", "希望對您有幫助", "如有任何問題歡迎隨時告知".
- Do not restate the question or recap what you just said. No moral or slogan at the end.
- No intro paragraph that previews what follows, and no closing paragraph that repeats it ("In summary", "總結來說", "綜上所述").
- Avoid filler and marketing words: delve, leverage, seamless, robust, crucial, pivotal, game-changer, unlock, elevate, 賦能, 助力, 無縫, 全方位, 打造, 至關重要, 不可或缺.
- Do not group things in threes by habit; list as many items as the facts support.
- No "not just X, but Y" or "不只是…更是…" contrast frames.
- Do not use em dashes (—) or the Chinese dash (——). Use a comma, period or colon.
- Use only facts from the profile, history or provided text. Keep names, numbers, amounts and dates exactly as given. If something is unknown, say so instead of guessing.
- Prefer short sentences and concrete details (who, what, when, how much) over adjectives.`;

export const salesSystemInstruction = (customer: Customer, language: Language) =>
  `You are an expert B2B sales assistant helping a sales representative. Today is ${todayISO()}.
Be concise, concrete and actionable. Use Markdown (bold, bullet lists) only when it improves readability.
Your entire response must be in ${languageName(language)}.

${WRITING_RULES}

${buildCustomerContext(customer)}`;

// ---------- Structured tasks ----------

export interface NextStepSuggestion extends NextAction {
  reasoning: string;
}

export const suggestNextStep = async (customer: Customer, language: Language): Promise<NextStepSuggestion> => {
  const result = await generateJson<NextStepSuggestion>(
    'Suggest a single, concrete next step that moves this deal forward, a realistic due date (YYYY-MM-DD, on or after today), and a one or two sentence reasoning.',
    salesSystemInstruction(customer, language),
    {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING },
        dueDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
        reasoning: { type: Type.STRING },
      },
      required: ['description', 'dueDate', 'reasoning'],
    },
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.dueDate) || result.dueDate < todayISO()) {
    result.dueDate = addDays(todayISO(), 3);
  }
  return result;
};

export interface EmailDraft {
  subject: string;
  body: string;
}

export const draftFollowUpEmail = (customer: Customer, language: Language): Promise<EmailDraft> =>
  generateJson<EmailDraft>(
    `Draft a follow-up email to ${customer.name} that moves the deal forward. Refer to something specific from the most recent interaction and propose one clear next step (a date, a document, a call). Write it the way a busy sales rep would: short paragraphs, under 150 words, no flattery, no "I hope this email finds you well" or "希望您一切安好". Subject line: specific, under 60 characters, no exclamation marks. Plain text body (no Markdown), with a greeting and a closing signed "[Your Name]".`,
    salesSystemInstruction(customer, language),
    {
      type: Type.OBJECT,
      properties: { subject: { type: Type.STRING }, body: { type: Type.STRING } },
      required: ['subject', 'body'],
    },
  );

export const MEETING_BRIEF_PROMPT = `Generate a pre-meeting briefing that can be scanned in 5 minutes, with these Markdown sections:
1. **Customer Snapshot** 2. **Interaction Summary** 3. **Current Situation** (pain points, competitors, next action) 4. **Suggested Agenda & Questions**`;

export const SUMMARY_PROMPT = 'Summarize where the relationship stands in 2-3 sentences: the latest development, what the customer cares about, and how warm the deal is. Then name the main opportunity and the main risk, one line each. State conclusions, do not walk through the history again.';

// Short proactive summaries are cached per customer state to save API calls.
const summaryCache = new Map<string, string>();
const summaryKey = (c: Customer, language: Language) =>
  `${c.id}|${language}|${c.status}|${c.lastContact}|${c.interactions.length}|${c.nextAction?.description ?? ''}`;

export const getCachedProactiveSummary = (customer: Customer, language: Language) =>
  summaryCache.get(summaryKey(customer, language));

export const getProactiveSummary = async (customer: Customer, language: Language): Promise<string> => {
  const key = summaryKey(customer, language);
  const cached = summaryCache.get(key);
  if (cached) return cached;
  const text = await generateText(
    [{ role: 'user', text: 'In ONE short sentence (max 30 words), tell me what to do with this customer today and why. No preamble.' }],
    salesSystemInstruction(customer, language),
  );
  summaryCache.set(key, text);
  return text;
};

// ---------- Data capture ----------

export interface ExtractedCustomer {
  name: string;
  company: string;
  email: string;
  dealValue?: number;
  keyContacts?: { name: string; title: string }[];
  customerPainPoints?: string[];
  competitors?: string[];
  nextActionDescription?: string;
  nextActionDueDate?: string;
  interactionSummary?: string;
}

export const extractCustomerFromText = (text: string, language: Language): Promise<ExtractedCustomer> =>
  generateJson<ExtractedCustomer>(
    `Extract CRM customer data from the following text (an email, business card, signature or notes). Use empty strings for unknown required fields. Do not invent data. Today is ${todayISO()}.

---
${text}
---`,
    `You extract structured data for a CRM. Free-text fields (pain points, next action, summary) must be written in ${languageName(language)}; keep names, company and email as written. Write free-text fields as short, plain notes: no adjectives the source does not support, no em dashes.`,
    {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        company: { type: Type.STRING },
        email: { type: Type.STRING },
        dealValue: { type: Type.NUMBER },
        keyContacts: {
          type: Type.ARRAY,
          items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, title: { type: Type.STRING } }, required: ['name', 'title'] },
        },
        customerPainPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        competitors: { type: Type.ARRAY, items: { type: Type.STRING } },
        nextActionDescription: { type: Type.STRING },
        nextActionDueDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
        interactionSummary: { type: Type.STRING, description: 'One-sentence summary of the text as an interaction note' },
      },
      required: ['name', 'company', 'email'],
    },
  );

export interface OrganizedNotes {
  type: InteractionType;
  summary: string;
  nextActionDescription?: string;
  nextActionDueDate?: string;
  newPainPoints?: string[];
  newCompetitors?: string[];
}

export const organizeMeetingNotes = async (customer: Customer, notes: string, language: Language): Promise<OrganizedNotes> => {
  const result = await generateJson<OrganizedNotes>(
    `Turn these rough notes from my latest interaction into a clean interaction log entry. Also suggest the next action (with a due date on or after today) if one is implied, and list any NEW pain points or competitors not already in the profile.

Notes:
${notes}`,
    salesSystemInstruction(customer, language),
    {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: Object.values(InteractionType) },
        summary: { type: Type.STRING },
        nextActionDescription: { type: Type.STRING },
        nextActionDueDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
        newPainPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        newCompetitors: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['type', 'summary'],
    },
  );
  if (!Object.values(InteractionType).includes(result.type)) result.type = InteractionType.NOTE;
  return result;
};

// ---------- Analytics ----------

// Output shape for the closed-deal analysis. It is shown inside a small dashboard panel,
// so the structure rules matter as much as the wording rules.
export const ANALYSIS_PROMPT = `Find the recurring patterns behind these wins and losses.
Format (Markdown):
- First line: the single most useful finding, as a plain sentence. No heading above it.
- Then a short bullet list of patterns. Each bullet states the pattern and names the deals it comes from in parentheses. Do not start bullets with a bold label and a colon (no "**Price:** ...").
- Then up to 3 recommendations as bullets, each starting with a verb and tied to a pattern above.
- No closing summary.
If there are fewer than 3 closed deals, or no pattern repeats, say that in one sentence and stop. Do not invent patterns from a single deal. Keep it under 150 words.`;

export const analyzeClosedDeals = (customers: Customer[], language: Language): Promise<string> => {
  const closed = customers
    .filter(c => c.status === CustomerStatus.CLOSED_WON || c.status === CustomerStatus.CLOSED_LOST)
    .map(c => `- ${c.status} | ${c.company} | $${c.dealValue ?? 0} | reason: ${c.closedReason || 'n/a'} | competitors: ${c.competitors?.join(', ') || 'n/a'}`)
    .join('\n');
  return generateText(
    [{ role: 'user', text: `Closed deals:\n${closed || 'none'}\n\n${ANALYSIS_PROMPT}` }],
    `You are a sales operations analyst. Use Markdown. Respond in ${languageName(language)}.\n\n${WRITING_RULES}`,
  );
};

// ---------- Document agent ----------

const MAX_PROMPT_DOC_CHARS = 16000;

export const DOCUMENT_AGENT_INSTRUCTION = (language: Language) => `You are a document agent inside a sales CRM. A sales rep uploaded a business document (quote request, quote, purchase order, contract, invoice or similar). ComPDF has already converted it to text. Today is ${todayISO()}.
Your job:
1. Classify the document and give it a short title.
2. Identify the counterparty (the customer side, not the rep's own company) and match it to one customer from the list by id. Leave matchedCustomerId empty if no customer clearly matches; do not guess.
3. Pull out the deal amount (number only, no currency symbol) and its ISO currency code if the document states one, and the dates that matter (deadlines, validity, delivery, payment).
4. Say what the document means for the deal: suggestedStatus only when the document is clear evidence (a quote request means at least "Prospect", a quote or draft contract under discussion means "Negotiation", "Closed (Won)" only when the document shows it is already signed or accepted by the customer, such as signatures, a company stamp or an acceptance statement. A purchase order or contract that still needs signatures means "Negotiation", and signing it should be the next action); otherwise omit it.
5. Propose one next action with a due date, and list terms the rep should check (payment terms, penalties, auto-renewal, liability, exclusivity), each in a few words.
Write title, summary, next action and watch items in ${languageName(language)}. Copy names, amounts and dates exactly as written in the document.

${WRITING_RULES}`;

export const analyzeDocument = (
  text: string,
  fileName: string,
  customers: Customer[],
  language: Language,
): Promise<DocumentAnalysis> => {
  const list = customers.slice(0, 200)
    .map(c => `${c.id} | ${c.name} | ${c.company} | ${c.email || '-'} | ${c.status}${c.dealValue ? ` | ${c.dealCurrency || 'USD'} ${c.dealValue}` : ''}`)
    .join('\n');
  const body = text.length > MAX_PROMPT_DOC_CHARS ? `${text.slice(0, MAX_PROMPT_DOC_CHARS)}\n[... document truncated ...]` : text;
  return generateJson<DocumentAnalysis>(
    `Customers (id | name | company | email | stage | deal):\n${list || '(none yet)'}\n\nDocument "${fileName}":\n---\n${body}\n---`,
    DOCUMENT_AGENT_INSTRUCTION(language),
    {
      type: Type.OBJECT,
      properties: {
        documentType: { type: Type.STRING, enum: [...DOCUMENT_KINDS] },
        title: { type: Type.STRING },
        summary: { type: Type.STRING, description: 'One or two sentences: what the document asks for or commits to' },
        counterpartyName: { type: Type.STRING },
        counterpartyCompany: { type: Type.STRING },
        counterpartyEmail: { type: Type.STRING },
        matchedCustomerId: { type: Type.STRING },
        amount: { type: Type.NUMBER },
        currency: { type: Type.STRING, description: 'ISO 4217 code, e.g. USD, TWD' },
        keyDates: {
          type: Type.ARRAY,
          items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, date: { type: Type.STRING, description: 'YYYY-MM-DD' } }, required: ['label', 'date'] },
        },
        // Optional: omitted when the document is not clear evidence. Gemini rejects empty strings in an enum.
        suggestedStatus: { type: Type.STRING, enum: [CustomerStatus.LEAD, CustomerStatus.PROSPECT, CustomerStatus.NEGOTIATION, CustomerStatus.CLOSED_WON] },
        nextActionDescription: { type: Type.STRING },
        nextActionDueDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
        newPainPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        newCompetitors: { type: Type.ARRAY, items: { type: Type.STRING } },
        watchItems: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['documentType', 'title', 'summary', 'counterpartyName', 'counterpartyCompany', 'counterpartyEmail', 'matchedCustomerId'],
    },
  ).then(a => ({ ...a, documentType: DOCUMENT_KINDS.includes(a.documentType) ? a.documentType : 'other' }));
};
