import React, { useState, useEffect, useRef } from 'react';
import { Customer, AISuggestionType } from '../types';
import { 
    getFollowUpSuggestion, 
    summarizeInteractions, 
    draftFollowUpEmail, 
    generateMeetingBriefing, 
} from '../services/geminiService';
import { ChatbotIcon, UserIcon, ClipboardIcon, CheckIcon } from './icons';
import { t } from '../localization';

interface AIAssistantProps {
  customer: Customer;
  language: 'en' | 'zh';
}

// Represents a single message in the chat conversation.
type Message = {
    id: string;
    sender: 'user' | 'ai';
    content: string; // The main text content of the message.
    actionType?: AISuggestionType; // The type of AI action that generated this message.
};

// Custom hook to handle the "Copy to Clipboard" functionality.
const useCopyToClipboard = (language: 'en' | 'zh') => {
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    const handleCopy = (text: string, messageId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
    };

    return { copiedMessageId, handleCopy };
};

const AIAssistant: React.FC<AIAssistantProps> = ({ customer, language }) => {
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { copiedMessageId, handleCopy } = useCopyToClipboard(language);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll to the latest message.
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);
  
  // When the customer changes, reset the conversation with a dynamic, conversational welcome message.
  useEffect(() => {
    const welcomeMessage = language === 'zh'
      ? `您好！我是您的 AI 助理，隨時準備協助您處理與 ${customer.name} 的事務。需要準備會議、草擬郵件，或找出最佳的下一步嗎？只要從下方選擇一個選項，我就會馬上處理。`
      : `Hello! I'm your AI assistant, ready to help you with ${customer.name}. Need to prep for a meeting, draft an email, or figure out the next best step? Just pick an option below and I'll get right on it.`;

    setConversation([{
        id: `ai_${Date.now()}`,
        sender: 'ai',
        content: welcomeMessage,
    }]);
  }, [customer, language]);

  const handleActionClick = async (actionType: AISuggestionType) => {
    setIsLoading(true);
    
    // Add user's action and a loading state for the AI response to the conversation.
    const userMessageId = `user_${Date.now()}`;
    const aiMessageId = `ai_${Date.now() + 1}`;
    const actionText = t(`aiSuggestions.${actionType}`, language);

    setConversation(prev => [
        ...prev,
        { id: userMessageId, sender: 'user', content: actionText },
        { id: aiMessageId, sender: 'ai', content: '...' }
    ]);

    try {
        let result = '';
        const aiFunctions = {
            [AISuggestionType.NEXT_STEP]: getFollowUpSuggestion,
            [AISuggestionType.SUMMARY]: summarizeInteractions,
            [AISuggestionType.DRAFT_EMAIL]: draftFollowUpEmail,
            [AISuggestionType.MEETING_BRIEF]: generateMeetingBriefing,
        };
        result = await aiFunctions[actionType](customer, language);

        // Update the AI's message with the actual result.
        setConversation(prev => prev.map(msg => 
            msg.id === aiMessageId ? { ...msg, content: result, actionType } : msg
        ));
    } catch (error) {
        console.error('Error getting AI suggestion:', error);
        setConversation(prev => prev.map(msg => 
            msg.id === aiMessageId ? { ...msg, content: 'An error occurred. Please try again.' } : msg
        ));
    } finally {
        setIsLoading(false);
    }
  };
  
  const actionButtons = Object.values(AISuggestionType);

  return (
    <div className="bg-surface p-4 rounded-lg border border-border sticky top-24 flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 flex-shrink-0">
        <div className="bg-primary/10 p-2 rounded-full">
            <ChatbotIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
            <h3 className="text-xl font-bold text-text-primary">{t('aiAssistant', language)}</h3>
            <p className="text-sm text-text-secondary">{t('aiAssistantDescription', language)}</p>
        </div>
      </div>
      
      {/* Conversation History */}
      <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-4 mb-4">
        {conversation.map(msg => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
             {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <ChatbotIcon className="w-5 h-5 text-primary" />
                </div>
             )}
             
             <div className={`p-3 rounded-lg max-w-sm ${msg.sender === 'ai' ? 'bg-secondary text-text-primary' : 'bg-primary text-white'}`}>
                {msg.id.startsWith('ai_') && msg.content === '...' 
                    ? <div className="flex items-center justify-center p-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div></div>
                    : <MarkdownRenderer content={msg.content} />
                }
                
                {msg.sender === 'ai' && msg.content !== '...' && msg.actionType && (
                    <button onClick={() => handleCopy(msg.content, msg.id)} className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition">
                        {copiedMessageId === msg.id ? <CheckIcon className="w-3 h-3 text-green-500" /> : <ClipboardIcon className="w-3 h-3" />}
                        {copiedMessageId === msg.id ? t('copied', language) : t('copyToClipboard', language)}
                    </button>
                )}
             </div>

             {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-text-secondary" />
                </div>
             )}
          </div>
        ))}
        <div ref={conversationEndRef} />
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 pt-2 border-t border-border">
         <p className="text-sm font-semibold text-text-secondary mb-2">{t('suggestionType', language)}</p>
         <div className="grid grid-cols-2 gap-2">
            {actionButtons.map(type => (
                <button
                    key={type}
                    onClick={() => handleActionClick(type)}
                    disabled={isLoading}
                    className="p-2 text-sm text-center font-medium bg-secondary rounded-md hover:bg-border dark:hover:bg-slate-600 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                    {t(`aiSuggestions.${type}`, language)}
                </button>
            ))}
         </div>
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
                // Using a regex to find and replace **text** with <strong>text</strong>
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