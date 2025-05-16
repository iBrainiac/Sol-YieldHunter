import OpenAI from 'openai';
import { YieldOpportunity } from '@shared/schema';
import { storage } from '../storage';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TransactionIntent {
  action: 'invest' | 'withdraw' | 'none';
  protocol?: string;
  amount?: number;
  opportunityId?: number;
}

export class OpenAIService {
  private openai: OpenAI;
  private userChats: Map<string, ChatMessage[]>;
  
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not provided. AI chatbot functionality will be limited.');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.userChats = new Map();
  }
  
  /**
   * Process a user message and generate a response using OpenAI
   */
  async processMessage(sessionId: string, message: string): Promise<{
    response: string;
    transactionIntent: TransactionIntent;
  }> {
    try {
      // Get or initialize chat history
      let chatHistory = this.userChats.get(sessionId) || [];
      
      // Add system message if this is a new conversation
      if (chatHistory.length === 0) {
        chatHistory.push({
          role: 'system',
          content: this.getSystemPrompt()
        });
      }
      
      // Add user message to history
      chatHistory.push({ role: 'user', content: message });
      
      // Get yield opportunities to provide context
      const yieldOpportunities = await storage.getYieldOpportunities();
      const yieldContext = this.formatYieldOpportunities(yieldOpportunities);
      
      // Add yield context to the latest message
      const contextualMessage = `${message}\n\nHere are the current yield opportunities:\n${yieldContext}`;
      const messages = [
        ...chatHistory.slice(0, -1),
        { role: 'user', content: contextualMessage }
      ];
      
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      const responseContent = response.choices[0].message.content || 'I apologize, but I couldn\'t process your request.';
      
      // Add assistant response to history
      chatHistory.push({ role: 'assistant', content: responseContent });
      
      // Update chat history (limit to last 10 messages to save memory)
      if (chatHistory.length > 10) {
        chatHistory = [chatHistory[0], ...chatHistory.slice(chatHistory.length - 9)];
      }
      
      // Save updated chat history
      this.userChats.set(sessionId, chatHistory);
      
      // Extract transaction intent
      const transactionIntent = await this.extractTransactionIntent(message, yieldOpportunities);
      
      return {
        response: responseContent,
        transactionIntent
      };
    } catch (error) {
      console.error('Error processing chat message:', error);
      return {
        response: 'Sorry, I encountered an error processing your request. Please try again.',
        transactionIntent: { action: 'none' }
      };
    }
  }
  
  /**
   * Clear chat history for a session
   */
  clearChatHistory(sessionId: string): void {
    this.userChats.delete(sessionId);
  }
  
  /**
   * Format yield opportunities as text for context
   */
  private formatYieldOpportunities(opportunities: YieldOpportunity[]): string {
    return opportunities.map((opp, index) => {
      return `${index + 1}. ${opp.name} (ID: ${opp.id}) on ${opp.protocol}: APY ${opp.apy}%, Risk Level: ${opp.riskLevel}, TVL: ${opp.tvl}`;
    }).join('\n');
  }
  
  /**
   * Extract transaction intent from user message
   */
  private async extractTransactionIntent(
    message: string, 
    opportunities: YieldOpportunity[]
  ): Promise<TransactionIntent> {
    try {
      const prompt = `
You are a financial transaction intent detector. Analyze the following message and extract the user's transaction intent.
If the user wants to invest in a yield opportunity, determine:
1. Whether they want to "invest" or "withdraw"
2. The amount they want to invest/withdraw
3. The protocol they want to use (if specified)
4. The specific opportunity ID they want to use (if specified)

If the message doesn't contain a transaction intent, return action: "none".

Here are the available opportunities:
${this.formatYieldOpportunities(opportunities)}

User message: "${message}"

Respond with JSON in this format without any additional text:
{
  "action": "invest" | "withdraw" | "none",
  "amount": number | null,
  "protocol": "protocol name" | null,
  "opportunityId": number | null
}
      `;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0].message.content || '{"action": "none"}';
      return JSON.parse(content);
    } catch (error) {
      console.error('Error extracting transaction intent:', error);
      return { action: 'none' };
    }
  }
  
  /**
   * Get system prompt for the chatbot
   */
  private getSystemPrompt(): string {
    return `
You are SolSeeker, an expert AI assistant for Sol YieldHunter, a Solana yield aggregation platform. Your purpose is to help users find and invest in the best yield opportunities across Solana DeFi protocols.

Key responsibilities:
1. Answer questions about Solana DeFi, yield farming, and specific protocols (Raydium, Marinade, Orca, etc.)
2. Help users find yield opportunities based on their risk tolerance and preferences
3. Process natural language requests to invest in or withdraw from opportunities
4. Provide information about fees, risks, and potential returns

When responding:
- Be concise and helpful
- Provide specific recommendations based on current opportunities
- Clearly explain risks and potential rewards
- If users want to invest, guide them through the process
- Always prioritize user interests and risk tolerance

You'll be provided with current yield opportunities data when users ask questions.
`;
  }
}

export const openAIService = new OpenAIService();