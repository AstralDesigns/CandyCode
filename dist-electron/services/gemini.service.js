"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const agentic_loop_service_1 = require("./agentic-loop.service");
const file_operations_service_1 = require("./file-operations.service");
const tool_definitions_1 = require("./tool-definitions");
const smart_context_service_1 = require("./smart-context.service");
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
class GeminiService {
    mainWindow = null;
    cancelController = null;
    loopManager;
    onChunkCallback = undefined;
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    filesCreated = new Set();
    filesWriting = new Map();
    todoList = [];
    lastFileContent = null;
    continuationCount = 0;
    maxContinuations = 10;
    originalUserInput = '';
    constructor() {
        this.loopManager = new agentic_loop_service_1.AgenticLoopManager(30);
    }
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
                console.error('[GeminiService] Error in onChunk callback:', error);
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
    getStatusMessageForFunction(functionName, args) {
        switch (functionName) {
            case 'write_file':
                return `Creating file ${args.path}...`;
            case 'read_file':
                return `Reading file ${args.path}...`;
            case 'peek_file':
                return `Peeking at file ${args.path}...`;
            case 'list_files':
                return `Listing files in ${args.directory_path}...`;
            case 'search_code':
                return `Searching codebase for "${args.pattern}"...`;
            case 'create_plan':
                return `Creating plan: ${args.title}...`;
            case 'execute_command':
                return `Executing command: ${args.command}...`;
            case 'run_tests':
                return `Running tests...`;
            default:
                return null;
        }
    }
    async checkPendingApprovals() {
        if (!this.mainWindow)
            return false;
        try {
            const result = await this.mainWindow.webContents.executeJavaScript(`
        (() => {
          const store = window.__ALPHASTUDIO_STORE__;
          if (!store) return false;
          const state = store.getState();
          return state.pendingDiffs && state.pendingDiffs.size > 0;
        })()
      `);
            return result === true;
        }
        catch {
            return false;
        }
    }
    async waitForApprovals(maxWait = 300000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
            const hasPending = await this.checkPendingApprovals();
            if (!hasPending) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    async executeFunctionCall(functionName, args, callId, collectedFunctionResults) {
        const toolFunctions = this.getToolFunctions();
        let func = toolFunctions[functionName];
        if (!func) {
            const error = `Unknown function: ${functionName}`;
            console.error(`[GeminiService] ${error}`);
            collectedFunctionResults.push({ name: functionName, response: { error } });
            this.sendChunk({ type: 'function_result', name: functionName, data: { error }, callId });
            return;
        }
        const dependentOperations = ['run_tests', 'execute_command'];
        if (dependentOperations.includes(functionName)) {
            const hasPending = await this.checkPendingApprovals();
            if (hasPending) {
                this.sendChunk({ type: 'text', data: 'Waiting for file approvals before proceeding...' });
                await this.waitForApprovals();
            }
        }
        try {
            console.log(`[GeminiService] Executing ${functionName} with args:`, args);
            let result;
            if (functionName === 'write_file' && this.mainWindow) {
                result = await func(args, this.mainWindow);
            }
            else {
                result = await func(args);
            }
            console.log(`[GeminiService] Function ${functionName} result:`, result);
            if (functionName === 'write_file' && result.file_path && !result.error) {
                this.filesCreated.add(result.file_path);
                if (result.content || result.modified) {
                    this.lastFileContent = {
                        path: result.file_path,
                        content: result.content || result.modified || ''
                    };
                }
            }
            if (functionName === 'create_plan' && result.steps) {
                this.todoList = result.steps.map((step, index) => ({
                    id: step.id || String(index + 1),
                    description: step.description || '',
                    status: step.status || 'pending',
                    order: step.order || index + 1
                }));
            }
            collectedFunctionResults.push({ name: functionName, response: result });
            this.sendChunk({ type: 'function_result', name: functionName, data: result, callId });
            if (functionName === 'task_complete') {
                this.loopManager.markTaskCompleted();
            }
        }
        catch (error) {
            console.error(`[GeminiService] Error executing ${functionName}:`, error);
            const errorResult = { error: error.message || String(error) };
            collectedFunctionResults.push({ name: functionName, response: errorResult });
            this.sendChunk({ type: 'function_result', name: functionName, data: errorResult, callId });
        }
    }
    async chatStream(prompt, options, onChunk, continuationState) {
        this.onChunkCallback = onChunk;
        if (continuationState) {
            this.originalUserInput = continuationState.userInput;
            this.filesCreated = new Set(continuationState.filesCreated);
            this.todoList = continuationState.todoList || [];
            this.lastFileContent = continuationState.lastFileContent || null;
            this.continuationCount++;
        }
        else {
            this.loopManager.reset();
            this.filesCreated.clear();
            this.filesWriting.clear();
            this.todoList = [];
            this.lastFileContent = null;
            this.continuationCount = 0;
            this.originalUserInput = prompt;
        }
        this.loopManager.setIsActive(true);
        this.cancelController = new AbortController();
        if (!options.apiKey) {
            this.sendChunk({ type: 'error', data: 'No Gemini API key provided. Please set it in Settings.' });
            this.sendChunk({ type: 'done' });
            return;
        }
        const model = options.model || 'gemini-2.5-flash';
        const contents = [];
        if (continuationState) {
            const continuationPrompt = this.buildContinuationPrompt(continuationState, options);
            contents.push({
                role: 'user',
                parts: [{ text: continuationPrompt }]
            });
            contents.push({
                role: 'model',
                parts: [{ text: "I'll continue from where we left off. Let me check the current state and proceed." }]
            });
            this.sendChunk({ type: 'continuation', data: 'Continuing session...' });
        }
        if (options.conversationHistory) {
            for (const msg of options.conversationHistory) {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }],
                });
            }
        }
        if (!continuationState) {
            let contextText = '';
            // BUILD SMART CONTEXT IF PROJECT IS ACTIVE
            if (options.context?.project) {
                const isStartOfSession = !options.conversationHistory || options.conversationHistory.length < 2;
                const selectedContextMode = options.context.contextMode || 'smart';
                if (isStartOfSession || selectedContextMode === 'full') {
                    console.log(`[GeminiService] Building project context with mode: ${selectedContextMode}`);
                    const smartContext = new smart_context_service_1.SmartContext(options.context.project, selectedContextMode);
                    const projectSummary = await smartContext.buildContext();
                    contextText += projectSummary + '\n\n';
                }
                else {
                    // Optimization: Only send project tree/path and rely on tools for subsequent messages
                    contextText += `Active Project: ${options.context.project}\nUse tools (list_files, read_file, search_code) to explore the codebase as needed.\n\n`;
                }
            }
            if (options.context?.files && options.context.files.length > 0) {
                contextText += 'User-Selected Context Files:\n';
                contextText += options.context.files
                    .map(f => `File: ${f.path}\n${f.content || ''}`)
                    .join('\n\n');
                contextText += '\n\n';
            }
            contents.push({
                role: 'user',
                parts: [{ text: contextText + prompt }],
            });
        }
        try {
            while (this.loopManager.shouldContinueLoop()) {
                if (this.cancelController?.signal.aborted) {
                    this.sendChunk({ type: 'done' });
                    return;
                }
                this.loopManager.incrementIteration();
                const generationConfig = {
                    temperature: 0.7,
                    maxOutputTokens: 65536,
                    topP: 0.95
                };
                // Enable thinking mode for Gemini 3 models
                if (model.includes('gemini-3')) {
                    generationConfig.thinkingConfig = {
                        thinkingBudget: 8192
                    };
                }
                const requestBody = {
                    contents: contents,
                    generationConfig: generationConfig,
                    tools: tool_definitions_1.TOOL_DEFINITIONS,
                    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                    toolConfig: { functionCallingConfig: { mode: 'AUTO' } }
                };
                const url = `${this.baseUrl}/models/${model}:streamGenerateContent?key=${options.apiKey}`;
                let response;
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                        signal: this.cancelController.signal,
                    });
                }
                catch (fetchError) {
                    if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
                        const errorInfo = { type: 'TIMEOUT', message: 'Request timed out (180s). Continuing with new session...' };
                        return this.handleContinuation(prompt, options, errorInfo);
                    }
                    throw fetchError;
                }
                if (!response.ok) {
                    const errorText = await response.text();
                    const errorInfo = this.parseError(response.status, errorText);
                    if (errorInfo.type === 'CONTEXT_LIMIT' || errorInfo.type === 'TIMEOUT') {
                        return this.handleContinuation(prompt, options, errorInfo);
                    }
                    if (errorInfo.type === 'RATE_LIMIT') {
                        this.sendChunk({ type: 'error', data: errorInfo.message });
                        this.sendChunk({ type: 'text', data: 'Waiting 65 seconds for rate limit...' });
                        await new Promise(resolve => setTimeout(resolve, 65000));
                        this.sendChunk({ type: 'text', data: 'Resuming...' });
                        continue;
                    }
                    throw new Error(errorInfo.message);
                }
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                if (!reader)
                    throw new Error('No response body reader available');
                let buffer = '';
                let fullText = '';
                let functionCalls = [];
                let originalFcParts = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    let startIdx = buffer.indexOf('{');
                    while (startIdx !== -1) {
                        let endIdx = -1;
                        let depth = 0;
                        for (let i = startIdx; i < buffer.length; i++) {
                            if (buffer[i] === '{')
                                depth++;
                            else if (buffer[i] === '}')
                                depth--;
                            if (depth === 0) {
                                endIdx = i;
                                break;
                            }
                        }
                        if (endIdx !== -1) {
                            const jsonStr = buffer.substring(startIdx, endIdx + 1);
                            try {
                                const item = JSON.parse(jsonStr);
                                this.processCandidate(item, (text) => {
                                    fullText += text;
                                    this.sendChunk({ type: 'text', data: text });
                                }, (fc, originalPart) => {
                                    functionCalls.push(fc);
                                    if (originalPart) {
                                        originalFcParts.push(originalPart);
                                    }
                                    else {
                                        originalFcParts.push({ functionCall: fc });
                                    }
                                });
                            }
                            catch (e) { }
                            buffer = buffer.substring(endIdx + 1);
                            startIdx = buffer.indexOf('{');
                        }
                        else {
                            break;
                        }
                    }
                }
                const modelParts = [];
                if (fullText)
                    modelParts.push({ text: fullText });
                if (originalFcParts.length > 0) {
                    modelParts.push(...originalFcParts);
                }
                contents.push({ role: 'model', parts: modelParts });
                if (functionCalls.length === 0) {
                    this.sendChunk({ type: 'done' });
                    return;
                }
                const functionResponses = [];
                for (const fc of functionCalls) {
                    const callId = `${fc.name}_${Date.now()}`;
                    // Status messages are now handled by ChatPanel based on function_call chunks
                    this.sendChunk({ type: 'function_call', name: fc.name, data: fc.args, callId });
                    const collectedResults = [];
                    await this.executeFunctionCall(fc.name, fc.args, callId, collectedResults);
                    if (collectedResults.length > 0) {
                        functionResponses.push({
                            name: fc.name,
                            response: { result: collectedResults[0].response }
                        });
                    }
                }
                contents.push({
                    role: 'user',
                    parts: functionResponses.map(fr => ({ functionResponse: fr }))
                });
                if (this.loopManager.getTaskCompleted()) {
                    this.sendChunk({ type: 'done' });
                    return;
                }
            }
            this.sendChunk({ type: 'done' });
        }
        catch (error) {
            console.error('[GeminiService] Error in chatStream:', error);
            this.sendChunk({ type: 'error', data: error.message || String(error) });
            this.sendChunk({ type: 'done' });
        }
    }
    processCandidate(data, onText, onFunctionCall) {
        const candidates = data.candidates || [];
        for (const candidate of candidates) {
            const parts = candidate.content?.parts || [];
            for (const part of parts) {
                if (part.text)
                    onText(part.text);
                if (part.functionCall) {
                    onFunctionCall(part.functionCall, part);
                }
            }
        }
    }
    parseError(status, errorText) {
        let errorBody = errorText.substring(0, 1000);
        let errorCode;
        try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error) {
                errorCode = errorJson.error.code;
                errorBody = errorJson.error.message || errorBody;
            }
        }
        catch {
        }
        if (status === 429) {
            return { type: 'RATE_LIMIT', message: `Rate limit exceeded. Free tier: 2-15 RPM. Wait 60s.\n${errorBody}` };
        }
        else if (status === 400) {
            const errorLower = errorBody.toLowerCase();
            const contextLimitPhrases = [
                'context length', 'token limit', 'maximum context', 'resource_exhausted',
                'input too long', 'context window', 'exceeded', 'too many requests',
                'rate limit exceeded', 'quota exceeded', 'resource exhausted',
                'service unavailable', 'temporarily unavailable', 'try again later',
                'please try again later', 'please try again'
            ];
            if (contextLimitPhrases.some(phrase => errorLower.includes(phrase))) {
                return { type: 'CONTEXT_LIMIT', message: `Context limit reached: ${errorBody}` };
            }
            return { type: 'BAD_REQUEST', message: `Bad request: ${errorBody}` };
        }
        else {
            return { type: `API_ERROR_${status}`, message: `API error ${status}: ${errorBody}` };
        }
    }
    async handleContinuation(prompt, options, errorInfo) {
        if (this.continuationCount >= this.maxContinuations) {
            this.sendChunk({ type: 'error', data: `Too many continuations (${this.maxContinuations}). Stopping.` });
            this.sendChunk({ type: 'done' });
            return;
        }
        this.sendChunk({ type: 'error', data: errorInfo.message });
        this.sendChunk({ type: 'text', data: 'Creating continuation session...' });
        const continuationState = this.createContinuationState(prompt, options);
        await this.chatStream(prompt, options, this.onChunkCallback, continuationState);
    }
    createContinuationState(prompt, options) {
        const recentSummary = 'Working on task...';
        return {
            userInput: this.originalUserInput || prompt,
            todoList: this.todoList,
            filesCreated: Array.from(this.filesCreated),
            lastFileContent: this.lastFileContent || undefined,
            recentSummary,
        };
    }
    buildContinuationPrompt(state, options) {
        const todoSummary = state.todoList && state.todoList.length > 0
            ? state.todoList.map(t => `  ${t.status === 'completed' ? '✓' : t.status === 'in-progress' ? '▶' : '☐'} [${t.id}] ${t.description}`).join('\n')
            : 'No tasks yet';
        const previousFiles = state.filesCreated.length > 0
            ? state.filesCreated.slice(0, -1).map(f => `  • ${f}`).join('\n') + (state.filesCreated.length > 10 ? '\n  ... and more' : '')
            : 'None';
        const lastFileSection = state.lastFileContent
            ? `\nLast file being written (may be incomplete - continue if needed):\n  Path: ${state.lastFileContent.path}\n  Content:\n\`\`\`\n${state.lastFileContent.content.substring(0, 5000)}\n\`\`\`\n`
            : '';
        let contextText = '';
        if (options.context?.project) {
            contextText = `\n\nProject context (compressed):\nActive Project: ${options.context.project}\n`;
        }
        return `CONTINUATION SESSION - Previous session hit context limit or timeout.

Original task: ${state.userInput}

Current status:
To-Do List (fully preserved):
${todoSummary}

Files created: ${state.filesCreated.length}
Previous files (paths only):
${previousFiles}${lastFileSection}

Recent progress: ${state.recentSummary}
${contextText}

IMPORTANT: Continue from where you left off. Check the to-do list, verify files created, and continue working until task_complete is called. Do NOT restart the task.`;
    }
    cancel() {
        if (this.cancelController)
            this.cancelController.abort();
        this.loopManager.setIsActive(false);
        this.onChunkCallback = undefined;
        this.sendChunk({ type: 'done' });
    }
    async listModels() {
        return {
            success: true,
            models: [
                { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview", desc: "State-of-the-art, Pro-grade reasoning at Flash speed", limits: "5 RPM (free tier)", provider: "gemini" },
                { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Fast, 1M context, 65K output - RECOMMENDED", limits: "15 RPM, 1M RPD (free)", provider: "gemini", recommended: true },
                { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", desc: "Advanced reasoning, 1M context (slower)", limits: "2 RPM, 50 RPD (free)", provider: "gemini" },
                { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", desc: "Most efficient, 1M context", limits: "15 RPM (free)", provider: "gemini" },
            ]
        };
    }
}
exports.GeminiService = GeminiService;
//# sourceMappingURL=gemini.service.js.map