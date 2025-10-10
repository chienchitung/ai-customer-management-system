import React, { useState, useCallback } from 'react';
import { Customer, AISuggestionType } from '../types';
import { getFollowUpSuggestion, summarizeInteractions, draftFollowUpEmail, generateMeetingBriefing } from '../services/geminiService';
import { t } from '../localization';
import { SparklesIcon } from './icons';

interface AIAssistantProps {
  customer: Customer;
  language: 'en' | 'zh';
}

const AIAssistant: React.FC<AIAssistantProps> = ({ customer, language }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<string>('');
  const [activeSuggestion, setActiveSuggestion] = useState<AISuggestionType | null>(null);

  const handleGetSuggestion = useCallback(async (type: AISuggestionType) => {
    if (isLoading) return;

    setIsLoading(true);
    setContent('');
    setActiveSuggestion(type);

    try {
      let result: string;
      switch (type) {
        case AISuggestionType.NEXT_STEP:
          result = await getFollowUpSuggestion(customer);
          break;
        case AISuggestionType.SUMMARY:
          result = await summarizeInteractions(customer);
          break;
        case AISuggestionType.DRAFT_EMAIL:
            result = await draftFollowUpEmail(customer);
            break;
        case AISuggestionType.MEETING_BRIEF:
            result = await generateMeetingBriefing(customer);
            break;
        default:
          result = 'Unknown suggestion type.';
      }
      setContent(result);
    } catch (error) {
      setContent('Failed to get AI suggestion. Please try again.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [customer, isLoading]);

  const ActionButton: React.FC<{ type: AISuggestionType }> = ({ type }) => (
    <button
        onClick={() => handleGetSuggestion(type)}
        className="px-3 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
        disabled={isLoading}
    >
        {t(`ai.${type}`, language)}
    </button>
  );

  return (
    <div className="bg-surface p-4 rounded-lg border border-border sticky top-24">
      <div className="flex items-center gap-2 mb-4">
        <SparklesIcon className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-bold text-text-primary">{t('aiAssistant', language)}</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <ActionButton type={AISuggestionType.NEXT_STEP} />
        <ActionButton type={AISuggestionType.SUMMARY} />
        <ActionButton type={AISuggestionType.DRAFT_EMAIL} />
        <ActionButton type={AISuggestionType.MEETING_BRIEF} />
      </div>

      <div className="bg-secondary p-3 rounded-md min-h-[200px] max-h-[400px] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        {!isLoading && content && (
           <div>
              <h4 className="font-semibold text-md text-text-primary mb-2">{activeSuggestion ? t(`ai.${activeSuggestion}`, language) : ''}</h4>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{content}</p>
           </div>
        )}
         {!isLoading && !content && (
            <div className="flex items-center justify-center h-full text-center text-text-secondary text-sm p-4">
                <p>{t('aiAssistantPrompt', language)} {customer.name}.</p>
            </div>
         )}
      </div>
    </div>
  );
};

export default AIAssistant;