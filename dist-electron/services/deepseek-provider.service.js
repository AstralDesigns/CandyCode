"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekProvider = void 0;
const agentic_loop_service_1 = require("./agentic-loop.service");
const tool_definitions_1 = require("./tool-definitions");
const DEEPSEEK_SYSTEM_INSTRUCTION = `You are Alpha, a friendly and autonomous coding assistant for AlphaStudio.

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
- Use create_plan(title, steps) to plan your work at the start of complex tasks
- You can add, update, or skip tasks dynamically as you discover additional work needed
- Track your progress and adapt your plan as needed

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
class DeepSeekProvider {
    loopManager;
    cancelController = null;
    baseUrl = 'https://api.deepseek.com/v1';
    apiKey = ''; // DeepSeek requires API key but has free tier
    mainWindow = null;
    constructor() {
        this.loopManager = new agentic_loop_service_1.AgenticLoopManager(30);
    }
    setMainWindow(window) {
        this.mainWindow = window;
    }
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }
    supportsFunctionCalling() {
        return true;
    }
    getName() {
        return 'DeepSeek';
    }
    async getAvailableModels() {
        return [
            'deepseek-chat',
            'deepseek-coder',
            'deepseek-reasoner',
        ];
    }
    sendChunk(chunk) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('ai-backend:chunk', chunk);
        }
    }
    async chatStream(prompt, options, onChunk, onCancel) {
        this.loopManager.reset();
        this.loopManager.setIsActive(true);
        this.cancelController = new AbortController();
        const sendChunk = (chunk) => {
            this.sendChunk(chunk);
            if (onChunk)
                onChunk(chunk);
        };
        const model = options.model || 'deepseek-chat';
        const apiKey = options.apiKey || this.apiKey;
        if (!apiKey) {
            sendChunk({ type: 'error', data: 'DeepSeek API key required. Get one from platform.deepseek.com' });
            sendChunk({ type: 'done' });
            return;
        }
        // Prepare messages
        const messages = [
            { role: 'system', content: DEEPSEEK_SYSTEM_INSTRUCTION }
        ];
        // Add context if available
        if (options.context?.files && options.context.files.length > 0) {
            let contextText = 'User-Selected Context Files:\n';
            contextText += options.context.files
                .map(f => `File: ${f.path}\n${f.content || ''}`)
                .join('\n\n');
            contextText += '\n\n';
            messages.push({ role: 'user', content: contextText + prompt });
        }
        else {
            messages.push({ role: 'user', content: prompt });
        }
        try {
            while (this.loopManager.shouldContinueLoop()) {
                this.loopManager.incrementIteration();
                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        stream: true,
                        temperature: 0.7,
                        max_tokens: 65536,
                        tools: this.convertToolDefinitions()
                    }),
                    signal: this.cancelController.signal
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
                }
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                if (!reader)
                    throw new Error('No response body');
                let buffer = '';
                let fullText = '';
                let functionCalls = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    // Process complete lines
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]')
                                break;
                            try {
                                const parsed = JSON.parse(data);
                                const choice = parsed.choices?.[0];
                                if (choice?.delta?.content) {
                                    const content = choice.delta.content;
                                    fullText += content;
                                    sendChunk({ type: 'text', data: content });
                                }
                                // Handle tool calls
                                if (choice?.delta?.tool_calls) {
                                    for (const toolCall of choice.delta.tool_calls) {
                                        const index = toolCall.index;
                                        if (!functionCalls[index]) {
                                            functionCalls[index] = {
                                                id: toolCall.id,
                                                type: toolCall.type,
                                                function: {
                                                    name: '',
                                                    arguments: ''
                                                }
                                            };
                                        }
                                        if (toolCall.function?.name) {
                                            functionCalls[index].function.name = toolCall.function.name;
                                        }
                                        if (toolCall.function?.arguments) {
                                            functionCalls[index].function.arguments += toolCall.function.arguments;
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                }
                // Add assistant message to conversation
                messages.push({ role: 'assistant', content: fullText });
                // Process function calls
                if (functionCalls.length > 0) {
                    for (const fc of functionCalls) {
                        if (fc.function.name) {
                            const callId = `${fc.function.name}_${Date.now()}`;
                            let args = {};
                            try {
                                args = JSON.parse(fc.function.arguments);
                            }
                            catch {
                                args = { content: fc.function.arguments };
                            }
                            sendChunk({
                                type: 'function_call',
                                name: fc.function.name,
                                data: args,
                                callId
                            });
                            // Execute function (you'll need to integrate your function execution logic here)
                            // This is a simplified version - you should integrate with your existing function execution
                            const result = await this.executeFunction(fc.function.name, args);
                            sendChunk({
                                type: 'function_result',
                                name: fc.function.name,
                                data: result,
                                callId
                            });
                            // Add function result to messages
                            messages.push({
                                role: 'tool',
                                tool_call_id: fc.id,
                                content: JSON.stringify(result)
                            });
                        }
                    }
                }
                // Check if task is complete
                if (fullText.includes('task_complete') || this.loopManager.getCurrentIteration() >= 29) {
                    sendChunk({ type: 'done' });
                    break;
                }
            }
        }
        catch (error) {
            console.error('[DeepSeek] Error:', error);
            sendChunk({ type: 'error', data: error.message || 'DeepSeek API error' });
            sendChunk({ type: 'done' });
        }
    }
    convertToolDefinitions() {
        // Convert your tool definitions to DeepSeek format
        return tool_definitions_1.TOOL_DEFINITIONS.map(toolGroup => ({
            type: 'function',
            function: toolGroup.functionDeclarations.map(fn => ({
                name: fn.name,
                description: fn.description,
                parameters: fn.parameters
            }))
        }));
    }
    async executeFunction(name, args) {
        // This should integrate with your existing function execution
        // For now, return a placeholder
        return { success: true, executed: name, args };
    }
    cancel() {
        if (this.cancelController) {
            this.cancelController.abort();
        }
        this.loopManager.setIsActive(false);
    }
}
exports.DeepSeekProvider = DeepSeekProvider;
//# sourceMappingURL=deepseek-provider.service.js.map