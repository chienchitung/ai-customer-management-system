// Schema type names (mirrors @google/genai's Type enum without bundling the SDK in the browser).
const Type = { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY' } as const;
import { Customer, CustomerStatus, InteractionType, NextAction } from '../types';
import { todayISO, addDays } from '../lib/dates';

// All AI calls go through the server-side proxy at /api/ai, which holds the Gemini key.

export type Language = 'en' | 'zh';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export type AIErrorCode = 'rate_limited' | 'missing_api_key' | 'network' | 'upstream_error' | 'bad_response';

export class AIError extends Error {
  constructor(public code: AIErrorCode) {
    super(code);
  }
}

const ENDPOINT = '/api/ai';

const post = async (body: object, signal?: AbortSignal): Promise<Response> => {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new AIError('network');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const code = (data.error as AIErrorCode) || 'upstream_error';
    throw new AIError(['rate_limited', 'missing_api_key'].includes(code) ? code : 'upstream_error');
  }
  return res;
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

export const salesSystemInstruction = (customer: Customer, language: Language) =>
  `You are an expert B2B sales assistant helping a sales representative. Today is ${todayISO()}.
Be concise, concrete and actionable. Use Markdown (bold, bullet lists) when it improves readability.
Your entire response must be in ${languageName(language)}.

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
    `Draft a personalized, professional and friendly follow-up email to ${customer.name} that moves the deal forward, based on the most recent interaction and the profile. Plain text body (no Markdown), with greeting and a closing signed "[Your Name]".`,
    salesSystemInstruction(customer, language),
    {
      type: Type.OBJECT,
      properties: { subject: { type: Type.STRING }, body: { type: Type.STRING } },
      required: ['subject', 'body'],
    },
  );

export const MEETING_BRIEF_PROMPT = `Generate a pre-meeting briefing that can be scanned in 5 minutes, with these Markdown sections:
1. **Customer Snapshot** 2. **Interaction Summary** 3. **Current Situation** (pain points, competitors, next action) 4. **Suggested Agenda & Questions**`;

export const SUMMARY_PROMPT = 'Summarize the key points and overall sentiment of the relationship in 2-3 sentences, then list the main opportunity and the main risk.';

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
    `You extract structured data for a CRM. Free-text fields (pain points, next action, summary) must be written in ${languageName(language)}; keep names, company and email as written.`,
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

export const analyzeClosedDeals = (customers: Customer[], language: Language): Promise<string> => {
  const closed = customers
    .filter(c => c.status === CustomerStatus.CLOSED_WON || c.status === CustomerStatus.CLOSED_LOST)
    .map(c => `- ${c.status} | ${c.company} | $${c.dealValue ?? 0} | reason: ${c.closedReason || 'n/a'} | competitors: ${c.competitors?.join(', ') || 'n/a'}`)
    .join('\n');
  return generateText(
    [{ role: 'user', text: `Closed deals:\n${closed || 'none'}\n\nIdentify the recurring patterns behind wins and losses, and give 3 concrete recommendations for the sales team. Keep it under 150 words.` }],
    `You are a sales operations analyst. Use Markdown. Respond in ${languageName(language)}.`,
  );
};
