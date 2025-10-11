import { GoogleGenAI, Type } from "@google/genai";
import { Customer, Interaction } from '../types';

// Initialize the GoogleGenAI client with the API key from environment variables.
// The API key MUST be set in the environment variable `process.env.API_KEY`.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const MAX_RETRIES = 3;
// Increased initial backoff time to better handle stricter rate limits.
const INITIAL_BACKOFF_MS = 2000;

// A utility function to introduce a delay.
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A private function that wraps the Gemini API call with a retry mechanism.
 * It handles 429 "Resource Exhausted" errors by waiting and retrying with exponential backoff and jitter.
 * @param prompt The prompt string to send to the model.
 * @returns A promise that resolves to the generated text content.
 * @throws An error if the API call fails after all retries or for non-rate-limit reasons.
 */
const generateContentWithRetry = async (prompt: string): Promise<string> => {
  let attempt = 0;
  let backoff = INITIAL_BACKOFF_MS;

  while (attempt < MAX_RETRIES) {
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
      });
      return response.text.trim();
    } catch (error: any) {
      // Check if the error is a rate limit error.
      const errorMessage = (error.message || error.toString()).toLowerCase();
      const isRateLimitError = errorMessage.includes('429') || 
                               errorMessage.includes('resource_exhausted') ||
                               errorMessage.includes('quota');
      
      if (isRateLimitError && attempt < MAX_RETRIES - 1) {
        console.warn(`Rate limit exceeded. Retrying in ${Math.round(backoff / 1000)}s... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(backoff);
        attempt++;
        // Exponentially increase backoff and add jitter to prevent thundering herd issues.
        backoff = backoff * 2 + Math.random() * 1000;
      } else {
        // If it's not a rate limit error or we've exhausted all retries, throw the error.
        console.error(`API call failed on attempt ${attempt + 1}.`, error);
        
        // Propagate a more specific error for rate limiting issues.
        if (isRateLimitError) {
             throw new Error("The AI service is temporarily busy due to high demand. Please try again in a few moments.");
        }
        throw error;
      }
    }
  }
  // This line should be unreachable if MAX_RETRIES > 0, but it satisfies TypeScript's requirement for a return path.
  throw new Error('Failed to get response from AI after multiple retries.');
};


/**
 * Creates a detailed prompt from customer data for the AI model.
 * @param customer The customer object.
 * @param task A string describing the specific task for the AI.
 * @param language The target language for the AI's response.
 * @returns A formatted string prompt.
 */
const createPrompt = (customer: Customer, task: string, language: 'en' | 'zh'): string => {
  // Serializes interactions into a readable list.
  const interactionHistory = customer.interactions
    .map(i => `- On ${i.date} (${i.type}): ${i.summary}`)
    .join('\n');

  const customerDetails = [
    `Name: ${customer.name}`,
    `Company: ${customer.company}`,
    `Current Status: ${customer.status}`,
    customer.dealValue ? `Estimated Deal Value: $${customer.dealValue.toLocaleString()}` : null,
    customer.customerPainPoints?.length ? `Pain Points: ${customer.customerPainPoints.join(', ')}` : null,
    customer.competitors?.length ? `Known Competitors: ${customer.competitors.join(', ')}` : null,
    customer.nextAction ? `Next Action: ${customer.nextAction.description} (Due: ${customer.nextAction.dueDate})` : null,
  ].filter(Boolean).map(line => `  - ${line}`).join('\n');
  
  const languageInstruction = `IMPORTANT: Your entire response must be in ${language === 'zh' ? 'Traditional Chinese (繁體中文)' : 'English'}.`;

  return `
    You are an expert B2B sales assistant AI. Your task is to analyze customer data and provide actionable insights.
    
    **Customer Profile:**
    ${customerDetails}
    
    **Interaction History:**
    ${interactionHistory || 'No interactions logged yet.'}
    
    **Your Task:**
    ${task}
    
    Provide a concise, professional, and helpful response.
    ${languageInstruction}
  `;
};

// Helper to handle API call errors and return appropriate translated messages.
const handleApiError = (error: any, language: 'en' | 'zh', contextForLogging: string): string => {
    console.error(`Error ${contextForLogging} after retries:`, error);
    
    // Specific rate limit error message
    if (error.message?.includes("The AI service is temporarily busy")) {
        return language === 'zh' 
            ? 'AI 服務暫時因需求量大而忙碌。請稍後再試。' 
            : error.message;
    }
    
    // Generic error message
    return language === 'zh'
        ? '獲取 AI 回應時發生錯誤。請檢查主控台以獲取詳細資訊。'
        : `An error occurred while fetching the AI response. Please check the console for details.`;
};

/**
 * Generates a suggestion for the next follow-up action for a given customer.
 * @param customer The customer to get a suggestion for.
 * @param language The target language for the AI's response.
 * @returns A promise that resolves to the AI-generated suggestion string.
 */
export const getFollowUpSuggestion = async (customer: Customer, language: 'en' | 'zh'): Promise<string> => {
  const task = "Based on the profile and history, suggest a single, concrete, and actionable next step to move the sales process forward. Explain your reasoning briefly.";
  const prompt = createPrompt(customer, task, language);
  try {
    return await generateContentWithRetry(prompt);
  } catch (error) {
    return handleApiError(error, language, 'generating follow-up suggestion');
  }
};

/**
 * Summarizes the entire interaction history with a customer.
 * @param customer The customer whose interactions are to be summarized.
 * @param language The target language for the AI's response.
 * @returns A promise that resolves to the AI-generated summary string.
 */
export const summarizeInteractions = async (customer: Customer, language: 'en' | 'zh'): Promise<string> => {
  const task = "Summarize the key points and overall sentiment of the interaction history in 2-3 sentences. Identify any potential opportunities or risks.";
  const prompt = createPrompt(customer, task, language);
  try {
    return await generateContentWithRetry(prompt);
  } catch (error) {
    return handleApiError(error, language, 'summarizing interactions');
  }
};

/**
 * Drafts a follow-up email based on the customer's data.
 * @param customer The customer to draft an email for.
 * @param language The target language for the AI's response.
 * @returns A promise resolving to the email draft string.
 */
export const draftFollowUpEmail = async (customer: Customer, language: 'en' | 'zh'): Promise<string> => {
    const task = `Draft a personalized follow-up email to the customer. The email should be professional, friendly, and aim to move the sales process forward. Base it on the most recent interaction and the customer's overall profile. Structure it like a real email with a subject line, greeting, body, and closing.

    Example structure:
    **Subject:** [Your Subject]
    
    Hi ${customer.name.split(' ')[0]},
    
    [Email Body]
    
    Best regards,
    [Your Name]`;
    const prompt = createPrompt(customer, task, language);
  
    try {
      return await generateContentWithRetry(prompt);
    } catch (error) {
      return handleApiError(error, language, 'drafting email');
    }
};

/**
 * Generates a pre-meeting briefing document.
 * @param customer The customer for whom to generate the brief.
 * @param language The target language for the AI's response.
 * @returns A promise resolving to the briefing string.
 */
export const generateMeetingBriefing = async (customer: Customer, language: 'en' | 'zh'): Promise<string> => {
    const task = `Generate a one-page pre-meeting briefing document. It should be structured with clear headings for each section:
1.  **Customer Snapshot:** Key company and contact info, status, and deal value.
2.  **Interaction History Summary:** Key takeaways and sentiment from past interactions.
3.  **Current Situation:** Pain points, known competitors, and the proposed next action.
4.  **Suggested Meeting Agenda:** Key topics and questions to discuss to advance the deal.
    
Keep the briefing concise and easy to scan in 5 minutes. Use Markdown for formatting.`;
    const prompt = createPrompt(customer, task, language);
  
    try {
      return await generateContentWithRetry(prompt);
    } catch (error) {
      return handleApiError(error, language, 'generating briefing');
    }
};

/**
 * Generates a proactive, quick summary for a customer.
 * @param customer The customer to summarize.
 * @param language The target language for the AI's response.
 * @returns A promise resolving to a concise summary.
 */
export const getProactiveSummary = async (customer: Customer, language: 'en' | 'zh'): Promise<string> => {
  const task = `
    Provide a very brief, scannable summary (2-3 sentences) of this customer's current situation. 
    Focus on:
    1.  Their current status and deal value.
    2.  The key takeaway from the most recent interaction.
    3.  A single, immediate opportunity or risk.
    Use Markdown for emphasis (e.g., **bold** text).`;
  const prompt = createPrompt(customer, task, language);

  try {
    return await generateContentWithRetry(prompt);
  } catch (error) {
    return handleApiError(error, language, 'generating proactive summary');
  }
};