import { GoogleGenAI, Type } from "@google/genai";
import { Customer, Interaction, Sentiment } from '../types';

// This check is to prevent errors in environments where process.env is not defined.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY is not set. AI features will be disabled.");
}

// Initialize the GoogleGenAI client with the API key.
const ai = new GoogleGenAI({ apiKey: API_KEY! });

/**
 * Creates a detailed prompt from customer data for the AI model.
 * @param customer The customer object.
 * @param task A string describing the specific task for the AI.
 * @returns A formatted string prompt.
 */
const createPrompt = (customer: Customer, task: string): string => {
  // Serializes interactions into a readable list.
  const interactionHistory = customer.interactions
    .map(i => `- On ${i.date} (${i.type}): ${i.summary} ${i.sentiment ? `(Sentiment: ${i.sentiment})` : ''}`)
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
  
  return `
    You are an expert B2B sales assistant AI. Your task is to analyze customer data and provide actionable insights.
    
    **Customer Profile:**
    ${customerDetails}
    
    **Interaction History:**
    ${interactionHistory || 'No interactions logged yet.'}
    
    **Your Task:**
    ${task}
    
    Provide a concise, professional, and helpful response.
  `;
};

/**
 * Generates a suggestion for the next follow-up action for a given customer.
 * @param customer The customer to get a suggestion for.
 * @returns A promise that resolves to the AI-generated suggestion string.
 */
export const getFollowUpSuggestion = async (customer: Customer): Promise<string> => {
  if (!API_KEY) return "API Key not configured. AI features are disabled.";
  
  const task = "Based on the profile and history, suggest a single, concrete, and actionable next step to move the sales process forward. Explain your reasoning briefly.";
  const prompt = createPrompt(customer, task);

  try {
    // Call the Gemini API to generate content.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    // Return the text part of the response.
    return response.text;
  } catch (error) {
    console.error('Error generating follow-up suggestion:', error);
    return 'An error occurred while fetching AI suggestion. Please check the console for details.';
  }
};

/**
 * Summarizes the entire interaction history with a customer.
 * @param customer The customer whose interactions are to be summarized.
 * @returns A promise that resolves to the AI-generated summary string.
 */
export const summarizeInteractions = async (customer: Customer): Promise<string> => {
    if (!API_KEY) return "API Key not configured. AI features are disabled.";

  const task = "Summarize the key points and overall sentiment of the interaction history in 2-3 sentences. Identify any potential opportunities or risks.";
  const prompt = createPrompt(customer, task);

  try {
    // Call the Gemini API to generate content.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    // Return the text part of the response.
    return response.text;
  } catch (error) {
    console.error('Error summarizing interactions:', error);
    return 'An error occurred while fetching AI summary. Please check the console for details.';
  }
};

/**
 * Analyzes the sentiment of a given text summary.
 * @param summary The text to analyze.
 * @returns A promise resolving to a Sentiment enum value.
 */
export const analyzeSentiment = async (summary: string): Promise<Sentiment> => {
    if (!API_KEY) return Sentiment.NEUTRAL;
  
    const prompt = `Analyze the sentiment of the following interaction summary. Classify it as "Positive", "Neutral", or "Negative".
    
    Summary: "${summary}"
    
    Return ONLY the classification.`;
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sentiment: {
                type: Type.STRING,
                enum: [Sentiment.POSITIVE, Sentiment.NEUTRAL, Sentiment.NEGATIVE],
              },
            },
            required: ["sentiment"],
          },
        },
      });
      const json = JSON.parse(response.text);
      return json.sentiment as Sentiment;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return Sentiment.NEUTRAL; // Default to neutral on error
    }
  };

/**
 * Drafts a follow-up email based on the customer's data.
 * @param customer The customer to draft an email for.
 * @returns A promise resolving to the email draft string.
 */
export const draftFollowUpEmail = async (customer: Customer): Promise<string> => {
    if (!API_KEY) return "API Key not configured. AI features are disabled.";
    
    const task = `Draft a personalized follow-up email to the customer. The email should be professional, friendly, and aim to move the sales process forward. Base it on the most recent interaction and the customer's overall profile. Structure it like a real email with a subject line, greeting, body, and closing.

    Example structure:
    **Subject:** [Your Subject]
    
    Hi ${customer.name.split(' ')[0]},
    
    [Email Body]
    
    Best regards,
    [Your Name]`;
    const prompt = createPrompt(customer, task);
  
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Error drafting email:', error);
      return 'An error occurred while drafting the email.';
    }
};

/**
 * Generates a pre-meeting briefing document.
 * @param customer The customer for whom to generate the brief.
 * @returns A promise resolving to the briefing string.
 */
export const generateMeetingBriefing = async (customer: Customer): Promise<string> => {
    if (!API_KEY) return "API Key not configured. AI features are disabled.";
    
    const task = `Generate a one-page pre-meeting briefing document. It should be structured with clear headings for each section:
1.  **Customer Snapshot:** Key company and contact info, status, and deal value.
2.  **Interaction History Summary:** Key takeaways and sentiment from past interactions.
3.  **Current Situation:** Pain points, known competitors, and the proposed next action.
4.  **Suggested Meeting Agenda:** Key topics and questions to discuss to advance the deal.
    
Keep the briefing concise and easy to scan in 5 minutes. Use Markdown for formatting.`;
    const prompt = createPrompt(customer, task);
  
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Error generating briefing:', error);
      return 'An error occurred while generating the briefing.';
    }
};
