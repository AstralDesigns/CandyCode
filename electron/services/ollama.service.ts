/**
 * Ollama Service
 * Local LLM integration using the official 'ollama' npm package
 */
import { BrowserWindow } from 'electron';
import { Ollama, Message } from 'ollama';
// @ts-ignore
import nodeFetch from 'node-fetch';
import { Buffer } from 'buffer';
import { TOOL_DEFINITIONS } from './tool-definitions';
import { SmartContext } from './smart-context.service';
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

const SYSTEM_INSTRUCTION = `You are Alpha, a friendly and autonomous coding assistant for AlphaStudio.

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

const FALLBACK_TOOL_INSTRUCTION = `
IMPORTANT: Your current model does NOT support native tool calling. 
To call a function, you MUST use the following EXACT format on a new line:
TOOL_CALL: function_name({"arg1": "value1", "arg2": "value2"})

Example:
TOOL_CALL: write_file({"path": "hello.txt", "content": "Hello World"})
`;

export interface OllamaChatOptions {
  model?: string;
  context?: {
    files?: Array<{ path: string; content?: string }>;
    project?: string;
    contextMode?: 'full' | 'smart' | 'minimal';
  };
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface OllamaChunkData {
  type: 'text' | 'function_call' | 'function_result' | 'error' | 'done';
  data?: any;
  callId?: string;
  name?: string;
}

export class OllamaService {
  private mainWindow: BrowserWindow | null = null;
  // Official Ollama client with node-fetch shim for Electron/Node environments
  private ollama = new Ollama({
    host: 'http://127.0.0.1:11434',
    fetch: async (input: any, init: any) => {
      const response = await nodeFetch as any; (input, {
        ...init,
        timeout: 300000
      });

      // Node-fetch response.body is a Node Stream, but Ollama/Browser-fetch expects a Web ReadableStream
      // We add getReader() to the body to satisfy the browser-style library expectation
      if (response.body && typeof (response.body as any).getReader !== 'function') {
        const body = response.body as any;
        body.getReader = function (this: any) {
          const iterable = this;
          const iterator = iterable[Symbol.asyncIterator]();
          return {
            read: async () => {
              const result = await iterator.next();
              // Node-fetch provides Buffers, browser-fetch/ollama expects Uint8Array or string
              if (result.value && Buffer.isBuffer(result.value)) {
                result.value = new Uint8Array(result.value);
              }
              return result;
            },
            releaseLock: () => { },
            cancel: async () => {
              if (typeof iterable.destroy === 'function') iterable.destroy();
            }
          };
        }.bind(body);
      }

      // Patch response.clone() which is used by some fetch-based libraries
      const originalClone = response.clone.bind(response);
      response.clone = function () {
        const cloned = originalClone();
        if (cloned.body && typeof cloned.body.getReader !== 'function') {
          const cBody = cloned.body;
          const cIterator = cBody[Symbol.asyncIterator]();
          cBody.getReader = function () {
            return {
              read: async () => {
                const res = await cIterator.next();
                if (res.value && Buffer.isBuffer(res.value)) res.value = new Uint8Array(res.value);
                return res;
              },
              releaseLock: () => { },
              cancel: async () => { if (typeof cBody.destroy === 'function') cBody.destroy(); }
            };
          }.bind(cBody);
        }
        return cloned;
      }.bind(response);

      return response as any;
    }
  });
  private onChunkCallback: ((chunk: OllamaChunkData) => void) | undefined = undefined;
  private taskCompleted = false;
  private activeModelName: string | null = null;
  private abortController: AbortController | null = null;
  private modelCapabilities: Map<string, { supportsTools: boolean }> = new Map();

  constructor() { }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private sendChunk(chunk: OllamaChunkData) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('ai-backend:chunk', chunk);
    }
    if (this.onChunkCallback) {
      try {
        this.onChunkCallback(chunk);
      } catch (error) {
        console.error('[OllamaService] Error in onChunk callback:', error);
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

  private async executeFunctionCall(
    functionName: string,
    args: Record<string, any>,
    callId: string
  ): Promise<{ name: string; response: any }> {
    const toolFunctions = this.getToolFunctions();
    const func = (toolFunctions as any)[functionName];

    if (!func) {
      const error = `Unknown function: ${functionName}`;
      console.error(`[OllamaService] ${error}`);
      return { name: functionName, response: { error } };
    }

    try {
      console.log(`[OllamaService] Executing ${functionName} with args:`, args);

      let result;
      if (functionName === 'write_file' && this.mainWindow) {
        result = await func(args, this.mainWindow);
      } else {
        result = await func(args);
      }

      console.log(`[OllamaService] Function ${functionName} result:`, result);

      if (functionName === 'task_complete') {
        this.taskCompleted = true;
      }

      return { name: functionName, response: result };
    } catch (error: any) {
      console.error(`[OllamaService] Error executing ${functionName}:`, error);
      return { name: functionName, response: { error: error.message || String(error) } };
    }
  }

  /**
   * Check if Ollama server is running
   */
  async checkServerStatus(): Promise<{ running: boolean; error?: string }> {
    try {
      const response = await nodeFetch('http://localhost:11434/api/tags', {
        method: 'GET',
        timeout: 5000,
      } as any);
      return { running: response.ok };
    } catch (error: any) {
      return { running: false, error: error.message || 'Ollama server not running' };
    }
  }

  /**
   * List installed models
   */
  async listInstalledModels(): Promise<Array<{ name: string; size: number; modified: string }>> {
    try {
      const response = await this.ollama.list();
      return response.models.map((m) => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at.toString(),
      }));
    } catch (error: any) {
      console.error('[OllamaService] Error listing models:', error);
      return [];
    }
  }

  /**
   * Pull a model from Ollama
   */
  async pullModel(modelName: string, onProgress?: (progress: string) => void): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[OllamaService] Pulling model: ${modelName}`);
      const stream = await this.ollama.pull({ model: modelName, stream: true });

      for await (const part of stream) {
        if (part.status && onProgress) {
          let progress = part.status;
          if (part.completed && part.total) {
            const percent = ((part.completed / part.total) * 100).toFixed(1);
            progress += ` (${percent}%)`;
          }
          onProgress(progress);
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('[OllamaService] Error pulling model:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ollama.delete({ model: modelName });
      return { success: true };
    } catch (error: any) {
      console.error('[OllamaService] Error deleting model:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Run/load a model into memory
   */
  async runModel(modelName: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[OllamaService] Loading model into memory: ${modelName}`);

      await this.ollama.generate({
        model: modelName,
        prompt: '',
        keep_alive: '5m',
      });

      this.activeModelName = modelName;
      console.log(`[OllamaService] Model ${modelName} loaded successfully`);
      return { success: true };
    } catch (error: any) {
      console.error(`[OllamaService] Error running model ${modelName}:`, error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Search for available models
   */
  async searchModels(query: string): Promise<{ success: boolean; models: Array<{ name: string; description?: string }> }> {
    try {
      const popularModels = [
        { name: 'llama3.2', description: 'Meta Llama 3.2 - Improved reasoning' },
        { name: 'llama3.1:8b', description: 'Meta Llama 3.1 - Balanced performance' },
        { name: 'llama3.1:70b', description: 'Meta Llama 3.1 - High quality' },
        { name: 'deepseek-r1:14b', description: 'DeepSeek R1 - Strong reasoning' },
        { name: 'mistral', description: 'Mistral 7B - Efficient and fast' },
        { name: 'phi3:mini', description: 'Microsoft Phi-3 Mini' },
        { name: 'qwen2.5:14b', description: 'Qwen 2.5 - Enhanced capabilities' },
        { name: 'codellama', description: 'Code Llama - Optimized for coding' },
      ];

      const filtered = popularModels.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(query.toLowerCase()))
      );

      const results = [...filtered];
      if (query.trim() && !filtered.some(m => m.name.toLowerCase() === query.toLowerCase().trim())) {
        results.unshift({
          name: query.trim(),
          description: `Custom model: ${query.trim()} (will attempt to pull from Ollama library)`
        });
      }

      return {
        success: true,
        models: results.length > 0 ? results : popularModels.slice(0, 5)
      };
    } catch (error: any) {
      console.error('[OllamaService] Error searching models:', error);
      return { success: false, models: [] };
    }
  }

  async chatStream(
    prompt: string,
    options: OllamaChatOptions = {},
    onChunk?: (chunk: OllamaChunkData) => void
  ): Promise<void> {
    this.abortController = new AbortController();
    this.onChunkCallback = onChunk;
    this.taskCompleted = false;

    const model = options.model || 'llama3.2';

    if (this.activeModelName !== model) {
      console.log(`[OllamaService] Model ${model} not active, loading it...`);
      await this.runModel(model);
    }

    const messages: Message[] = [];
    const capabilities = this.modelCapabilities.get(model);
    const useNativeTools = capabilities ? capabilities.supportsTools : true;

    let systemContent = SYSTEM_INSTRUCTION;
    if (!useNativeTools) {
      systemContent += FALLBACK_TOOL_INSTRUCTION;
    }
    messages.push({ role: 'system', content: systemContent });

    if (options.conversationHistory) {
      for (const msg of options.conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Build context: SmartContext for the project directory + any explicitly selected files
    let contextStr = '';

    if (options.context?.project) {
      const isStartOfSession = !options.conversationHistory || options.conversationHistory.length < 2;
      const contextMode = options.context.contextMode || 'smart';

      if (isStartOfSession || contextMode === 'full') {
        console.log(`[OllamaService] Building SmartContext for: ${options.context.project} (mode: ${contextMode})`);
        try {
          // Wrap in a timeout so a slow/hanging SmartContext doesn't block the response
          const smartContext = new SmartContext(options.context.project, contextMode);
          const buildPromise = smartContext.buildContext();
          const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('SmartContext timeout after 15s')), 15000)
          );
          const projectSummary = await Promise.race([buildPromise, timeoutPromise]);
          contextStr += projectSummary + '\n\n';
          console.log(`[OllamaService] SmartContext built (${projectSummary.length} chars)`);
        } catch (err: any) {
          console.error('[OllamaService] SmartContext failed, falling back to path only:', err.message);
          contextStr += `Active Project: ${options.context.project}\n\n`;
        }
      } else {
        contextStr += `Active Project: ${options.context.project}\nUse tools (list_files, read_file, search_code) to explore the codebase as needed.\n\n`;
      }
    }

    if (options.context?.files && options.context.files.length > 0) {
      contextStr += '## Project Files:\n';
      for (const file of options.context.files) {
        contextStr += `### ${file.path}\n`;
        if (file.content) {
          contextStr += '```\n' + file.content + '\n```\n';
        }
      }
    }

    const userContent = contextStr ? `${contextStr}\n\nUser Query:\n${prompt}` : prompt;
    messages.push({ role: 'user', content: userContent });

    try {
      const flatTools = TOOL_DEFINITIONS[0].functionDeclarations;

      console.log(`[OllamaService] Starting chat stream with model: ${model} (Native tools: ${useNativeTools})`);

      let response;
      try {
        response = await this.ollama.chat({
          model,
          messages,
          stream: true,
          tools: flatTools as any,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          }
        });
      } catch (error: any) {
        // If the model doesn't support tools, update capabilities and retry without tools
        if (error.message && error.message.includes('does not support tools')) {
          console.warn(`[OllamaService] Model ${model} does not support native tools. Retrying without tools...`);
          this.modelCapabilities.set(model, { supportsTools: false });

          // Update system instruction for the retry
          messages[0].content = SYSTEM_INSTRUCTION + FALLBACK_TOOL_INSTRUCTION;

          response = await this.ollama.chat({
            model,
            messages,
            stream: true,
            options: {
              temperature: 0.7,
              top_p: 0.9,
            }
          });
        } else {
          throw error;
        }
      }

      let fullText = '';
      for await (const part of response) {
        if (this.abortController.signal.aborted) break;

        if (part.message?.content) {
          const content = part.message.content;
          fullText += content;
          this.sendChunk({ type: 'text', data: content });

          // Check for manual tool calls in the streamed text if native tools are not supported or not used
          if (!useNativeTools || !part.message.tool_calls) {
            await this.checkForManualToolCalls(fullText);
          }
        }

        if (part.message?.tool_calls) {
          for (const toolCall of part.message.tool_calls) {
            const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const functionName = toolCall.function?.name;
            const functionArgs = toolCall.function?.arguments || {};

            this.sendChunk({
              type: 'function_call',
              callId,
              name: functionName,
              data: functionArgs,
            });

            const result = await this.executeFunctionCall(functionName, functionArgs, callId);
            this.sendChunk({
              type: 'function_result',
              callId,
              name: functionName,
              data: result.response,
            });
          }
        }
      }

      this.sendChunk({ type: 'done' });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[OllamaService] Error in chatStream:', error);
        this.sendChunk({ type: 'error', data: error.message || String(error) });
      }
      this.sendChunk({ type: 'done' });
    }
  }

  /**
   * Look for manual tool calls in text like TOOL_CALL: function_name({"arg": "val"})
   */
  private async checkForManualToolCalls(text: string) {
    // We look for the pattern in the accumulated text
    // Only process the last one found to avoid double execution (though we should keep track of what we've processed)
    // For simplicity in a stream, we'll look for completed lines
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/TOOL_CALL:\s*(\w+)\s*\((.*)\)/);
      if (match) {
        const functionName = match[1];
        const argsStr = match[2];

        // Try to parse args as JSON
        try {
          const args = JSON.parse(argsStr);
          // Check if we already executed this in this session (basic check)
          // In a real implementation, we'd want a more robust way to track processed tool calls
          // For now, we'll rely on the model following the "one call per task" logic or similar

          // To prevent multiple executions of the same line as it's streamed:
          // We can use a property to track processed lines
          if (!(this as any)._processedLines) (this as any)._processedLines = new Set();
          if ((this as any)._processedLines.has(line)) continue;
          (this as any)._processedLines.add(line);

          const callId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          this.sendChunk({
            type: 'function_call',
            callId,
            name: functionName,
            data: args,
          });

          const result = await this.executeFunctionCall(functionName, args, callId);
          this.sendChunk({
            type: 'function_result',
            callId,
            name: functionName,
            data: result.response,
          });
        } catch (e) {
          // If not valid JSON, maybe it's just being streamed still
        }
      }
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.onChunkCallback = undefined;
    (this as any)._processedLines = new Set();
    this.sendChunk({ type: 'done' });
  }

  async listModels(): Promise<{ success: boolean; models: any[] }> {
    const installed = await this.listInstalledModels();
    return {
      success: true,
      models: installed.map(m => ({
        id: m.name,
        name: m.name,
        desc: `Installed locally (${(m.size / 1024 / 1024 / 1024).toFixed(2)} GB)`,
        limits: 'Local inference, no rate limits',
        provider: 'ollama',
        installed: true,
      })),
    };
  }

  getActiveModel(): string | null {
    return this.activeModelName;
  }
}
