/**
 * AI Backend Service - Provider Router
 * Routes requests to the appropriate provider service:
 * - Gemini: Native API (gemini.service.ts)
 * - Groq: OpenAI-compatible (groq.service.ts)
 * - Grok: OpenAI-compatible (grok.service.ts)
 * - Moonshot: OpenAI-compatible (moonshot.service.ts)
 * - Ollama: Local LLM (ollama.service.ts)
 */
import { BrowserWindow } from 'electron';
import { GeminiService, GeminiChatOptions, GeminiChunkData, ContinuationState } from './gemini.service';
import { GroqService, GroqChatOptions, GroqChunkData } from './groq.service';
import { GrokService, GrokChatOptions, GrokChunkData } from './grok.service';
import { MoonshotService, MoonshotChatOptions, MoonshotChunkData } from './moonshot.service';
import { OllamaService, OllamaChatOptions, OllamaChunkData } from './ollama.service';

// Unified chat options that works across all providers
export interface ChatOptions {
  provider?: 'gemini' | 'groq' | 'grok' | 'moonshot' | 'ollama';
  apiKey?: string;
  model?: string;
  context?: {
    files?: Array<{ path: string; content?: string; startLine?: number; endLine?: number }>;
    images?: Array<{ path: string; data: string }>;
    project?: string;
    contextMode?: 'full' | 'smart' | 'minimal';
  };
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// Unified chunk data type
export interface ChunkData {
  type: 'text' | 'function_call' | 'function_result' | 'error' | 'done' | 'continuation';
  data?: any;
  callId?: string;
  name?: string;
}

// Re-export ContinuationState for compatibility
export type { ContinuationState };

export class AIBackendService {
  private mainWindow: BrowserWindow | null = null;
  private geminiService: GeminiService;
  private groqService: GroqService;
  private grokService: GrokService;
  private moonshotService: MoonshotService;
  private ollamaService: OllamaService;

  constructor() {
    this.geminiService = new GeminiService();
    this.groqService = new GroqService();
    this.grokService = new GrokService();
    this.moonshotService = new MoonshotService();
    this.ollamaService = new OllamaService();
  }

  /**
   * Set the main window for IPC communication
   * Passed to all provider services
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
    this.geminiService.setMainWindow(window);
    this.groqService.setMainWindow(window);
    this.grokService.setMainWindow(window);
    this.moonshotService.setMainWindow(window);
    this.ollamaService.setMainWindow(window);
  }

  /**
   * Optimize conversation history for API models
   * - Retains only recent history in full
   * - Summarizes or simplifies older messages
   */
  private optimizeHistory(history: Array<{ role: 'user' | 'assistant'; content: string }>, provider: string): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (!history || history.length === 0) return [];
    
    // For Ollama (local), we can keep more history
    if (provider === 'ollama') {
      return history.slice(-50);
    }
    
    // For API providers, optimize more aggressively
    // Keep the last 10 messages in full
    const recentHistory = history.slice(-10);
    const olderHistory = history.slice(0, -10);
    
    if (olderHistory.length === 0) return recentHistory;
    
    // Simplify older history: keep only the first user message and a summary of intermediate steps
    const simplifiedOlder: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    // Keep the very first user message as it often contains the main goal
    if (olderHistory[0].role === 'user') {
      simplifiedOlder.push(olderHistory[0]);
    }
    
    // Add a summary placeholder for the middle part
    simplifiedOlder.push({
      role: 'assistant',
      content: `[Previous conversation history summarized: ${olderHistory.length} messages omitted to optimize context usage. I have already completed several steps of the task.]`
    });
    
    return [...simplifiedOlder, ...recentHistory];
  }

  /**
   * Main chat stream method - routes to appropriate provider
   */
  async chatStream(
    prompt: string,
    options: ChatOptions,
    onChunk?: (chunk: ChunkData) => void,
    continuationState?: ContinuationState
  ): Promise<void> {
    const provider = options.provider || 'gemini';
    
    // Optimize history before routing
    if (options.conversationHistory) {
      options.conversationHistory = this.optimizeHistory(options.conversationHistory, provider);
    }

    console.log(`[AIBackend] Routing to provider: ${provider}`);
    console.log(`[AIBackend] Options:`, {
      provider: options.provider,
      model: options.model,
      apiKeyLength: options.apiKey?.length || 0,
      hasContext: !!options.context,
      historyLength: options.conversationHistory?.length || 0,
    });

    switch (provider) {
      case 'groq':
        return this.groqService.chatStream(
          prompt,
          options as GroqChatOptions,
          onChunk as (chunk: GroqChunkData) => void
        );

      case 'grok':
        return this.grokService.chatStream(
          prompt,
          options as GrokChatOptions,
          onChunk as (chunk: GrokChunkData) => void
        );

      case 'moonshot':
        return this.moonshotService.chatStream(
          prompt,
          options as MoonshotChatOptions,
          onChunk as (chunk: MoonshotChunkData) => void
        );

      case 'ollama':
        return this.ollamaService.chatStream(
          prompt,
          options as OllamaChatOptions,
          onChunk as (chunk: OllamaChunkData) => void
        );

      case 'gemini':
      default:
        return this.geminiService.chatStream(
          prompt,
          options as GeminiChatOptions,
          onChunk as (chunk: GeminiChunkData) => void,
          continuationState
        );
    }
  }

  /**
   * Cancel all active requests across all providers
   */
  cancel(): void {
    console.log('[AIBackend] Cancelling all provider requests');
    this.geminiService.cancel();
    this.groqService.cancel();
    this.grokService.cancel();
    this.moonshotService.cancel();
    this.ollamaService.cancel();
  }

  /**
   * Get list of available providers
   */
  async listProviders(): Promise<{ id: string; name: string; description: string; isFree: boolean }[]> {
    return [
      {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Native Gemini API with 1M+ context. Best for complex tasks. RECOMMENDED.',
        isFree: true
      },
      {
        id: 'grok',
        name: 'Grok (xAI)',
        description: 'xAI Grok models with better rate limits than Groq. OpenAI-compatible API.',
        isFree: false
      },
      {
        id: 'groq',
        name: 'Groq',
        description: 'Fast inference with Llama 3.3 70B (128K context). Free tier available.',
        isFree: true
      },
      {
      id: 'moonshot',
        name: 'Moonshot',
        description: 'Kimi AI with 128K context. China-based servers, may be slower.',
      isFree: false
      },
      {
        id: 'ollama',
        name: 'Ollama (Local)',
        description: 'Run models locally for privacy and offline use. No API keys required.',
        isFree: true
      }
    ];
  }

  /**
   * Get combined list of models from all providers
   */
  async listModels(): Promise<{ success: boolean; models: any[] }> {
    const [geminiModels, groqModels, grokModels, moonshotModels, ollamaModels] = await Promise.all([
      this.geminiService.listModels(),
      this.groqService.listModels(),
      this.grokService.listModels(),
      this.moonshotService.listModels(),
      this.ollamaService.listModels()
    ]);

    const allModels = [
      ...geminiModels.models,
      ...grokModels.models,
      ...groqModels.models,
      ...moonshotModels.models,
      ...ollamaModels.models
    ];

    return {
      success: true,
      models: allModels
    };
  }

  /**
   * Get the current provider name (for compatibility)
   */
  getCurrentProvider(): string {
    return 'gemini'; // Default provider
  }

  /**
   * Set provider (for compatibility - actual routing happens in chatStream)
   */
  setProvider(providerName: string): boolean {
    const validProviders = ['gemini', 'groq', 'grok', 'moonshot', 'ollama'];
    return validProviders.includes(providerName);
  }

  /**
   * Get Ollama service instance for model management
   */
  getOllamaService(): OllamaService {
    return this.ollamaService;
  }
}
