import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Customer, AISuggestionType, Interaction, InteractionType, NextAction } from '../types';
import {
  streamText, salesSystemInstruction, suggestNextStep, draftFollowUpEmail,
  MEETING_BRIEF_PROMPT, SUMMARY_PROMPT, ChatTurn, NextStepSuggestion, EmailDraft,
} from '../services/geminiService';
import { ChatbotIcon, SendIcon, ClipboardIcon, CheckIcon, CalendarIcon } from './icons';
import { t } from '../localization';
import { todayISO } from '../lib/dates';
import { aiErrorMessage } from './Dialogs';
import { useGmail } from '../hooks/useGmail';
import { SendEmailModal } from './Gmail';
import { useToast } from './Toast';

type Language = 'en' | 'zh';

interface AIAssistantProps {
  customer: Customer;
  language: Language;
  onAddInteraction: (customerId: string, interaction: Omit<Interaction, 'id'>) => void;
  onSetNextAction: (customerId: string, action: NextAction) => void;
}

// A message in the conversation. Structured results carry data so they can be turned into actions.
export type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'model'; kind: 'text'; text: string; streaming?: boolean; welcome?: boolean }
  | { id: string; role: 'model'; kind: 'nextStep'; data: NextStepSuggestion; applied?: boolean }
  | { id: string; role: 'model'; kind: 'email'; data: EmailDraft; logged?: boolean }
  | { id: string; role: 'model'; kind: 'error'; text: string; retry: () => void };

const newId = () => `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/** Only plain text turns are sent back to the model as conversation history. */
const toHistory = (messages: ChatMessage[]): ChatTurn[] =>
  messages.flatMap((m): ChatTurn[] => {
    if (m.role === 'user') return [{ role: 'user' as const, text: m.text }];
    if (m.kind === 'text' && !m.welcome && m.text) return [{ role: 'model' as const, text: m.text }];
    if (m.kind === 'nextStep') return [{ role: 'model' as const, text: `${m.data.description} (${m.data.dueDate}). ${m.data.reasoning}` }];
    if (m.kind === 'email') return [{ role: 'model' as const, text: `Subject: ${m.data.subject}\n\n${m.data.body}` }];
    return [];
  });

const CopyButton: React.FC<{ text: string; language: Language }> = ({ text, language }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked */ }
      }}
      className="btn btn-sm btn-ghost"
    >
      {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
      {t(copied ? 'ai.copied' : 'ai.copy', language)}
    </button>
  );
};

const actionBtn = 'btn btn-sm';

const AIAssistant: React.FC<AIAssistantProps> = ({ customer, language, onAddInteraction, onSetNextAction }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [savedNotes, setSavedNotes] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Latest customer data for requests, without resetting the chat when it changes.
  const gmail = useGmail();
  const toast = useToast();
  const [sendDraft, setSendDraft] = useState<{ messageId: string; to: string; subject: string; body: string } | null>(null);
  const customerRef = useRef(customer);
  customerRef.current = customer;

  // Reset the conversation only when switching to a different customer or language.
  useEffect(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setSavedNotes(new Set());
    const welcome = language === 'zh'
      ? `您好！我是您的 AI 助理，隨時準備協助您處理與 ${customer.name} 的事務。您可以直接提問，或使用下方的快速按鈕。`
      : `Hello! I'm your AI assistant, ready to help with ${customer.name}. Ask a question or use the quick actions below.`;
    setMessages([{ id: newId(), role: 'model', kind: 'text', text: welcome, welcome: true }]);
    return () => abortRef.current?.abort();
  }, [customer.id, language]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const replaceMessage = (id: string, msg: ChatMessage) => setMessages(prev => prev.map(m => (m.id === id ? msg : m)));
  const patchMessage = (id: string, patch: Partial<ChatMessage>) =>
    setMessages(prev => prev.map(m => (m.id === id ? ({ ...m, ...patch } as ChatMessage) : m)));

  /** Runs one assistant turn. `run` receives the placeholder id and fills it in. */
  const runTurn = async (label: string, run: (placeholderId: string, history: ChatTurn[], signal: AbortSignal) => Promise<void>) => {
    if (isLoading) return;
    const userMsg: ChatMessage = { id: newId(), role: 'user', text: label };
    const placeholderId = newId();
    const history = toHistory([...messages, userMsg]);
    setMessages(prev => [...prev, userMsg, { id: placeholderId, role: 'model', kind: 'text', text: '', streaming: true }]);
    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await run(placeholderId, history, controller.signal);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setMessages(prev => prev.flatMap(m => (m.id === placeholderId ? (m.role === 'model' && m.kind === 'text' && m.text ? [{ ...m, streaming: false }] : []) : [m])));
      } else {
        replaceMessage(placeholderId, {
          id: placeholderId, role: 'model', kind: 'error', text: aiErrorMessage(error, language),
          retry: () => {
            setMessages(prev => prev.filter(m => m.id !== placeholderId && m.id !== userMsg.id));
            setTimeout(() => runTurn(label, run), 0);
          },
        });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  };

  const streamInto = (prompt?: string) => async (id: string, history: ChatTurn[], signal: AbortSignal) => {
    const contents = prompt ? [...history.slice(0, -1), { role: 'user' as const, text: prompt }] : history;
    await streamText(contents, salesSystemInstruction(customerRef.current, language), text => {
      patchMessage(id, { text } as Partial<ChatMessage>);
    }, signal);
    patchMessage(id, { streaming: false } as Partial<ChatMessage>);
  };

  const handleQuickAction = (type: AISuggestionType) => {
    const label = t(`aiSuggestions.${type}`, language);
    switch (type) {
      case AISuggestionType.NEXT_STEP:
        return runTurn(label, async id => {
          const data = await suggestNextStep(customerRef.current, language);
          replaceMessage(id, { id, role: 'model', kind: 'nextStep', data });
        });
      case AISuggestionType.DRAFT_EMAIL:
        return runTurn(label, async id => {
          const data = await draftFollowUpEmail(customerRef.current, language);
          replaceMessage(id, { id, role: 'model', kind: 'email', data });
        });
      case AISuggestionType.SUMMARY:
        return runTurn(label, streamInto(SUMMARY_PROMPT));
      case AISuggestionType.MEETING_BRIEF:
        return runTurn(label, streamInto(MEETING_BRIEF_PROMPT));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    runTurn(input.trim(), streamInto());
    setInput('');
  };

  const saveAsNote = (id: string, text: string) => {
    onAddInteraction(customer.id, { type: InteractionType.NOTE, date: todayISO(), summary: text.replace(/\*\*/g, '') });
    setSavedNotes(prev => new Set(prev).add(id));
  };

  const renderModel = (m: Exclude<ChatMessage, { role: 'user' }>) => {
    switch (m.kind) {
      case 'text':
        return (
          <>
            {m.text ? <MarkdownRenderer content={m.text} /> : <LoadingDots />}
            {!m.welcome && !m.streaming && m.text && (
              <div className="flex gap-1 mt-2 -ml-2 text-text-secondary">
                <CopyButton text={m.text} language={language} />
                <button disabled={savedNotes.has(m.id)} onClick={() => saveAsNote(m.id, m.text)} className={`${actionBtn} btn-ghost`}>
                  {t(savedNotes.has(m.id) ? 'ai.saved' : 'ai.saveNote', language)}
                </button>
              </div>
            )}
          </>
        );
      case 'nextStep':
        return (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{t('ai.nextStepTitle', language)}</p>
            <p>{m.data.description}</p>
            <p className="flex items-center gap-1 text-text-secondary"><CalendarIcon className="w-4 h-4" />{t('ai.due', language)}: {m.data.dueDate}</p>
            <p className="text-text-secondary">{m.data.reasoning}</p>
            <button
              disabled={m.applied}
              onClick={() => { onSetNextAction(customer.id, { description: m.data.description, dueDate: m.data.dueDate }); patchMessage(m.id, { applied: true } as Partial<ChatMessage>); }}
              className={`${actionBtn} btn-primary`}
            >
              {m.applied && <CheckIcon className="w-3.5 h-3.5" />}{t(m.applied ? 'ai.saved' : 'ai.setNext', language)}
            </button>
          </div>
        );
      case 'email': {
        const full = `${m.data.subject}\n\n${m.data.body}`;
        const mailto = `mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent(m.data.subject)}&body=${encodeURIComponent(m.data.body)}`;
        return (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{t('ai.emailTitle', language)}</p>
            <p><span className="text-text-secondary">{t('ai.subject', language)}:</span> {m.data.subject}</p>
            <p className="whitespace-pre-wrap bg-surface/60 rounded-md p-2 border border-border">{m.data.body}</p>
            <div className="flex flex-wrap gap-1 -ml-2 text-text-secondary">
              <CopyButton text={full} language={language} />
{gmail.status.connected ? (
                <button
                  disabled={m.logged}
                  onClick={() => setSendDraft({ messageId: m.id, to: customer.email, subject: m.data.subject, body: m.data.body })}
                  className={`${actionBtn} btn-primary`}
                >
                  {m.logged && <CheckIcon className="w-3.5 h-3.5" />}{t(m.logged ? 'ai.saved' : 'gmail.send', language)}
                </button>
              ) : (
              <a
                href={mailto}
                onClick={() => {
                  if (m.logged) return;
                  onAddInteraction(customer.id, { type: InteractionType.EMAIL, date: todayISO(), summary: `${t('gmail.sentPrefix', language)}${m.data.subject}` });
                  patchMessage(m.id, { logged: true } as Partial<ChatMessage>);
                }}
                className={`${actionBtn} btn-primary`}
              >
                {m.logged && <CheckIcon className="w-3.5 h-3.5" />}{t('ai.openEmail', language)}
              </a>
              )}
            </div>
          </div>
        );
      }
      case 'error':
        return (
          <div role="alert" className="text-sm space-y-2">
            <p className="text-rose-600 dark:text-rose-400">{m.text}</p>
            <button onClick={m.retry} disabled={isLoading} className={`${actionBtn} btn-primary`}>{t('ai.retry', language)}</button>
          </div>
        );
    }
  };

  return (
    <div className="bg-surface flex flex-col h-full">
      <div className="flex items-center gap-3 h-14 px-4 border-b border-border flex-shrink-0">
        <div className="bg-primary/10 p-1.5 rounded-md">
          <ChatbotIcon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{t('aiAssistant', language)}</h3>
          <p className="text-xs text-text-secondary truncate">{customer.name} · {customer.company}</p>
        </div>
      </div>

      <div className="flex-grow p-4 space-y-3 overflow-y-auto" aria-live="polite">
        {messages.map(msg => (
          <div key={msg.id} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ChatbotIcon className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div className={`px-3 py-2 rounded-lg max-w-[88%] min-w-0 break-words ${msg.role === 'user' ? 'bg-primary text-on-primary' : 'bg-secondary text-text-primary'}`}>
              {msg.role === 'user' ? <p className="text-sm whitespace-pre-wrap">{msg.text}</p> : renderModel(msg)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-surface border-t border-border flex-shrink-0">
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {Object.values(AISuggestionType).map(type => (
            <button
              key={type}
              onClick={() => handleQuickAction(type)}
              disabled={isLoading}
              className="btn btn-sm btn-secondary justify-start"
            >
              {t(`aiSuggestions.${type}`, language)}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={t('askAQuestion', language)}
            aria-label={t('askAQuestion', language)}
            className="input resize-none py-2"
            rows={1}
            style={{ minHeight: '36px' }}
          />
          {isLoading ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="btn btn-secondary flex-shrink-0">
              {t('ai.stop', language)}
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} aria-label="Send" className="btn btn-primary btn-icon h-9 w-9 flex-shrink-0">
              <SendIcon className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
      <SendEmailModal
        draft={sendDraft}
        language={language}
        onClose={() => setSendDraft(null)}
        onSent={({ id, subject }) => {
          if (!sendDraft) return;
          onAddInteraction(customer.id, { type: InteractionType.EMAIL, date: todayISO(), summary: `${t('gmail.sentPrefix', language)}${subject}`, source: 'gmail', externalId: id });
          patchMessage(sendDraft.messageId, { logged: true } as Partial<ChatMessage>);
          setSendDraft(null);
          toast(t('gmail.sentToast', language));
        }}
      />
    </div>
  );
};

const LoadingDots = () => (
  <div className="loading-dots flex items-center space-x-1 py-1">
    <div className="w-2 h-2 bg-text-secondary rounded-full dot-1"></div>
    <div className="w-2 h-2 bg-text-secondary rounded-full dot-2"></div>
    <div className="w-2 h-2 bg-text-secondary rounded-full"></div>
  </div>
);

// Minimal Markdown renderer: headings, bullet / numbered lists and bold.
const renderInline = (text: string) =>
  text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => (
  <div className="text-sm space-y-1.5">
    {content.split('\n').map((line, index) => {
      const heading = line.match(/^#{1,6}\s+(.*)/);
      if (heading) return <p key={index} className="font-bold mt-2">{renderInline(heading[1])}</p>;
      const bullet = line.match(/^\s*[*-]\s+(.*)/);
      if (bullet) return <p key={index} className="pl-4 relative"><span className="absolute left-0">•</span>{renderInline(bullet[1])}</p>;
      const numbered = line.match(/^\s*(\d+)\.\s+(.*)/);
      if (numbered) return <p key={index} className="pl-5 relative"><span className="absolute left-0">{numbered[1]}.</span>{renderInline(numbered[2])}</p>;
      if (!line.trim()) return <div key={index} className="h-1" />;
      return <p key={index}>{renderInline(line)}</p>;
    })}
  </div>
);

export default AIAssistant;
