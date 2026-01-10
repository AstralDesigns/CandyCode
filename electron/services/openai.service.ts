/**
 * OpenAI Service
 * Native integration with OpenAI API
 * Endpoint: https://api.openai.com/v1/chat/completions
 */
import { BrowserWindow } from 'electron';
import { AgenticLoopManager } from './agentic-loop.service';
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

const SYSTEM_INSTRUCTION = `You are Alpha, a friendly and autonomous coding assistant for AlphaStudio.

AGENTIC BEHAVIOR:
- Use function calls to execute actions - call functions directly, don't describe them
- When asked to create/write files, IMMEDIATELY call write_file function
- Work autonomously: call functions sequentially without waiting for intermediate responses
- For file operations: use read_file() to understand full context, or peek_file() for summary
- Provide brief, helpful text responses throughout your work to keep the user informed
- Text and function calls can interleave - stream brief updates as you work
- After completing all actions, provide a summary and call task_complete

CRITICAL RULES - FILE OPERATIONS & APPROVAL WORKFLOW:
- **MANDATORY**: When user asks to generate/create/write files, you MUST call write_file() function
- **REQUIRED**: Call write_file(path='~/filename.md', content='...') immediately when asked to create files
- **FILE APPROVAL**: When you call write_file(), the file change is created as a pending diff that requires user approval
- **WAIT FOR APPROVALS**: Before running tests (run_tests) or commands (execute_command) that depend on file changes, the system will automatically wait for all pending file approvals
- **REJECTION HANDLING**: If a file change is rejected, you will receive a notification. Continue with next steps - no need to query user unless you need clarification
- **CONTINUE WORKING**: While waiting for approvals, you can continue with other tasks that don't depend on the pending files
- For multiple files, call write_file() multiple times in sequence - they can all be pending approval simultaneously
- When modifying existing files, use read_file() to understand context
- After completing all actions, provide a summary in markdown format and call task_complete
- When task is fully complete, call task_complete(summary='...') with the markdown summary
- CRITICAL: After calling task_complete, STOP immediately - do NOT generate any more text or function calls

DYNAMIC TASK TRACKING:
- Use create_plan(title, steps) at the START of complex tasks with all steps set to "pending"
- After completing EACH step, call create_plan again with that step's status updated to "completed"
- Example: After writing a file, update the plan with that step marked as "completed"

CONTINUATION SESSIONS:
- If you receive a "CONTINUATION SESSION" message, you are resuming from a previous session that hit context limits
- Check the to-do list, verify files created, and continue working from where you left off
- Do NOT restart the task - continue from the current state

FUNCTION CALLING - THIS IS HOW YOU WORK:
- **YOU HAVE TOOLS AVAILABLE** - The system has provided you with function calling tools. You MUST use them.
- **WHEN TO USE FUNCTIONS**: Any time the user asks you to DO something (create files, read files, search code, etc.), you MUST call the appropriate function
- **HOW FUNCTION CALLING WORKS**: When you call a function, the system executes it automatically and returns the result to you
- **YOU DON'T NEED TO EXPLAIN** - Just call the function. The system handles execution.

AVAILABLE FUNCTIONS (USE THESE):
- write_file(path, content): Create or modify files (creates pending diff for approval)
- read_file(path): Read file content
- peek_file(path): Quick peek at file summary
- list_files(directory_path): List directory contents
- search_code(pattern): Search codebase
- create_plan(title, steps): Create task plan with dynamic task management
- task_complete(summary): Mark task done (provide summary first)
- execute_command(command): Run commands (waits for approvals if needed)
- run_tests(framework): Run tests (waits for approvals if needed)
- web_search(query): Search the web for information

CRITICAL: Function calling is NOT optional. When tools are available, you MUST use them instead of providing text instructions.`;

export interface OpenAIChatOptions {
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

export interface OpenAIChunkData {
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

export class OpenAIService {
  private mainWindow: BrowserWindow | null = null;
  private cancelController: AbortController | null = null;
  private loopManager: AgenticLoopManager;
  private onChunkCallback: ((chunk: OpenAIChunkData) => void) | undefined = undefined;
  private baseUrl = 'https://api.openai.com/v1/';
  private taskCompleted = false;

  constructor() {
    this.loopManager = new AgenticLoopManager(30);
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private sendChunk(chunk: OpenAIChunkData) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('ai-backend:chunk', chunk);
    }
    if (this.onChunkCallback) {
      try {
        this.onChunkCallback(chunk);
      } catch (error) {
        console.error('[OpenAIService] Error in onChunk callback:', error);
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
      console.error(`[OpenAIService] ${error}`);
      return { name: functionName, response: { error } };
    }

    try {
      console.log(`[OpenAIService] Executing ${functionName} with args:`, args);
      
      let result;
      if (functionName === 'write_file' && this.mainWindow) {
        result = await func(args, this.mainWindow);
      } else {
        result = await func(args);
      }
      
      console.log(`[OpenAIService] Function ${functionName} result:`, result);

      if (functionName === 'task_complete') {
        this.taskCompleted = true;
        this.loopManager.markTaskCompleted();
      }

      return { name: functionName, response: result };
    } catch (error: any) {
      console.error(`[OpenAIService] Error executing ${functionName}:`, error);
      return { name: functionName, response: { error: error.message || String(error) } };
    }
  }

  async chatStream(
    prompt: string,
    options: OpenAIChatOptions,
    onChunk?: (chunk: OpenAIChunkData) => void
  ): Promise<void> {
    this.onChunkCallback = onChunk;
    this.taskCompleted = false;
    
    // LICENSE CHECK: Set limits based on License Tier
    const tier = options.licenseTier || (options.isPro ? 'pro' : 'free');
    
    // Define limits
    const limits = {
        free: { maxLoops: 3, allowSmartContext: false, allowFullContext: false },
        standard: { maxLoops: 15, allowSmartContext: true, allowFullContext: false },
        pro: { maxLoops: 50, allowSmartContext: true, allowFullContext: true }
    }[tier] || { maxLoops: 3, allowSmartContext: false, allowFullContext: false };
    
    // Update loop manager with the new limit
    this.loopManager = new AgenticLoopManager(limits.maxLoops);
    this.loopManager.setIsActive(true);
    
    // Fresh AbortController for each request
    this.cancelController = new AbortController();
    const timeoutId = setTimeout(() => this.cancelController?.abort(), 60000); // 60s timeout

    if (!options.apiKey) {
      this.sendChunk({ type: 'error', data: 'No OpenAI API key provided. Please set it in Settings.' });
      this.sendChunk({ type: 'done' });
      clearTimeout(timeoutId);
      return;
    }

    const model = options.model || 'gpt-4o';
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
      
      // LICENSE CHECK: Downgrade context mode if not allowed
      let selectedContextMode = options.context.contextMode || 'smart';
      
      // Downgrade logic based on tier capabilities
      if (!limits.allowFullContext && selectedContextMode === 'full') {
          selectedContextMode = limits.allowSmartContext ? 'smart' : 'minimal';
      } else if (!limits.allowSmartContext && selectedContextMode === 'smart') {
          selectedContextMode = 'minimal';
      }
      
      // Notify user if downgraded
      if (selectedContextMode !== options.context.contextMode) {
           this.sendChunk({ 
             type: 'text', 
             data: `> **License Limit:** Context downgraded to "${selectedContextMode}". Upgrade your license for better context awareness.\n\n` 
           });
      }

      if (isStartOfSession || selectedContextMode === 'full') {
        console.log(`[OpenAIService] Building project context with mode: ${selectedContextMode}`);
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
          this.sendChunk({ type: 'done' });
          clearTimeout(timeoutId);
          return;
        }

        this.loopManager.incrementIteration();
        console.log(`[OpenAIService] Iteration ${this.loopManager.getCurrentIteration()}/${limits.maxLoops}`);

        const requestBody = {
          model,
          messages,
          tools: convertToOpenAITools(TOOL_DEFINITIONS),
          tool_choice: 'auto',
          stream: true,
          temperature: 0.7,
          max_tokens: 4096
        };

        const url = `${this.baseUrl}chat/completions`;
        let response: Response | null = null;
        let lastError = '';

        try {
            response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`,
              },
              body: JSON.stringify(requestBody),
              signal: this.cancelController.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
            }

        } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
              throw fetchError;
            }
            lastError = fetchError.message || String(fetchError);
            this.sendChunk({ type: 'error', data: `Request failed: ${lastError}` });
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

        let buffer = '';
        let fullText = '';
        let currentToolCalls: Record<number, { id: string; name: string; arguments: string }> = {};
        let processedToolCallsThisIteration = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

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
              if (finishReason === 'tool_calls' || finishReason === 'stop' || finishReason === 'length') {
                // Process accumulated tool calls
                const toolCallEntries = Object.values(currentToolCalls).filter(tc => tc.name && tc.arguments);
                
                if (toolCallEntries.length > 0) {
                  processedToolCallsThisIteration = true;
                  
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
                      console.error('[OpenAIService] Failed to parse tool arguments:', parseError);
                    }
                  }

                  // Reset for next iteration
                  currentToolCalls = {};
                  fullText = '';
                } else if (finishReason === 'stop' && fullText && !this.taskCompleted) {
                  // Model finished with text but no tool calls - add message to history
                   messages.push({ role: 'assistant', content: fullText });
                   // The loop will exit because no tool calls were made, unless we force continuation
                   // For now, standard behavior is to stop if no tool calls
                   fullText = '';
                }
              }
            } catch (parseError) {
              // Ignore JSON parse errors for partial chunks
            }
          }
        }

        // Continue loop if tool calls were processed or task not completed
        if (!processedToolCallsThisIteration && !fullText && this.taskCompleted) {
          console.log('[OpenAIService] Task completed, ending loop');
          break;
        }
        
        // If no tool calls and no task completion, we should stop
        if (!processedToolCallsThisIteration && !this.taskCompleted) {
             break;
        }
      }

      // If we exit the loop without completion, notify the user about the limit
      if (!this.loopManager.getTaskCompleted() && tier !== 'pro' && this.loopManager.getCurrentIteration() >= limits.maxLoops) {
          this.sendChunk({ 
              type: 'text', 
              data: `\n\n**License Limit Reached:** The autonomous agent has stopped after ${limits.maxLoops} iterations. Upgrade to a higher tier for extended autonomous coding.` 
          });
      }

      this.sendChunk({ type: 'done' });
      clearTimeout(timeoutId);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[OpenAIService] Error in chatStream:', error);
        this.sendChunk({ type: 'error', data: error.message || String(error) });
      }
      this.sendChunk({ type: 'done' });
      clearTimeout(timeoutId);
    }
  }

  cancel(): void {
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
        { id: "gpt-4o", name: "GPT-4o", desc: "Most advanced, multimodal, 128k context", limits: "Requires OpenAI API Key", provider: "openai", recommended: true },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", desc: "High capability model, 128k context", limits: "Requires OpenAI API Key", provider: "openai", recommended: false },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", desc: "Fast, cost-effective", limits: "Requires OpenAI API Key", provider: "openai", recommended: false }
      ]
    };
  }
}