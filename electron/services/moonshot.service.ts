/**
 * Moonshot Service
 * OpenAI-compatible integration with Moonshot's API (China-based servers)
 * Endpoint: https://api.moonshot.cn/v1/chat/completions
 * 
 * Key features:
 * - Uses Node.js fetch in test environment, Electron net module in app
 * - 60-second timeout
 * - 3 retry attempts with exponential backoff
 * - Fresh request per attempt (fixes singleton state issue)
 * - Detailed console logging for debugging
 */
import { BrowserWindow, net } from 'electron';
import { URL } from 'url';
import { Buffer } from 'buffer';

// Detect if we're running in Node.js (test) or Electron (app)
const isElectron = typeof process !== 'undefined' && (process as any).versions && (process as any).versions.electron;
import { TOOL_DEFINITIONS } from './tool-definitions';
import {
  readFile,
  writeFile,
  listFiles,
  peekFile,
  searchCode,
  createPlan,
  taskComplete,
  executeCommand,
  runTests,
  searchWeb,
} from './file-operations.service';
import { SmartContext } from './smart-context.service';
import { AgenticLoopManager } from './agentic-loop.service';

const SYSTEM_INSTRUCTION = `You are Candy, a friendly and autonomous coding assistant for CandyCode.

AGENTIC BEHAVIOR:
- Use function calls to execute actions - call functions directly, don't describe them
- When asked to create/write files, IMMEDIATELY call write_file function
- Work autonomously: call functions sequentially without waiting for intermediate responses
- Provide brief, helpful text responses throughout your work to keep the user informed
- After completing all actions, provide a summary and call task_complete

CRITICAL RULES:
- **MANDATORY**: When user asks to generate/create/write files, you MUST call write_file() function
- When task is fully complete, call task_complete(summary='...') with the markdown summary
- CRITICAL: After calling task_complete, STOP immediately

DYNAMIC TASK TRACKING:
- Use create_plan(title, steps) at the START of complex tasks with all steps set to "pending"
- After completing EACH step, call create_plan again with that step's status updated to "completed"
- Example: After writing a file, update the plan with that step marked as "completed"

AVAILABLE FUNCTIONS:
- write_file(path, content): Create or modify files
- read_file(path): Read file content
- peek_file(path): Quick peek at file summary
- list_files(directory_path): List directory contents
- search_code(pattern): Search codebase
- create_plan(title, steps): Create/update task plan - call again with status updates!
- task_complete(summary): Mark task done
- execute_command(command): Run commands
- run_tests(framework): Run tests
- web_search(query): Search the web

CRITICAL: Function calling is NOT optional. When tools are available, you MUST use them.`;

export interface MoonshotChatOptions {
  apiKey?: string;
  model?: string;
  context?: {
    files?: Array<{ path: string; content?: string }>;
    project?: string;
    contextMode?: 'full' | 'smart' | 'minimal';
  };
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  isPro?: boolean; // Deprecated
  licenseTier?: 'free' | 'standard' | 'pro';
}

export interface MoonshotChunkData {
  type: 'text' | 'function_call' | 'function_result' | 'error' | 'done';
  data?: any;
  callId?: string;
  name?: string;
}

/**
 * Convert Gemini-style tool definitions to OpenAI tools format
 */
function convertToOpenAITools(geminiTools: any[]): any[] {
  const tools: any[] = [];
  for (const toolGroup of geminiTools) {
    const decls = toolGroup.functionDeclarations || [];
    for (const declaration of decls) {
      tools.push({
        type: 'function',
        function: {
          name: declaration.name,
          description: declaration.description || '',
          parameters: declaration.parameters || { type: 'object', properties: {}, required: [] }
        }
      });
    }
  }
  return tools;
}

export class MoonshotService {
  private mainWindow: BrowserWindow | null = null;
  private cancelController: AbortController | null = null;
  private onChunkCallback: ((chunk: MoonshotChunkData) => void) | undefined = undefined;
  private baseUrl = 'https://api.moonshot.cn/v1/';
  private taskCompleted = false;
  private loopManager: AgenticLoopManager;

  constructor() {
    this.loopManager = new AgenticLoopManager(30);
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private sendChunk(chunk: MoonshotChunkData) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('ai-backend:chunk', chunk);
    }
    if (this.onChunkCallback) {
      try {
        this.onChunkCallback(chunk);
      } catch (error) {
        console.error('[MoonshotService] Error in onChunk callback:', error);
      }
    }
  }

  private getToolFunctions() {
    return {
      read_file: readFile,
      write_file: writeFile,
      list_files: listFiles,
      peek_file: peekFile,
      search_code: searchCode,
      create_plan: createPlan,
      task_complete: taskComplete,
      execute_command: executeCommand,
      run_tests: runTests,
      web_search: searchWeb,
    };
  }

  private async fetchWithNet(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
    }
  ): Promise<any> {
    // Use Node.js built-in fetch when running in test environment (Node.js)
    // Use Electron's net module when running in app (Electron)
    if (!isElectron) {
      // Node.js environment - use built-in fetch (Node 18+)
      console.log(`[MoonshotService] Using Node.js fetch (test environment)`);
      return fetch(url, {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        signal: options.signal,
      });
    }

    // Electron environment - use net module
    console.log(`[MoonshotService] Using Electron net module (app environment)`);
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const requestBody = options.body || '';
      
      const request = net.request({
        method: options.method || 'GET',
        protocol: urlObj.protocol as 'http:' | 'https:',
        hostname: urlObj.hostname,
        port: urlObj.port ? parseInt(urlObj.port) : 443,
        path: urlObj.pathname + (urlObj.search || ''),
        headers: options.headers || {},
      });

      // Handle abort signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          request.abort();
          reject(new Error('Request aborted'));
        });
      }

      let responseHeaders: Record<string, string> = {};
      let statusCode = 0;
      let statusMessage = '';
      const chunks: Buffer[] = [];
      let responseController: ReadableStreamDefaultController<Uint8Array> | null = null;
      let streamEnded = false;

      // Create ReadableStream that will be populated as data arrives
      const stream = new ReadableStream({
        start(controller) {
          responseController = controller;
        }
      });

      request.on('response', (response) => {
        statusCode = response.statusCode;
        statusMessage = response.statusMessage || '';

        // Collect headers
        if (response.headers) {
          Object.keys(response.headers).forEach(key => {
            const value = response.headers[key];
            responseHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : (value || '');
          });
        }

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          // Stream chunks as they arrive for real-time processing
          if (responseController && !streamEnded) {
            try {
              responseController.enqueue(new Uint8Array(chunk));
            } catch (e) {
              // Stream might be closed, ignore
            }
          }
        });

        response.on('end', () => {
          streamEnded = true;
          if (responseController) {
            try {
              responseController.close();
            } catch (e) {
              // Already closed
            }
          }

          // Create Headers object
          const headers = new Headers();
          Object.entries(responseHeaders).forEach(([key, value]) => {
            headers.set(key, value);
          });

          const netResponse = {
            status: statusCode,
            statusText: statusMessage,
            ok: statusCode >= 200 && statusCode < 300,
            headers,
            body: stream,
            text: async () => Buffer.concat(chunks).toString(),
            json: async () => JSON.parse(Buffer.concat(chunks).toString()),
          };

          resolve(netResponse);
        });

        response.on('error', (err) => {
          streamEnded = true;
          if (responseController) {
            try {
              responseController.error(err);
            } catch (e) {
              // Already closed
            }
          }
          reject(err);
        });
      });

      request.on('error', (err) => {
        streamEnded = true;
        if (responseController) {
          try {
            responseController.error(err);
          } catch (e) {
            // Already closed
          }
        }
        reject(err);
      });

      request.on('abort', () => {
        streamEnded = true;
        if (responseController) {
          try {
            responseController.error(new Error('Request aborted'));
          } catch (e) {
            // Already closed
          }
        }
        reject(new Error('Request aborted'));
      });

      // Write request body
      if (requestBody) {
        request.write(requestBody);
      }

      request.end();
    });
  }

  private async executeFunctionCall(
    functionName: string,
    args: Record<string, any>,
    callId: string
  ): Promise<{ name: string; response: any }> {
    const toolFunctions = this.getToolFunctions();
    const func = (toolFunctions as any)[functionName];

    if (!func) {
      const error = `Unknown function: ${functionName}`;
      console.error(`[MoonshotService] ${error}`);
      return { name: functionName, response: { error } };
    }

    try {
      console.log(`[MoonshotService] Executing ${functionName} with args:`, args);
      
      let result;
      if (functionName === 'write_file' && this.mainWindow) {
        result = await func(args, this.mainWindow);
      } else {
        result = await func(args);
      }
      
      console.log(`[MoonshotService] Function ${functionName} result:`, result);

      if (functionName === 'task_complete') {
        this.taskCompleted = true;
        this.loopManager.markTaskCompleted();
      }

      return { name: functionName, response: result };
    } catch (error: any) {
      console.error(`[MoonshotService] Error executing ${functionName}:`, error);
      return { name: functionName, response: { error: error.message || String(error) } };
    }
  }

  async chatStream(
    prompt: string,
    options: MoonshotChatOptions,
    onChunk?: (chunk: MoonshotChunkData) => void
  ): Promise<void> {
    this.onChunkCallback = onChunk;
    this.taskCompleted = false;
    
    // LICENSE CHECK: Set limits based on License Tier
    const tier = options.licenseTier || (options.isPro ? 'pro' : 'free');
    const MAX_LOOPS = tier === 'free' ? 50 : (tier === 'pro' ? Infinity : 50);

    // Update loop manager with the new limit
    this.loopManager = new AgenticLoopManager(isFinite(MAX_LOOPS) ? MAX_LOOPS : 1000);
    this.loopManager.setIsActive(true);
    
    // CRITICAL: Fresh AbortController for each request
    // This fixes the singleton state issue where previous cancelled requests affect new ones
    this.cancelController = new AbortController();
    
    // 60-second timeout for China-based servers (high latency expected)
    const TIMEOUT_MS = 60000;
    const timeoutId = setTimeout(() => {
      console.log('[MoonshotService] Request timeout after 60s');
      this.cancelController?.abort();
    }, TIMEOUT_MS);

    console.log('[MoonshotService] Starting request to:', this.baseUrl);
    console.log('[MoonshotService] API Key length:', options.apiKey?.length || 0);

    if (!options.apiKey) {
      this.sendChunk({ type: 'error', data: 'No Moonshot API key provided. Please set it in Settings.' });
      this.sendChunk({ type: 'done' });
      clearTimeout(timeoutId);
      return;
    }

    const model = options.model || 'moonshot-v1-128k';
    console.log('[MoonshotService] Using model:', model);

    const messages: any[] = [];

    // System message
    messages.push({ role: 'system', content: SYSTEM_INSTRUCTION });

    // Conversation history
    if (options.conversationHistory) {
      for (const msg of options.conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Build context
    let contextText = '';
    
    // BUILD SMART CONTEXT IF PROJECT IS ACTIVE
    if (options.context?.project) {
      const isStartOfSession = !options.conversationHistory || options.conversationHistory.length < 2;
      
      // LICENSE CHECK: Force minimal context if not Pro
      let selectedContextMode = options.context.contextMode || 'smart';
      if (tier !== 'pro' && selectedContextMode !== 'minimal') {
           selectedContextMode = 'minimal';
           this.sendChunk({
             type: 'text',
             data: '> **Free Tier Notice:** Project Context restricted to "Minimal" mode. Upgrade to Pro for Smart/Full context awareness.\n\n'
           });
      }

      if (isStartOfSession || selectedContextMode === 'full') {
        console.log(`[MoonshotService] Building project context with mode: ${selectedContextMode}`);
        const smartContext = new SmartContext(
          options.context.project, 
          selectedContextMode
        );
        const projectSummary = await smartContext.buildContext();
        contextText += projectSummary + '\n\n';
      } else {
        contextText += `Active Project: ${options.context.project}\nUse tools (list_files, read_file, search_code) to explore the codebase as needed.\n\n`;
      }
    }

    if (options.context?.files && options.context.files.length > 0) {
      contextText += 'Context Files:\n';
      contextText += options.context.files
        .map(f => `File: ${f.path}\n${f.content || ''}`)
        .join('\n\n');
      contextText += '\n\n';
    }

    messages.push({ role: 'user', content: contextText + prompt });

    try {
      while (this.loopManager.shouldContinueLoop()) {
        if (this.cancelController?.signal.aborted) {
          console.log('[MoonshotService] Request aborted');
          this.sendChunk({ type: 'done' });
          clearTimeout(timeoutId);
          return;
        }

        this.loopManager.incrementIteration();
        console.log(`[MoonshotService] Iteration ${this.loopManager.getCurrentIteration()}/${MAX_LOOPS}`);

        const requestBody = {
          model,
          messages,
          tools: convertToOpenAITools(TOOL_DEFINITIONS),
          tool_choice: 'auto',
          stream: true,
          temperature: 0.7,
          max_tokens: 131072 // Moonshot supports up to 128K
        };

        const url = `${this.baseUrl}chat/completions`;
        let response: any = null;
        let lastError = '';

        // 3 retry attempts with exponential backoff
        for (let attempt = 0; attempt < 3; attempt++) {
          // Create new AbortController for each retry attempt
          if (attempt > 0) {
            this.cancelController = new AbortController();
            setTimeout(() => this.cancelController?.abort(), TIMEOUT_MS);
          }

          try {
            const envType = isElectron ? 'Electron net module' : 'Node.js fetch';
            console.log(`[MoonshotService] Fetch attempt ${attempt + 1}/3 to ${url} (using ${envType})`);
            
            // Use environment-appropriate fetch method
            response = await this.fetchWithNet(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`,
              },
              body: JSON.stringify(requestBody),
              signal: this.cancelController.signal,
            });

            if (!response) {
              throw new Error('No response received');
            }

            console.log('[MoonshotService] Response status:', response.status);

            if (response.ok) {
              break;
            }

            // Handle errors
            const errorText = await response.text();
            lastError = errorText;
            console.error(`[MoonshotService] API error (${response.status}):`, errorText);

            // Retry on 5xx errors or rate limits
            if ((response.status >= 500 || response.status === 429) && attempt < 2) {
              const waitTime = (attempt + 1) * 2000;
              console.log(`[MoonshotService] Retrying in ${waitTime}ms...`);
              this.sendChunk({ type: 'text', data: `Server error. Retrying in ${Math.ceil(waitTime / 1000)}s...` });
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }

            break;
          } catch (fetchError: any) {
            // Log detailed error information
            console.error(`[MoonshotService] Fetch error details:`, {
              name: fetchError.name,
              message: fetchError.message,
              code: fetchError.code,
              errno: fetchError.errno,
              syscall: fetchError.syscall,
              stack: fetchError.stack,
              fullError: fetchError
            });
            
            lastError = fetchError.message || String(fetchError);
            console.error(`[MoonshotService] Fetch error:`, lastError);
            
            if (fetchError.name === 'AbortError') {
              console.log('[MoonshotService] Request was aborted (timeout or cancel)');
              if (attempt < 2) {
                const waitTime = (attempt + 1) * 2000;
                console.log(`[MoonshotService] Timeout, retrying in ${waitTime}ms...`);
                this.sendChunk({ type: 'text', data: `Request timeout. Retrying in ${Math.ceil(waitTime / 1000)}s...` });
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
              throw fetchError;
            }

            if (attempt < 2) {
              const waitTime = (attempt + 1) * 2000;
              console.log(`[MoonshotService] Network error, retrying in ${waitTime}ms:`, lastError);
              this.sendChunk({ type: 'text', data: `Network error. Retrying in ${Math.ceil(waitTime / 1000)}s...` });
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
        }

        if (!response || !response.ok) {
          const statusCode = response?.status || 'fetch failed';
          const errorMsg = `Moonshot API error (${statusCode}): ${lastError}`;
          console.error('[MoonshotService]', errorMsg);
          this.sendChunk({ type: 'error', data: errorMsg });
          this.sendChunk({ type: 'done' });
          clearTimeout(timeoutId);
          return;
        }

        // Process streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          this.sendChunk({ type: 'error', data: 'No response body reader available' });
          this.sendChunk({ type: 'done' });
          clearTimeout(timeoutId);
          return;
        }

        console.log('[MoonshotService] Starting to read stream...');

        let buffer = '';
        let fullText = '';
        let currentToolCalls: Record<number, { id: string; name: string; arguments: string }> = {};
        let processedToolCallsThisIteration = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('[MoonshotService] Stream finished');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta;
              const finishReason = json.choices?.[0]?.finish_reason;

              // Handle text content
              if (delta?.content) {
                fullText += delta.content;
                this.sendChunk({ type: 'text', data: delta.content });
              }

              // Handle tool calls
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  const index = toolCall.index ?? 0;
                  if (!currentToolCalls[index]) {
                    currentToolCalls[index] = { id: '', name: '', arguments: '' };
                  }
                  if (toolCall.id) currentToolCalls[index].id = toolCall.id;
                  if (toolCall.function?.name) currentToolCalls[index].name = toolCall.function.name;
                  if (toolCall.function?.arguments) currentToolCalls[index].arguments += toolCall.function.arguments;
                }
              }

              // Handle finish with tool_calls
              if (finishReason === 'tool_calls' || finishReason === 'stop') {
                const toolCallEntries = Object.values(currentToolCalls).filter(tc => tc.name && tc.arguments);
                
                if (toolCallEntries.length > 0) {
                  processedToolCallsThisIteration = true;
                  console.log('[MoonshotService] Processing tool calls:', toolCallEntries.length);
                  
                  // Add assistant message with tool calls
                  const assistantMsg: any = { role: 'assistant', content: fullText || null };
                  assistantMsg.tool_calls = toolCallEntries.map((tc, i) => ({
                    id: tc.id || `call_${Date.now()}_${i}`,
                    type: 'function',
                    function: { name: tc.name, arguments: tc.arguments }
                  }));
                  messages.push(assistantMsg);

                  // Execute each tool call and add results
                  for (const tc of toolCallEntries) {
                    try {
                      const args = JSON.parse(tc.arguments);
                      const callId = tc.id || `call_${Date.now()}`;
                      
                      this.sendChunk({ type: 'function_call', name: tc.name, data: args, callId });
                      
                      const result = await this.executeFunctionCall(tc.name, args, callId);
                      
                      this.sendChunk({ type: 'function_result', name: result.name, data: result.response, callId });

                      // Add tool result to messages
                      messages.push({
                        role: 'tool',
                        tool_call_id: callId,
                        content: typeof result.response === 'string' ? result.response : JSON.stringify(result.response)
                      });
                    } catch (parseError: any) {
                      console.error('[MoonshotService] Failed to parse tool arguments:', parseError);
                    }
                  }

                  // Reset for next iteration
                  currentToolCalls = {};
                  fullText = '';
                }
              }
            } catch (parseError) {
              // Ignore JSON parse errors for partial chunks
            }
          }
        }

        // Only break if we have no tool calls, no text, and task is completed
        if (!processedToolCallsThisIteration && !fullText && this.taskCompleted) {
          console.log('[MoonshotService] Task completed, ending loop');
          break;
        }
        
        // If tool calls were processed, continue the loop to get the next response
        if (processedToolCallsThisIteration) {
          console.log('[MoonshotService] Tool calls processed, continuing loop...');
          // Continue to next iteration - the loop will make another API call with the tool results
        } else if (fullText && !this.taskCompleted) {
          // Got text response but no tool calls - prompt to continue
          messages.push({ role: 'assistant', content: fullText });
        } else if (!fullText && !processedToolCallsThisIteration) {
          // No progress at all - break to avoid infinite loop
          console.log('[MoonshotService] No progress made, ending loop');
          break;
        }
      }

      // If we exit the loop without completion, notify the user about the limit
      if (!this.loopManager.getTaskCompleted() && tier !== 'pro' && this.loopManager.getCurrentIteration() >= MAX_LOOPS) {
          this.sendChunk({
              type: 'text',
              data: `\n\n**License Limit Reached:** The autonomous agent has stopped after ${MAX_LOOPS} iterations. Upgrade to Pro for extended autonomous coding.`
          });
      }

      console.log('[MoonshotService] Completed successfully');
      this.sendChunk({ type: 'done' });
      clearTimeout(timeoutId);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[MoonshotService] Error in chatStream:', error);
        this.sendChunk({ type: 'error', data: error.message || String(error) });
      } else {
        console.log('[MoonshotService] Request aborted');
      }
      this.sendChunk({ type: 'done' });
      clearTimeout(timeoutId);
    }
  }

  cancel(): void {
    console.log('[MoonshotService] Cancel requested');
    if (this.cancelController) {
      this.cancelController.abort();
    }
    this.loopManager.setIsActive(false);
    this.onChunkCallback = undefined;
    this.sendChunk({ type: 'done' });
  }

  async listModels(): Promise<{ success: boolean; models: any[] }> {
    return {
      success: true,
      models: [
        { id: "moonshot-v1-8k", name: "Moonshot V1 8K", desc: "8K context window, balanced performance", limits: "Requires API key", provider: "moonshot" },
        { id: "moonshot-v1-32k", name: "Moonshot V1 32K", desc: "32K context window", limits: "Requires API key", provider: "moonshot" },
        { id: "moonshot-v1-128k", name: "Moonshot V1 128K", desc: "128K context window - RECOMMENDED", limits: "Requires API key", provider: "moonshot", recommended: true }
      ]
    };
  }
}