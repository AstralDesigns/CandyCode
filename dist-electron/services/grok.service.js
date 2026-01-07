"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrokService = void 0;
const tool_definitions_1 = require("./tool-definitions");
const file_operations_service_1 = require("./file-operations.service");
const smart_context_service_1 = require("./smart-context.service");
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
/**
 * Convert Gemini-style tool definitions to OpenAI tools format
 */
function convertToOpenAITools(geminiTools) {
    const tools = [];
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
class GrokService {
    mainWindow = null;
    cancelController = null;
    onChunkCallback = undefined;
    baseUrl = 'https://api.x.ai/v1/';
    taskCompleted = false;
    constructor() { }
    setMainWindow(window) {
        this.mainWindow = window;
    }
    sendChunk(chunk) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('ai-backend:chunk', chunk);
        }
        if (this.onChunkCallback) {
            try {
                this.onChunkCallback(chunk);
            }
            catch (error) {
                console.error('[GrokService] Error in onChunk callback:', error);
            }
        }
    }
    getToolFunctions() {
        return {
            read_file: file_operations_service_1.readFile,
            write_file: file_operations_service_1.writeFile,
            list_files: file_operations_service_1.listFiles,
            peek_file: file_operations_service_1.peekFile,
            search_code: file_operations_service_1.searchCode,
            create_plan: file_operations_service_1.createPlan,
            task_complete: file_operations_service_1.taskComplete,
            execute_command: file_operations_service_1.executeCommand,
            run_tests: file_operations_service_1.runTests,
            web_search: file_operations_service_1.searchWeb,
        };
    }
    async executeFunctionCall(functionName, args, callId) {
        const toolFunctions = this.getToolFunctions();
        const func = toolFunctions[functionName];
        if (!func) {
            const error = `Unknown function: ${functionName}`;
            console.error(`[GrokService] ${error}`);
            return { name: functionName, response: { error } };
        }
        try {
            console.log(`[GrokService] Executing ${functionName} with args:`, args);
            let result;
            if (functionName === 'write_file' && this.mainWindow) {
                result = await func(args, this.mainWindow);
            }
            else {
                result = await func(args);
            }
            console.log(`[GrokService] Function ${functionName} result:`, result);
            if (functionName === 'task_complete') {
                this.taskCompleted = true;
            }
            return { name: functionName, response: result };
        }
        catch (error) {
            console.error(`[GrokService] Error executing ${functionName}:`, error);
            return { name: functionName, response: { error: error.message || String(error) } };
        }
    }
    extractWaitTime(errorText) {
        // Try to extract wait time from error messages like "try again in 1.266s"
        const match = errorText.match(/try again in (\d+(?:\.\d+)?)/i);
        if (match) {
            return Math.ceil(parseFloat(match[1]) * 1000) + 500; // Add 500ms buffer
        }
        return null;
    }
    async chatStream(prompt, options, onChunk) {
        this.onChunkCallback = onChunk;
        this.taskCompleted = false;
        // Fresh AbortController for each request
        this.cancelController = new AbortController();
        const timeoutId = setTimeout(() => this.cancelController?.abort(), 60000); // 60s timeout
        if (!options.apiKey) {
            this.sendChunk({ type: 'error', data: 'No Grok API key provided. Please set it in Settings.' });
            this.sendChunk({ type: 'done' });
            clearTimeout(timeoutId);
            return;
        }
        const model = options.model || 'grok-4.1-fast';
        const messages = [];
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
            const selectedContextMode = options.context.contextMode || 'smart';
            if (isStartOfSession || selectedContextMode === 'full') {
                console.log(`[GrokService] Building project context with mode: ${selectedContextMode}`);
                const smartContext = new smart_context_service_1.SmartContext(options.context.project, selectedContextMode);
                const projectSummary = await smartContext.buildContext();
                contextText += projectSummary + '\n\n';
            }
            else {
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
        const maxIterations = 30;
        let iteration = 0;
        try {
            while (iteration < maxIterations && !this.taskCompleted) {
                if (this.cancelController?.signal.aborted) {
                    this.sendChunk({ type: 'done' });
                    clearTimeout(timeoutId);
                    return;
                }
                iteration++;
                console.log(`[GrokService] Iteration ${iteration}/${maxIterations}`);
                const requestBody = {
                    model,
                    messages,
                    tools: convertToOpenAITools(tool_definitions_1.TOOL_DEFINITIONS),
                    tool_choice: 'auto',
                    stream: true,
                    temperature: 0.7,
                    max_tokens: 32768
                };
                const url = `${this.baseUrl}chat/completions`;
                let response = null;
                let lastError = '';
                // Retry logic with exponential backoff for rate limits
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        console.log(`[GrokService] Request attempt ${attempt + 1}/3`);
                        response = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${options.apiKey}`,
                            },
                            body: JSON.stringify(requestBody),
                            signal: this.cancelController.signal,
                        });
                        if (response.ok) {
                            break;
                        }
                        // Handle rate limit with retry
                        if (response.status === 429 && attempt < 2) {
                            const errorText = await response.text();
                            lastError = errorText;
                            const waitTime = this.extractWaitTime(errorText) || (attempt + 1) * 2000;
                            console.log(`[GrokService] Rate limited, waiting ${waitTime}ms before retry`);
                            this.sendChunk({ type: 'text', data: `Rate limit hit. Retrying in ${Math.ceil(waitTime / 1000)}s...` });
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                            continue;
                        }
                        // Non-retryable error
                        lastError = await response.text();
                        break;
                    }
                    catch (fetchError) {
                        lastError = fetchError.message || String(fetchError);
                        if (fetchError.name === 'AbortError') {
                            throw fetchError;
                        }
                        if (attempt < 2) {
                            console.log(`[GrokService] Fetch error, retrying: ${lastError}`);
                            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
                            continue;
                        }
                    }
                }
                if (!response || !response.ok) {
                    this.sendChunk({ type: 'error', data: `Grok API error (${response?.status || 'fetch failed'}): ${lastError}` });
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
                let currentToolCalls = {};
                let processedToolCallsThisIteration = false;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]')
                            continue;
                        if (!trimmed.startsWith('data: '))
                            continue;
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
                                    if (toolCall.id)
                                        currentToolCalls[index].id = toolCall.id;
                                    if (toolCall.function?.name)
                                        currentToolCalls[index].name = toolCall.function.name;
                                    if (toolCall.function?.arguments)
                                        currentToolCalls[index].arguments += toolCall.function.arguments;
                                }
                            }
                            // Handle finish with tool_calls
                            if (finishReason === 'tool_calls' || finishReason === 'stop') {
                                // Process accumulated tool calls
                                const toolCallEntries = Object.values(currentToolCalls).filter(tc => tc.name && tc.arguments);
                                if (toolCallEntries.length > 0) {
                                    processedToolCallsThisIteration = true;
                                    // Add assistant message with tool calls
                                    const assistantMsg = { role: 'assistant', content: fullText || null };
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
                                        }
                                        catch (parseError) {
                                            console.error('[GrokService] Failed to parse tool arguments:', parseError);
                                        }
                                    }
                                    // Reset for next iteration
                                    currentToolCalls = {};
                                    fullText = '';
                                }
                                else if (finishReason === 'stop' && fullText && !this.taskCompleted) {
                                    // Model finished with text but no tool calls - add continuation prompt
                                    messages.push({ role: 'assistant', content: fullText });
                                    messages.push({
                                        role: 'user',
                                        content: 'Continue with the task. Use the available tools to make progress. If done, call task_complete.'
                                    });
                                    fullText = '';
                                }
                            }
                        }
                        catch (parseError) {
                            // Ignore JSON parse errors for partial chunks
                        }
                    }
                }
                // Continue loop if tool calls were processed or task not completed
                if (!processedToolCallsThisIteration && !fullText && this.taskCompleted) {
                    console.log('[GrokService] Task completed, ending loop');
                    break;
                }
                if (processedToolCallsThisIteration) {
                    console.log('[GrokService] Tool calls processed, continuing loop...');
                }
            }
            this.sendChunk({ type: 'done' });
            clearTimeout(timeoutId);
        }
        catch (error) {
            if (error.name !== 'AbortError') {
                console.error('[GrokService] Error in chatStream:', error);
                this.sendChunk({ type: 'error', data: error.message || String(error) });
            }
            this.sendChunk({ type: 'done' });
            clearTimeout(timeoutId);
        }
    }
    cancel() {
        if (this.cancelController) {
            this.cancelController.abort();
        }
        this.onChunkCallback = undefined;
        this.sendChunk({ type: 'done' });
    }
    async listModels() {
        return {
            success: true,
            models: [
                { id: "grok-4.1-fast", name: "Grok 4.1 Fast", desc: "Optimized for tool-calling and agentic workflows, 2M token context", limits: "Better rate limits than Groq, optimized for agents", provider: "grok", recommended: true },
                { id: "grok-4.1", name: "Grok 4.1", desc: "Latest Grok model with enhanced reasoning and multimodal understanding", limits: "Better rate limits than Groq", provider: "grok", recommended: false },
                { id: "grok-beta", name: "Grok Beta", desc: "Beta model with extended context (legacy)", limits: "Better rate limits than Groq", provider: "grok", recommended: false }
            ]
        };
    }
}
exports.GrokService = GrokService;
//# sourceMappingURL=grok.service.js.map