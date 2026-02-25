export interface WindsurfChatOptions {
  model?: string;
  context?: string | { files?: any[]; images?: any[]; project?: string; contextMode?: string };
  conversationHistory?: Array<{ role: string; content: string }>;
  useBYOK?: boolean;
  byokProvider?: 'openai' | 'anthropic' | 'google';
  byokApiKey?: string;
  maxTokens?: number;
}

export interface WindsurfChatChunk {
  content: string;
  type: 'content' | 'done';
  done: boolean;
}

export interface WindsurfCompletionOptions {
  prefix: string;
  suffix?: string;
  language?: string;
  maxTokens?: number;
  useBYOK?: boolean;
  byokProvider?: 'openai' | 'anthropic' | 'google';
  byokApiKey?: string;
}

export interface WindsurfCompletion {
  text: string;
  confidence?: number;
}

export interface WindsurfInlineSuggestionOptions {
  prefix: string;
  suffix?: string;
  language?: string;
  maxTokens?: number;
  useBYOK?: boolean;
  byokProvider?: 'openai' | 'anthropic' | 'google';
  byokApiKey?: string;
}

export interface WindsurfInlineSuggestion {
  text: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  type: 'insertion' | 'replacement' | 'deletion';
  confidence?: number;
}

export class WindsurfService {
  private creditBalance: number | null = null;
  private lastCreditCheck: number = 0;
  private readonly CREDIT_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Configuration properties
  private apiKey?: string;
  private serviceKey?: string;
  private byokProvider?: 'openai' | 'anthropic' | 'google';
  private byokApiKey?: string;

  async getCreditBalance(): Promise<number | null> {
    // Only check credits if not using BYOK
    const config = this.getWindsurfConfig();
    if (config.useBYOK) {
      return null; // No credit tracking for BYOK
    }

    // Cache credit balance for 5 minutes
    const now = Date.now();
    if (this.creditBalance !== null && now - this.lastCreditCheck < this.CREDIT_CHECK_INTERVAL) {
      return this.creditBalance;
    }

    // Simulate credit balance for demo purposes
    // In real integration, this would connect to Windsurf extension
    this.creditBalance = 25; // Free tier: 25 credits/month
    this.lastCreditCheck = now;
    return this.creditBalance;
  }

  private async checkCredits(): Promise<boolean> {
    const balance = await this.getCreditBalance();
    if (balance === null) return true; // Assume available if can't check
    return balance > 0;
  }

  constructor() {
    // Load configuration from store or environment
    this.loadConfiguration();
  }

  private loadConfiguration() {
    // This will be connected to store via ai-backend-api service
    const stored = localStorage.getItem('candycode-windsurf-config');
    if (stored) {
      const config = JSON.parse(stored);
      this.serviceKey = config.serviceKey;
      this.apiKey = config.apiKey;
      this.byokProvider = config.byokProvider;
      this.byokApiKey = config.byokApiKey;
    }
  }

  /**
   * Configure Windsurf service
   */
  configure(config: {
    serviceKey?: string;
    apiKey?: string;
    byokProvider?: 'openai' | 'anthropic' | 'google';
    byokApiKey?: string;
  }) {
    this.serviceKey = config.serviceKey;
    this.apiKey = config.apiKey;
    this.byokProvider = config.byokProvider;
    this.byokApiKey = config.byokApiKey;

    // Save to localStorage
    localStorage.setItem('candycode-windsurf-config', JSON.stringify({
      serviceKey: this.serviceKey,
      apiKey: this.apiKey,
      byokProvider: this.byokProvider,
      byokApiKey: this.byokApiKey
    }));
  }

  /**
   * Get current Windsurf configuration
   */
  private getWindsurfConfig() {
    return {
      apiKey: this.apiKey,
      serviceKey: this.serviceKey,
      byokProvider: this.byokProvider,
      byokApiKey: this.byokApiKey,
      useBYOK: !!(this.byokApiKey && this.byokProvider)
    };
  }

  /**
   * Stream chat response from Windsurf Cascade
   */
  async chatStream(
    prompt: string,
    options: WindsurfChatOptions,
    onChunk: (chunk: WindsurfChatChunk) => void
  ): Promise<void> {
    const useBYOK = options.useBYOK && this.byokApiKey && this.byokProvider;
    
    if (useBYOK) {
      return this.streamBYOKChat(prompt, options, onChunk);
    } else {
      return this.streamWindsurfChat(prompt, options, onChunk);
    }
  }

  /**
   * Stream chat using Windsurf's infrastructure (credit-based)
   */
  private async streamWindsurfChat(
    prompt: string,
    options: WindsurfChatOptions,
    onChunk: (chunk: WindsurfChatChunk) => void
  ): Promise<void> {
    // Allow usage without API key for free tier (will be validated server-side)
    if (!this.apiKey) {
      console.warn('Using Windsurf without API key - free tier limits apply');
    }

    // Check credits before making request (only if we have an API key)
    if (this.apiKey) {
      const hasCredits = await this.checkCredits();
      if (!hasCredits) {
        const balance = await this.getCreditBalance();
        throw new Error(`Insufficient Windsurf credits. Current balance: ${balance || 'Unknown'}. Please purchase more credits or switch to BYOK mode.`);
      }
    }

    try {
      // Simulate Windsurf SWE-1.5 response
      // In real integration, this would communicate with Windsurf extension
      console.log('Windsurf SWE-1.5 chat request:', { prompt, options });
      
      // Simulate SWE-1.5 agentic response
      const response = await this.generateSWE15Response(prompt, options);
      
      // Stream response character by character
      const chars = response.split('');
      let currentText = '';
      
      for (let i = 0; i < chars.length; i++) {
        currentText += chars[i];
        onChunk({
          content: currentText,
          type: 'content',
          done: false
        });
        
        // Simulate typing speed (faster than human)
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 10));
      }
      
      onChunk({
        content: currentText,
        type: 'content',
        done: true
      });

    } catch (error) {
      console.error('Windsurf chat error:', error);
      throw error;
    }
  }

  /**
   * Generate SWE-1.5 style response
   */
  private async generateSWE15Response(prompt: string, options: WindsurfChatOptions): Promise<string> {
    // Simulate SWE-1.5's advanced reasoning and agentic capabilities
    const context = options.context ? JSON.stringify(options.context) : '';
    const history = options.conversationHistory || [];
    
    // SWE-1.5 characteristics: fast, accurate, tool-using, code-focused
    const response = `I'm Windsurf SWE-1.5, your advanced AI coding agent. I'll help you with this request: "${prompt}"

**SWE-1.5 Analysis:**
- Model: SWE-1.5 (Fast Agent)
- Context: ${context ? 'Provided' : 'Not provided'}
- History: ${history.length} messages
- Mode: ${options.useBYOK ? 'BYOK' : 'Credit-based'}

**Capabilities:**
⚡ Lightning-fast code generation and analysis
🔧 Advanced tool calling and file operations
🧠 Superior reasoning and problem-solving
📝 Context-aware code completion
🔄 Real-time collaboration features

**Response:**
I'll provide you with precise, efficient solutions leveraging SWE-1.5's enhanced capabilities. My responses are optimized for speed and accuracy while maintaining deep understanding of your codebase and requirements.

Current configuration:
- Model: ${options.model || 'swe-1.5'}
- Credits: ${this.creditBalance || 'Free tier'}
- BYOK Mode: ${options.useBYOK ? 'Enabled' : 'Disabled'}

Note: This is a simulated SWE-1.5 response. In a real Windsurf integration, responses would come from the actual Windsurf extension infrastructure.`;

    return response;
  }

  /**
   * Stream chat using BYOK (Bring Your Own Key)
   */
  private async streamBYOKChat(
    prompt: string,
    options: WindsurfChatOptions,
    onChunk: (chunk: WindsurfChatChunk) => void
  ): Promise<void> {
    if (!this.byokApiKey || !this.byokProvider) {
      throw new Error('BYOK API key and provider required for BYOK usage');
    }

    // Map Windsurf models to provider models
    const modelMap = {
      openai: {
        'swe-1.5': 'gpt-4',
        'swe-1-lite': 'gpt-3.5-turbo',
        'claude-sonnet': 'gpt-4',
        'claude-opus': 'gpt-4-turbo'
      },
      anthropic: {
        'swe-1.5': 'claude-3-5-sonnet-20240620',
        'swe-1-lite': 'claude-3-haiku-20240307',
        'gpt-4o': 'claude-3-5-sonnet-20240620',
        'gpt-4o-mini': 'claude-3-haiku-20240307'
      },
      google: {
        'swe-1.5': 'gemini-1.5-pro',
        'swe-1-lite': 'gemini-1.5-flash',
        'gpt-4o': 'gemini-1.5-pro',
        'claude-sonnet': 'gemini-1.5-flash'
      }
    };

    const providerModel = (modelMap[this.byokProvider as keyof typeof modelMap])?.[options.model || 'swe-1.5' as keyof typeof modelMap.openai] || options.model;

    try {
      let response;
      
      if (this.byokProvider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.byokApiKey}`,
          },
          body: JSON.stringify({
            model: providerModel,
            messages: [
              ...(options.conversationHistory || []),
              { role: 'user', content: prompt }
            ],
            stream: true,
            max_tokens: options.maxTokens || 4000
          })
        });
      } else if (this.byokProvider === 'anthropic') {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': this.byokApiKey,
          },
          body: JSON.stringify({
            model: providerModel,
            max_tokens: options.maxTokens || 4000,
            messages: [
              ...(options.conversationHistory || []),
              { role: 'user', content: prompt }
            ],
            stream: true
          })
        });
      } else if (this.byokProvider === 'google') {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${providerModel}:streamGenerateContent?key=${this.byokApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ],
                role: 'user'
              }
            ],
            generationConfig: {
              maxOutputTokens: options.maxTokens || 4000
            },
            stream: true
          })
        });
      } else {
        throw new Error(`Unsupported BYOK provider: ${this.byokProvider}`);
      }

      if (!response.ok) {
        throw new Error(`${this.byokProvider} API error: ${response.statusText} (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            let chunkData;
            if (this.byokProvider === 'openai' && line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                onChunk({ content: '', type: 'done', done: true });
                return;
              }
              try {
                chunkData = JSON.parse(data);
                const content = chunkData.choices?.[0]?.delta?.content || '';
                if (content) {
                  onChunk({
                    content,
                    type: 'content',
                    done: false
                  });
                }
              } catch (e) {
                console.error('Failed to parse OpenAI chunk:', data);
              }
            } else if (this.byokProvider === 'anthropic' && line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                chunkData = JSON.parse(data);
                if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
                  onChunk({
                    content: chunkData.delta.text,
                    type: 'content',
                    done: false
                  });
                } else if (chunkData.type === 'message_stop') {
                  onChunk({ content: '', type: 'done', done: true });
                  return;
                }
              } catch (e) {
                console.error('Failed to parse Anthropic chunk:', data);
              }
            } else if (this.byokProvider === 'google' && line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                chunkData = JSON.parse(data);
                const content = chunkData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (content) {
                  onChunk({
                    content,
                    type: 'content',
                    done: false
                  });
                }
              } catch (e) {
                console.error('Failed to parse Google chunk:', data);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('BYOK chat error:', error);
      throw error;
    }
  }

  /**
   * Get code completions
   */
  async getCompletions(options: WindsurfCompletionOptions): Promise<WindsurfCompletion[]> {
    const useBYOK = options.useBYOK && this.byokApiKey && this.byokProvider;
    
    if (useBYOK) {
      return this.getBYOKCompletions(options);
    } else {
      return this.getWindsurfCompletions(options);
    }
  }

  /**
   * Get completions using Windsurf's infrastructure
   */
  private async getWindsurfCompletions(options: WindsurfCompletionOptions): Promise<WindsurfCompletion[]> {
    if (!this.apiKey) {
      console.warn('Using Windsurf without API key - free tier limits apply');
    }

    try {
      // Simulate Windsurf completion response
      // In real integration, this would communicate with Windsurf extension
      console.log('Windsurf completions request:', options);
      
      // Generate context-aware completions
      const prefix = options.prefix || '';
      const suffix = options.suffix || '';
      const language = options.language || 'text';
      
      // Simulate SWE-1.5 style completions
      const completions: WindsurfCompletion[] = [];
      
      // Analyze prefix to generate relevant completions
      if (prefix.includes('function')) {
        completions.push({
          text: 'functionName() {\n  // implementation\n}',
          confidence: 0.9
        });
      }
      
      if (prefix.includes('const') && prefix.includes('=')) {
        completions.push({
          text: 'const variable = value;',
          confidence: 0.85
        });
      }
      
      if (prefix.includes('import')) {
        completions.push({
          text: 'import { module } from "package";',
          confidence: 0.8
        });
      }
      
      // Add language-specific completions
      if (language === 'typescript' || language === 'javascript') {
        completions.push({
          text: 'console.log(result);',
          confidence: 0.7
        });
      }
      
      if (language === 'python') {
        completions.push({
          text: 'print(result)',
          confidence: 0.7
        });
      }
      
      return completions;
    } catch (error) {
      console.error('Windsurf completions error:', error);
      return [];
    }
  }

  /**
   * Get completions using BYOK
   */
  private async getBYOKCompletions(_options: WindsurfCompletionOptions): Promise<WindsurfCompletion[]> {
    // For now, return empty array for BYOK completions
    // This would require implementing provider-specific completion APIs
    console.log('BYOK completions not yet implemented');
    return [];
  }

  /**
   * Get inline suggestions (Fill In The Middle)
   */
  async getInlineSuggestions(options: WindsurfInlineSuggestionOptions): Promise<WindsurfInlineSuggestion[]> {
    const useBYOK = options.useBYOK && this.byokApiKey && this.byokProvider;
    
    if (useBYOK) {
      return this.getBYOKInlineSuggestions(options);
    } else {
      return this.getWindsurfInlineSuggestions(options);
    }
  }

  /**
   * Get inline suggestions using Windsurf's infrastructure
   */
  private async getWindsurfInlineSuggestions(options: WindsurfInlineSuggestionOptions): Promise<WindsurfInlineSuggestion[]> {
    if (!this.apiKey) {
      console.warn('Using Windsurf without API key - free tier limits apply');
    }

    try {
      // Simulate Windsurf inline suggestions
      // In real integration, this would communicate with Windsurf extension
      console.log('Windsurf inline suggestions request:', options);
      
      const prefix = options.prefix || '';
      const suffix = options.suffix || '';
      const language = options.language || 'text';
      
      // Generate FIM (Fill In The Middle) suggestions
      const suggestions: WindsurfInlineSuggestion[] = [];
      
      // Analyze context for intelligent suggestions
      const beforeCursor = prefix.split('\n').pop() || '';
      const afterCursor = suffix.split('\n')[0] || '';
      
      // Generate context-aware suggestions
      if (beforeCursor.includes('function') && afterCursor.includes('{')) {
        suggestions.push({
          text: '  // TODO: implement function',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
          },
          type: 'insertion',
          confidence: 0.9
        });
      }
      
      if (language === 'typescript' || language === 'javascript') {
        if (beforeCursor.includes('const ')) {
          suggestions.push({
            text: ' = initialValue;',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 }
            },
            type: 'insertion',
            confidence: 0.85
          });
        }
      }
      
      return suggestions;
    } catch (error) {
      console.error('Windsurf inline suggestions error:', error);
      return [];
    }
  }

  /**
   * Get inline suggestions using BYOK
   */
  private async getBYOKInlineSuggestions(_options: WindsurfInlineSuggestionOptions): Promise<WindsurfInlineSuggestion[]> {
    // For now, return empty array for BYOK inline suggestions
    // This would require implementing provider-specific FIM APIs
    console.log('BYOK inline suggestions not yet implemented');
    return [];
  }

  /**
   * Cancel ongoing requests
   */
  cancel(): void {
    // Implementation for cancelling ongoing requests
    console.log('Windsurf requests cancelled');
  }
}

export const windsurfService = new WindsurfService();
