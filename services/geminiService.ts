import { GoogleGenAI, Type } from "@google/genai";
import { Customer, Interaction } from '../types';

// Initialize the GoogleGenAI client with the API key from environment variables.
// The API key MUST be set in the environment variable `process.env.API_KEY`.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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
    // Call the Gemini API to generate content.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    // Return the text part of the response.
    return response.text.trim();
  } catch (error) {
    console.error('Error generating follow-up suggestion:', error);
    return 'An error occurred while fetching AI suggestion. Please check the console for details.';
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
    // Call the Gemini API to generate content.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    // Return the text part of the response.
    return response.text.trim();
  } catch (error) {
    console.error('Error summarizing interactions:', error);
    return 'An error occurred while fetching AI summary. Please check the console for details.';
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
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
      });
      return response.text.trim();
    } catch (error) {
      console.error('Error drafting email:', error);
      return 'An error occurred while drafting the email.';
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
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
      });
      return response.text.trim();
    } catch (error) {
      console.error('Error generating briefing:', error);
      return 'An error occurred while generating the briefing.';
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
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error('Error generating proactive summary:', error);
    return 'An error occurred while fetching AI summary.';
  }
};