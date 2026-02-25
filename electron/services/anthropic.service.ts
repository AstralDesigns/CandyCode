/**
 * Anthropic Service
 * Native integration with Anthropic API
 * Endpoint: https://api.anthropic.com/v1/messages
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

const SYSTEM_INSTRUCTION = `You are Candy, a friendly and autonomous coding assistant for CandyCode.

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

export interface AnthropicChatOptions {
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

export interface AnthropicChunkData {
  type: 'text' | 'function_call' | 'function_result' | 'error' | 'done';
  data?: any;
  callId?: string;
  name?: string;
}

/**
 * Convert Gemini-style tool definitions to Anthropic tools format
 */
function convertToAnthropicTools(geminiTools: any[]): any[] {
  const tools: any[] = [];
  for (const toolGroup of geminiTools) {
    const decls = toolGroup.functionDeclarations || [];
    for (const declaration of decls) {
      tools.push({
        name: declaration.name,
        description: declaration.description || '',
        input_schema: declaration.parameters || { type: 'object', properties: {}, required: [] }
      });
    }
  }
  return tools;
}

export class AnthropicService {
  private mainWindow: BrowserWindow | null = null;
  private cancelController: AbortController | null = null;
  private loopManager: AgenticLoopManager;
  private onChunkCallback: ((chunk: AnthropicChunkData) => void) | undefined = undefined;
  private baseUrl = 'https://api.anthropic.com/v1/messages';
  private taskCompleted = false;

  constructor() {
    this.loopManager = new AgenticLoopManager(30);
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private sendChunk(chunk: AnthropicChunkData) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('ai-backend:chunk', chunk);
    }
    if (this.onChunkCallback) {
      try {
        this.onChunkCallback(chunk);
      } catch (error) {
        console.error('[AnthropicService] Error in onChunk callback:', error);
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
      console.error(`[AnthropicService] ${error}`);
      return { name: functionName, response: { error } };
    }

    try {
      console.log(`[AnthropicService] Executing ${functionName} with args:`, args);
      
      let result;
      if (functionName === 'write_file' && this.mainWindow) {
        result = await func(args, this.mainWindow);
      } else {
        result = await func(args);
      }
      
      console.log(`[AnthropicService] Function ${functionName} result:`, result);

      if (functionName === 'task_complete') {
        this.taskCompleted = true;
        this.loopManager.markTaskCompleted();
      }

      return { name: functionName, response: result };
    } catch (error: any) {
      console.error(`[AnthropicService] Error executing ${functionName}:`, error);
      return { name: functionName, response: { error: error.message || String(error) } };
    }
  }

  async chatStream(
    prompt: string,
    options: AnthropicChatOptions,
    onChunk?: (chunk: AnthropicChunkData) => void
  ): Promise<void> {
    this.onChunkCallback = onChunk;
    this.taskCompleted = false;
    
    // LICENSE CHECK: Set limits based on License Tier
    const tier = options.licenseTier || (options.isPro ? 'pro' : 'free');
    
    // Define limits
    const allLimits = {
        free: { maxLoops: 50, allowSmartContext: false, allowFullContext: false },
        standard: { maxLoops: 15, allowSmartContext: true, allowFullContext: false }, // Kept for type compatibility
        pro: { maxLoops: Infinity, allowSmartContext: true, allowFullContext: true }
    };
    const limits = allLimits[tier] || { maxLoops: 50, allowSmartContext: false, allowFullContext: false };
    
    // Update loop manager with the new limit
    this.loopManager = new AgenticLoopManager(limits.maxLoops);
    this.loopManager.setIsActive(true);
    
    // Fresh AbortController for each request
    this.cancelController = new AbortController();
    const timeoutId = setTimeout(() => this.cancelController?.abort(), 60000); // 60s timeout

    if (!options.apiKey) {
      this.sendChunk({ type: 'error', data: 'No Anthropic API key provided. Please set it in Settings.' });
      this.sendChunk({ type: 'done' });
      clearTimeout(timeoutId);
      return;
    }

    const model = options.model || 'claude-3-5-sonnet-20240620';
    const messages: any[] = [];

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
        console.log(`[AnthropicService] Building project context with mode: ${selectedContextMode}`);
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
        console.log(`[AnthropicService] Iteration ${this.loopManager.getCurrentIteration()}/${limits.maxLoops}`);

        const requestBody = {
          model,
          messages,
          system: SYSTEM_INSTRUCTION,
          tools: convertToAnthropicTools(TOOL_DEFINITIONS),
          max_tokens: 4096,
          stream: true
        };

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'x-api-key': options.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' // Enable extended output for Sonnet 3.5 if supported
          },
          body: JSON.stringify(requestBody),
          signal: this.cancelController.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
        }

        // Process streaming response (SSE)
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          this.sendChunk({ type: 'error', data: 'No response body reader available' });
          this.sendChunk({ type: 'done' });
          clearTimeout(timeoutId);
          return;
        }

        let buffer = '';
        let currentMessageContent = '';
        let currentToolUse: { id: string; name: string; input: string } | null = null;
        let processedToolCallsThisIteration = false;
        
        // Track the assistant's response components for history
        const assistantResponseBlocks: any[] = [];
        const userToolResults: any[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const event = JSON.parse(dataStr);
              
              if (event.type === 'content_block_start') {
                if (event.content_block.type === 'tool_use') {
                   currentToolUse = {
                     id: event.content_block.id,
                     name: event.content_block.name,
                     input: ''
                   };
                } else if (event.content_block.type === 'text') {
                   // Text block starting
                }
              } else if (event.type === 'content_block_delta') {
                 if (event.delta.type === 'text_delta') {
                   const text = event.delta.text;
                   currentMessageContent += text;
                   this.sendChunk({ type: 'text', data: text });
                 } else if (event.delta.type === 'input_json_delta') {
                   if (currentToolUse) {
                     currentToolUse.input += event.delta.partial_json;
                   }
                 }
              } else if (event.type === 'content_block_stop') {
                 if (currentToolUse) {
                   // Tool use block finished
                   try {
                     const args = JSON.parse(currentToolUse.input);
                     const callId = currentToolUse.id;
                     const name = currentToolUse.name;
                     
                     this.sendChunk({ type: 'function_call', name, data: args, callId });
                     
                     // Store tool use in assistant blocks
                     assistantResponseBlocks.push({
                        type: 'tool_use',
                        id: callId,
                        name: name,
                        input: args
                     });

                     const result = await this.executeFunctionCall(name, args, callId);
                     
                     this.sendChunk({ type: 'function_result', name: result.name, data: result.response, callId });
                     
                     // Store result
                     userToolResults.push({
                        type: 'tool_result',
                        tool_use_id: callId,
                        content: JSON.stringify(result.response)
                     });
                     
                     processedToolCallsThisIteration = true;
                     currentToolUse = null;
                   } catch (parseError) {
                     console.error('[AnthropicService] Failed to parse tool arguments:', parseError);
                     currentToolUse = null;
                   }
                 }
              } else if (event.type === 'message_stop') {
                 // Message finished
              }
            } catch (e) {
               // ignore
            }
          }
        }
        
        // After stream is done for this iteration, update history
        const assistantContent: any[] = [];
        if (currentMessageContent) {
           assistantContent.push({ type: 'text', text: currentMessageContent });
        }
        assistantContent.push(...assistantResponseBlocks);
        
        if (assistantContent.length > 0) {
            messages.push({ role: 'assistant', content: assistantContent });
        }
        
        // If we executed tools, add the results as a user message for next turn
        if (processedToolCallsThisIteration && userToolResults.length > 0) {
            messages.push({ role: 'user', content: userToolResults });
        }

        // Check if task is complete
        if (this.loopManager.getTaskCompleted()) {
           this.sendChunk({ type: 'done' });
           clearTimeout(timeoutId);
           return;
        }
        
        // If no tool calls processed and not complete, stop to avoid infinite text loop
        if (!processedToolCallsThisIteration) {
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
        console.error('[AnthropicService] Error in chatStream:', error);
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
        { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet", desc: "Highest level of intelligence and capability", limits: "Requires Anthropic API Key", provider: "anthropic", recommended: true },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus", desc: "Powerful model for highly complex tasks", limits: "Requires Anthropic API Key", provider: "anthropic", recommended: false },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", desc: "Fastest and most compact model", limits: "Requires Anthropic API Key", provider: "anthropic", recommended: false }
      ]
    };
  }
}
