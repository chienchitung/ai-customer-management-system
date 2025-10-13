import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Customer, AISuggestionType } from '../types';
import { getChatResponse } from '../services/geminiService';
import { ChatbotIcon, UserIcon, SendIcon } from './icons';
import { t } from '../localization';

interface AIAssistantProps {
  customer: Customer;
  language: 'en' | 'zh';
}

// Represents a single message in the chat conversation.
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

// A component to render the AI's response with a typewriter effect.
const TypewriterMessage: React.FC<{ text: string; scrollRef: React.RefObject<HTMLDivElement> }> = ({ text, scrollRef }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText(''); // Reset when a new message comes in
    if (text) {
      let i = 0;
      const intervalId = setInterval(() => {
        if (i < text.length) {
          setDisplayedText(prev => prev + text.charAt(i));
          i++;
        } else {
          clearInterval(intervalId);
        }
      }, 15); // Typing speed

      return () => clearInterval(intervalId);
    }
  }, [text]);

  // Scroll to the bottom as new text is being typed
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedText, scrollRef]);

  return <MarkdownRenderer content={displayedText} />;
};


const AIAssistant: React.FC<AIAssistantProps> = ({ customer, language }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When the customer changes, reset the conversation with a welcome message.
  useEffect(() => {
    const welcomeMessage = language === 'zh'
      ? `您好！我是您的 AI 助理，隨時準備協助您處理與 ${customer.name} 的事務。您可以直接提問，或使用下方的快速按鈕。`
      : `Hello! I'm your AI assistant, ready to help with ${customer.name}. Feel free to ask any questions or use the quick actions below.`;

    setMessages([{
        id: `ai_${Date.now()}`,
        role: 'model',
        text: welcomeMessage,
    }]);
  }, [customer, language]);

  // Auto-grow textarea height based on content.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height to allow shrinking
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // Max height in pixels
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const newUserMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: messageText,
    };
    
    // Add user message and a temporary loading message for the AI
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
        const responseText = await getChatResponse(customer, messages, messageText, language);
        const newAiMessage: ChatMessage = {
            id: `ai_${Date.now()}`,
            role: 'model',
            text: responseText,
        };
        setMessages(prev => [...prev, newAiMessage]);
    } catch (error) {
        console.error("Failed to get chat response:", error);
        const errorAiMessage: ChatMessage = {
            id: `ai_${Date.now()}`,
            role: 'model',
            text: "Sorry, I encountered an error. Please try again.",
        };
        setMessages(prev => [...prev, errorAiMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
    setInput('');
  };

  // Automatically scroll to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const actionButtons = Object.values(AISuggestionType);

  return (
    <div className="bg-surface rounded-lg border border-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border flex-shrink-0">
        <div className="bg-primary/10 p-2 rounded-full">
            <ChatbotIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
            <h3 className="text-xl font-bold text-text-primary">{t('aiAssistant', language)}</h3>
            <p className="text-sm text-text-secondary">{t('aiAssistantDescription', language)}</p>
        </div>
      </div>
      
      {/* Conversation History */}
      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1;
          const useTypewriter = msg.role === 'model' && isLastMessage && !isLoading && messages.length > 1;

          return (
            <div key={msg.id} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <ChatbotIcon className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className={`px-4 py-3 rounded-2xl max-w-[85%] ${msg.role === 'user' ? 'bg-primary text-white rounded-br-lg' : 'bg-secondary text-text-primary rounded-bl-lg'}`}>
                 {useTypewriter ? (
                  <TypewriterMessage text={msg.text} scrollRef={messagesEndRef} />
                ) : (
                  <MarkdownRenderer content={msg.text} />
                )}
              </div>
               {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                </div>
             )}
            </div>
          )
        })}
        {isLoading && (
            <div className="flex items-end gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <ChatbotIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-secondary flex items-center justify-center space-x-1.5 h-[44px] rounded-bl-lg">
                    <div className="loading-dots flex items-center justify-center space-x-1 p-2">
                        <div className="w-2 h-2 bg-text-secondary rounded-full dot-1"></div>
                        <div className="w-2 h-2 bg-text-secondary rounded-full dot-2"></div>
                        <div className="w-2 h-2 bg-text-secondary rounded-full"></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Action Buttons & Input Form */}
      <div className="p-4 bg-surface border-t border-border flex-shrink-0">
         <div className="grid grid-cols-2 gap-2 mb-3">
            {actionButtons.map(type => (
                <button
                    key={type}
                    onClick={() => handleSendMessage(t(`aiSuggestions.${type}`, language))}
                    disabled={isLoading}
                    className="p-2 text-sm text-center font-medium bg-secondary rounded-md hover:bg-border dark:hover:bg-slate-600 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                    {t(`aiSuggestions.${type}`, language)}
                </button>
            ))}
         </div>
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                }
            }}
            placeholder={t('askAQuestion', language)}
            className="w-full px-4 py-2.5 bg-secondary border border-transparent focus:border-primary rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-text-primary resize-none transition-colors"
            rows={1}
            style={{ minHeight: '44px' }}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="w-11 h-11 flex-shrink-0 bg-primary text-white rounded-full flex items-center justify-center disabled:bg-primary/50 disabled:cursor-not-allowed transition-colors active:scale-95">
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

// A simple component to render markdown-like text (bold and lists).
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const lines = content.split('\n');
    return (
        <div className="text-sm space-y-2 whitespace-pre-wrap">
            {lines.map((line, index) => {
                if (line.startsWith('* ') || line.startsWith('- ')) {
                    return <p key={index} className="pl-4 relative"><span className="absolute left-0 top-0.5">•</span>{line.substring(2)}</p>;
                }
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                    <p key={index}>
                        {parts.map((part, i) =>
                            part.startsWith('**') && part.endsWith('**') ? (
                                <strong key={i}>{part.slice(2, -2)}</strong>
                            ) : (
                                part
                            )
                        )}
                    </p>
                );
            })}
        </div>
    );
};

export default AIAssistant;