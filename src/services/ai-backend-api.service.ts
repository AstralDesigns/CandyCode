/**
 * AI Backend API Service - IPC-based communication with Electron main process
 * Integration with Gemini API
 */

export interface AIBackendChunk {
  type: 'text' | 'function_call' | 'function_result' | 'error' | 'done';
  data?: any;
  callId?: string;
  name?: string;
}

export interface ChatOptions {
  provider?: 'gemini' | 'groq' | 'grok' | 'moonshot' | 'ollama' | 'openai' | 'anthropic' | 'windsurf';
  apiKey?: string;
  model?: string;
  context?: {
    files?: Array<{ path: string; content?: string; startLine?: number; endLine?: number }>;
    images?: Array<{ path: string; data: string }>;
    project?: string;
    contextMode?: 'full' | 'smart' | 'minimal';
  };
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  isPro?: boolean; // Deprecated
  licenseTier?: 'free' | 'standard' | 'pro';
  windsurfUseBYOK?: boolean;
  windsurfBYOKProvider?: 'openai' | 'anthropic' | 'google';
  windsurfBYOKApiKey?: string;
}

export class AIBackendApiService {
  private chunkListeners: Set<(chunk: AIBackendChunk) => void> = new Set();

  constructor() {
    if (window.electronAPI?.aiBackend) {
      window.electronAPI.aiBackend.onChunk((chunk: AIBackendChunk) => {
        this.chunkListeners.forEach((listener) => {
          try {
            listener(chunk);
          } catch (error) {
            console.error('[AIBackendApiService] Listener error:', error);
          }
        });
      });
    }
  }

  async chatStream(
    prompt: string,
    options: ChatOptions,
    onChunk: (chunk: AIBackendChunk) => void
  ): Promise<void> {
    if (options.provider === 'windsurf') {
      // Use Windsurf service directly
      const { windsurfService } = await import('./windsurf.service');
      return windsurfService.chatStream(prompt, {
        provider: options.windsurfBYOKProvider,
        apiKey: options.windsurfBYOKApiKey,
        model: options.model,
        context: options.context,
        conversationHistory: options.conversationHistory,
        useBYOK: options.windsurfUseBYOK
      }, onChunk);
    }

    if (!window.electronAPI?.aiBackend) {
      throw new Error('Electron API not available');
    }

    this.chunkListeners.add(onChunk);

    try {
      await window.electronAPI.aiBackend.chat(prompt, options);
    } catch (error: any) {
      this.chunkListeners.delete(onChunk);
      throw error;
    }
  }

  cancel(): void {
    if (window.electronAPI?.aiBackend) {
      window.electronAPI.aiBackend.cancel();
    }
    this.chunkListeners.clear();
  }

  removeListener(listener: (chunk: AIBackendChunk) => void): void {
    this.chunkListeners.delete(listener);
  }

  removeAllListeners(): void {
    this.chunkListeners.clear();
    if (window.electronAPI?.aiBackend) {
      window.electronAPI.aiBackend.removeAllListeners('ai-backend:chunk');
    }
  }

  async listModels(): Promise<any> {
    if (!window.electronAPI?.aiBackend) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.aiBackend.listModels();
  }
}

export const aiBackendApiService = new AIBackendApiService();