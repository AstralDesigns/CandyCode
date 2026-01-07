"use strict";
/**
 * OpenAI-Compatible Provider Wrapper
 * Standardizes streaming and tool calling across all AI providers
 * Maps each provider (Gemini, DeepSeek, Groq, Moonshot) to OpenAI-compatible endpoints
 *
 * This unified provider replaces:
 * - deepseek-provider.service.ts
 * - groq-provider.service.ts
 * - moonshot-provider.service.ts
 * - custom geminiChatStream() in ai-backend.service.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICompatibleProvider = void 0;
exports.createOpenAICompatibleProvider = createOpenAICompatibleProvider;
const tool_definitions_1 = require("./tool-definitions");
const TINKER_SYSTEM_PROMPT = `You are Tinker, an expert AI coding assistant. You have access to tools and MUST use them to complete tasks.

## CRITICAL RULES

### 1. DYNAMIC TASK TRACKING
Create and manage your to-do list dynamically:
- **At start**: create_plan(title="...", steps=[...]) to plan initial steps
- **Mid-task**: create_plan(...) when you discover new work needed or to update status
- **Track progress**: Use create_plan to mark steps as "in-progress", "completed", or "skipped"
- **Finish**: task_complete(summary="...") when ALL done

### 2. AGENTIC DEBUG/TEST LOOP
When debugging, testing, or running code, work autonomously until success:
1. **Execute**: Run the command with execute_command
2. **Analyze**: Read the output carefully for errors
3. **Fix**: If errors found, read the relevant file(s), write fixes
4. **Retry**: Run again, repeat until success or identify blocking issue
5. **Add tasks**: If you discover additional work, update the plan with create_plan

### 3. FILE DISCIPLINE
- Create EXACTLY the files requested - no more, no less
- For small files (<10K chars): Write complete content in one write_file call
- For large files (>10K chars): Use chunked writes:
  1. First chunk: write_file(path="file.py", content="...", finalize=false)
  2. Middle chunks: write_file(path="file.py", content="...", finalize=false)
  3. Last chunk: write_file(path="file.py", content="...", finalize=true)

### 3.1. READING FILES
- **peek_file**: Use for browsing/exploring files to understand structure. Returns summary with first/last lines.
- **read_file**: Use when you need to EDIT a file. Always returns FULL content (no truncation).
  - Before editing: read_file(path="file.py") to get complete content
  - For context/browsing: peek_file(path="file.py") to see structure

### 4. COMMAND EXECUTION
- Safe commands (ls, cat, grep, etc.) run automatically
- Elevated commands (rm -rf, etc.) prompt for approval
- Always check command output for errors before proceeding

### 5. AUTONOMOUS PROBLEM SOLVING
When given a task like "fix this bug" or "make it work":
1. Don't stop at first attempt - iterate until success
2. Read error messages carefully
3. Search codebase if needed (search_code)
4. Make incremental fixes and re-test
5. Update your plan as you discover new subtasks
6. Only call task_complete when truly finished

### 6. RESPONSE FORMAT
- Call tools IMMEDIATELY - don't explain first
- Chain tools efficiently
- Be concise when responding to user

Available tools: read_file, peek_file, write_file, list_files, search_code, execute_command, create_plan, task_complete, web_search`;
// Move convertToolsToOpenAIFormat here, it's specific to this service
function convertToolsToOpenAIFormat(geminiTools, provider) {
    // Convert internal tool definitions (TOOL_DEFINITIONS) to OpenAI `functions` schema
    const functions = [];
    for (const toolGroup of geminiTools) {
        // toolGroup may be a grouped collection or a single function declaration
        const decls = toolGroup.functionDeclarations || (Array.isArray(toolGroup) ? toolGroup : null) || (toolGroup.declarations || null);
        const items = Array.isArray(decls) ? decls : (toolGroup.functionDeclarations ? toolGroup.functionDeclarations : (Array.isArray(toolGroup) ? toolGroup : []));
        for (const declaration of items) {
            // Expect declaration to have: name, description, parameters (JSON Schema)
            const name = declaration.name || declaration.id || declaration.functionName;
            const description = declaration.description || declaration.summary || '';
            const parameters = declaration.parameters || declaration.argsSchema || { type: 'object', properties: {}, required: [] };
            if (!name)
                continue;
            if (provider === 'moonshot') {
                // Moonshot expects tools with an explicit type and schema
                functions.push({
                    name,
                    description,
                    type: 'function',
                    schema: parameters,
                });
            }
            else {
                functions.push({
                    name,
                    description,
                    parameters,
                });
            }
        }
    }
    return functions;
}
/**
 * Converts Gemini tool definitions to modern OpenAI `tools` format
 */
function convertToolsToModernOpenAI(geminiTools) {
    const tools = [];
    for (const toolGroup of geminiTools) {
        const decls = toolGroup.functionDeclarations || (Array.isArray(toolGroup) ? toolGroup : [toolGroup]);
        const items = Array.isArray(decls) ? decls : (toolGroup.functionDeclarations ? toolGroup.functionDeclarations : (Array.isArray(toolGroup) ? toolGroup : []));
        for (const declaration of items) {
            const name = declaration.name || declaration.id || declaration.functionName;
            if (!name)
                continue;
            tools.push({
                type: 'function',
                function: {
                    name,
                    description: declaration.description || declaration.summary || '',
                    parameters: declaration.parameters || declaration.argsSchema || { type: 'object', properties: {}, required: [] }
                }
            });
        }
    }
    return tools;
}
/**
 * Maps provider names to their OpenAI-compatible endpoints
 */
function getOpenAIConfig(provider, apiKey, model) {
    switch (provider) {
        case 'gemini':
            // Google's OpenAI-compatible endpoint for Gemini models
            return {
                baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
                apiKey,
                model: model.includes('gemini') ? model : `gemini-${model}`,
                provider: 'gemini',
            };
        case 'deepseek':
            // DeepSeek's OpenAI-compatible endpoint
            return {
                baseUrl: 'https://api.deepseek.com/v1/',
                apiKey,
                model: model.includes('deepseek') ? model : `deepseek-${model}`,
                provider: 'deepseek',
            };
        case 'groq':
            // Groq's OpenAI-compatible endpoint
            return {
                baseUrl: 'https://api.groq.com/openai/v1/',
                apiKey,
                model,
                provider: 'groq',
            };
        case 'moonshot':
            // Moonshot's OpenAI-compatible endpoint
            return {
                baseUrl: 'https://api.moonshot.cn/v1/',
                apiKey,
                model: model.includes('moonshot') ? model : `moonshot-${model}`,
                provider: 'moonshot',
            };
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}
function getMaxTokensForModel(provider, model) {
    // Conservative per-provider defaults to avoid exceeding model limits
    const m = (model || '').toLowerCase();
    switch (provider) {
        case 'gemini':
            // Gemini supports very large outputs; cap to 65536
            return 65536;
        case 'deepseek':
            // DeepSeek models generally support 128k contexts — cap to 131072
            return 131072;
        case 'groq':
            // Kimi K2 on Groq supports 16384 max output tokens
            // Llama models support up to 32768
            if (m.includes('kimi-k2')) {
                return 16384;
            }
            return 32768;
        case 'moonshot':
            // Moonshot/Kimi typically supports up to 128k
            return 131072;
        default:
            return 2048;
    }
}
/**
 * Unified OpenAI-Compatible Provider
 * Wraps any OpenAI-compatible endpoint and provides consistent streaming
 */
class OpenAICompatibleProvider {
    cancelController = null;
    config;
    constructor(config) {
        this.config = config;
    }
    getName() {
        return `${this.config.provider.toUpperCase()} (OpenAI Compatible)`;
    }
    supportsFunctionCalling() {
        return true;
    }
    async getAvailableModels() {
        // Return a static list for now; can be enhanced to call /models endpoint
        switch (this.config.provider) {
            case 'gemini':
                return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash-preview'];
            case 'deepseek':
                return ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'];
            case 'groq':
                // Mixtral decommissioned, Llama 3.3 70B recommended
                return ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'moonshotai/kimi-k2-instruct'];
            case 'moonshot':
                return ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'];
            default:
                return [];
        }
    }
    setApiKey(apiKey) {
        this.config.apiKey = apiKey;
    }
    async chatStream(prompt, options, onChunk, _onCancel) {
        try {
            this.cancelController = new AbortController();
            const apiKey = options.apiKey || this.config.apiKey;
            if (!apiKey) {
                this._sendChunk({ type: 'error', data: `${this.config.provider} API key required` }, onChunk);
                this._sendChunk({ type: 'done' }, onChunk);
                return;
            }
            const model = options.model || this.config.model;
            const messages = [];
            // Always include a system instruction as the first message
            // Use TINKER_SYSTEM_PROMPT for all providers to enable consistent agentic behavior
            messages.push({ role: 'system', content: TINKER_SYSTEM_PROMPT });
            // Build conversation history
            if (options.conversationHistory) {
                messages.push(...options.conversationHistory.map((msg) => {
                    const m = { role: msg.role, content: msg.content };
                    // Preserve tool metadata if present so provider-specific endpoints
                    // that require `tool_call_id` receive it (e.g. Groq)
                    if (msg.tool_call_id)
                        m.tool_call_id = msg.tool_call_id;
                    if (msg.tool_calls)
                        m.tool_calls = msg.tool_calls;
                    return m;
                }));
            }
            // Add context if available
            if (options.context?.files && options.context.files.length > 0) {
                let contextText = 'User-Selected Context Files:\n';
                contextText += options.context.files
                    .map((f) => `File: ${f.path}\n${f.content || ''}`)
                    .join('\n\n');
                messages.push({
                    role: 'user',
                    content: contextText + '\n\n' + prompt,
                });
            }
            else {
                messages.push({
                    role: 'user',
                    content: prompt,
                });
            }
            // Build request body (OpenAI format)
            const requestBody = {
                model,
                messages,
                stream: true,
                temperature: 0.7,
                max_tokens: getMaxTokensForModel(this.config.provider, model),
            };
            // Add functions if provider supports function calling (OpenAI `functions` schema)
            if (this.supportsFunctionCalling() && options.tools) {
                if (this.config.provider === 'gemini') {
                    // Gemini's OpenAI-compatible endpoint supports modern `tools` parameter
                    requestBody.tools = convertToolsToModernOpenAI(options.tools);
                    requestBody.tool_choice = 'auto';
                }
                else if (this.config.provider === 'moonshot') {
                    // Moonshot historically used `tools`/`tool_choice`, but some accounts
                    // reject non-plugin tool shapes. To maximize compatibility, encode
                    // the tool metadata into the system prompt and ask the
                    // model to emit a single-line TOOL_CALL JSON when invoking a tool.
                    const functionsSchema = convertToolsToOpenAIFormat(options.tools, this.config.provider);
                    const toolsSummary = functionsSchema.map((f) => ({ name: f.name, description: f.description, parameters: f.schema || f.parameters }));
                    if (messages.length > 0 && messages[0].role === 'system') {
                        messages[0].content = `${messages[0].content}\n\nAvailable tools (JSON): ${JSON.stringify(toolsSummary)}\nWhen selecting a tool, output exactly one line that begins with:\nTOOL_CALL: {"name": "<tool-name>", "arguments": { ... }}\nDo not wrap the JSON in code blocks. Example: TOOL_CALL: {"name":"write_file","arguments":{"path":"~/notes.txt","content":"hello"}}`;
                    }
                }
                else {
                    requestBody.functions = convertToolsToOpenAIFormat(options.tools, this.config.provider);
                    requestBody.function_call = 'auto';
                }
            }
            // Make OpenAI-compatible API call with streaming
            const url = `${this.config.baseUrl}chat/completions`;
            // Retry logic for rate limits (429)
            let response = null;
            let lastError = '';
            const maxRetries = 3;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify(requestBody),
                        signal: this.cancelController.signal,
                    });
                    if (response.ok) {
                        break; // Success, exit retry loop
                    }
                    // Handle rate limit with retry
                    if (response.status === 429 && attempt < maxRetries - 1) {
                        const errorText = await response.text();
                        // Extract wait time from error message if available
                        const waitMatch = errorText.match(/try again in (\d+(?:\.\d+)?)/i);
                        const waitTime = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500 : (attempt + 1) * 2000;
                        console.log(`[openai-compatible] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
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
                        throw fetchError; // Don't retry aborted requests
                    }
                    if (attempt < maxRetries - 1) {
                        console.log(`[openai-compatible] Fetch failed, retrying in ${(attempt + 1) * 1000}ms: ${lastError}`);
                        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
                        continue;
                    }
                }
            }
            if (!response || !response.ok) {
                this._sendChunk({
                    type: 'error',
                    data: `${this.config.provider} API error (${response?.status || 'fetch failed'}): ${lastError}`,
                }, onChunk);
                this._sendChunk({ type: 'done' }, onChunk);
                return;
            }
            // Process streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            // If provider doesn't stream in SSE format, fall back to reading full body
            if (!reader) {
                const text = await response.text();
                try {
                    const parsed = JSON.parse(text);
                    const content = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.text || '';
                    if (content)
                        this._sendChunk({ type: 'text', data: content }, onChunk);
                }
                catch (e) {
                    this._sendChunk({ type: 'error', data: 'Invalid JSON response from provider' }, onChunk);
                }
                this._sendChunk({ type: 'done' }, onChunk);
                return;
            }
            let buffer = '';
            // Buffer for assembling plain text fragments (handles providers that stream TOOL_CALL JSON across multiple text chunks)
            let plainTextBuffer = '';
            let currentToolCalls = {};
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                // Handle both SSE `data: ` events and raw JSON lines
                const events = buffer.split('\n\n');
                buffer = events.pop() || '';
                for (const ev of events) {
                    let data = ev.trim();
                    if (!data)
                        continue;
                    // If event lines have `data: ` prefixes, extract the payload
                    if (data.includes('\n')) {
                        const lines = data.split('\n');
                        const dataLines = lines.filter(l => l.trim().startsWith('data:'))
                            .map(l => l.replace(/^data:\s*/, ''));
                        if (dataLines.length > 0) {
                            data = dataLines.join('\n');
                        }
                        else {
                            // maybe it's just a JSON chunk
                            data = lines.join('\n');
                        }
                    }
                    else if (data.startsWith('data:')) {
                        data = data.replace(/^data:\s*/, '');
                    }
                    if (!data || data === '[DONE]')
                        continue;
                    // Try parsing JSON payloads
                    try {
                        const parsed = JSON.parse(data);
                        try {
                            console.log('[openai-compatible DEBUG] parsed:', JSON.stringify(parsed).slice(0, 1000));
                        }
                        catch (e) {
                            console.log('[openai-compatible DEBUG] parsed (stringify failed):', String(parsed));
                        }
                        const delta = parsed.choices?.[0]?.delta;
                        // Support older style where content is under message.content or text
                        const textDelta = delta?.content || parsed.choices?.[0]?.text || parsed.choices?.[0]?.message?.content;
                        if (textDelta) {
                            plainTextBuffer += textDelta;
                            // Strategy: Accumulate text in the buffer and only emit when:
                            // 1. We find a complete TOOL_CALL: {...} JSON object, OR
                            // 2. We find a complete <tool_code>function(...)</tool_code> block, OR
                            // 3. We find clear paragraph breaks (double newline, etc.) suggesting text is done
                            // This prevents sending partial fragments as text.
                            let processed = true;
                            while (processed) {
                                processed = false;
                                // Check for complete TOOL_CALL: {...} JSON object
                                const TAG = 'TOOL_CALL:';
                                let tagIdx = plainTextBuffer.indexOf(TAG);
                                if (tagIdx !== -1) {
                                    // Found a TOOL_CALL tag; try to extract complete JSON
                                    let i = tagIdx + TAG.length;
                                    while (i < plainTextBuffer.length && /\s/.test(plainTextBuffer[i]))
                                        i++;
                                    if (i < plainTextBuffer.length && plainTextBuffer[i] === '{') {
                                        // Scan for matching closing brace
                                        let depth = 0, inString = false, escape = false, endPos = -1;
                                        for (let j = i; j < plainTextBuffer.length; j++) {
                                            const ch = plainTextBuffer[j];
                                            if (escape) {
                                                escape = false;
                                                continue;
                                            }
                                            if (ch === '\\') {
                                                escape = true;
                                                continue;
                                            }
                                            if (ch === '"') {
                                                inString = !inString;
                                                continue;
                                            }
                                            if (inString)
                                                continue;
                                            if (ch === '{')
                                                depth++;
                                            else if (ch === '}') {
                                                depth--;
                                                if (depth === 0) {
                                                    endPos = j + 1;
                                                    break;
                                                }
                                            }
                                        }
                                        if (endPos !== -1) {
                                            // Complete JSON found; extract everything before and after
                                            const beforeTag = plainTextBuffer.slice(0, tagIdx);
                                            const jsonText = plainTextBuffer.slice(i, endPos);
                                            const afterJson = plainTextBuffer.slice(endPos);
                                            // Send any text before the TOOL_CALL
                                            if (beforeTag.trim()) {
                                                this._sendChunk({ type: 'text', data: beforeTag }, onChunk);
                                            }
                                            // Parse and send function_call
                                            try {
                                                const payload = JSON.parse(jsonText);
                                                const name = payload.name || payload.tool || payload.function;
                                                const args = payload.arguments || payload.args || payload.parameters || {};
                                                const callId = payload.callId || `tool_fc_${Date.now()}`;
                                                console.log('[openai-compatible] TOOL_CALL reassembled function_call:', name);
                                                this._sendChunk({ type: 'function_call', name, data: args, callId }, onChunk);
                                            }
                                            catch (err) {
                                                console.log('[openai-compatible] Failed to parse TOOL_CALL JSON:', err);
                                            }
                                            // Continue with remaining buffer
                                            plainTextBuffer = afterJson;
                                            processed = true;
                                        }
                                    }
                                }
                                // Check for complete <tool_code>function_name(...)</tool_code> blocks (Gemini format)
                                if (!processed) {
                                    const toolCodeRegex = /<tool_code>\s*([a-zA-Z_][\w\-]*)\s*\(([^)]*)\)\s*<\/tool_code>/;
                                    const match = toolCodeRegex.exec(plainTextBuffer);
                                    if (match) {
                                        const beforeMatch = plainTextBuffer.slice(0, match.index);
                                        const name = match[1];
                                        const argsRaw = match[2] || '';
                                        const afterMatch = plainTextBuffer.slice(match.index + match[0].length);
                                        // Send text before the tool_code block
                                        if (beforeMatch.trim()) {
                                            this._sendChunk({ type: 'text', data: beforeMatch }, onChunk);
                                        }
                                        // Parse arguments and send function_call
                                        let args = {};
                                        if (argsRaw.trim()) {
                                            const pairRe = /([a-zA-Z0-9_]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^,]+))(?:,|$)/g;
                                            let m;
                                            while ((m = pairRe.exec(argsRaw)) !== null) {
                                                const key = m[1];
                                                const val = m[2] ?? m[3] ?? m[4] ?? '';
                                                const v = (val || '').toString().trim();
                                                if (/^(true|false)$/.test(v))
                                                    args[key] = v === 'true';
                                                else if (/^-?\d+(?:\.\d+)?$/.test(v))
                                                    args[key] = Number(v);
                                                else
                                                    args[key] = v;
                                            }
                                        }
                                        const callId = `gemini_fc_${Date.now()}`;
                                        console.log('[openai-compatible] Gemini <tool_code> reassembled function_call:', name);
                                        this._sendChunk({ type: 'function_call', name, data: args, callId }, onChunk);
                                        // Continue with remaining buffer
                                        plainTextBuffer = afterMatch;
                                        processed = true;
                                    }
                                }
                                // Check for clear text boundaries (paragraph break)  
                                if (!processed && plainTextBuffer.includes('\n\n')) {
                                    const idx = plainTextBuffer.indexOf('\n\n');
                                    const textBefore = plainTextBuffer.slice(0, idx + 2);
                                    if (textBefore.trim()) {
                                        this._sendChunk({ type: 'text', data: textBefore }, onChunk);
                                    }
                                    plainTextBuffer = plainTextBuffer.slice(idx + 2);
                                    processed = true;
                                }
                            }
                            // Don't send anything else; wait for more chunks or stream end to flush remaining buffer
                        }
                        // Handle OpenAI-style function_call incremental deltas
                        const funcCallDelta = delta?.function_call || parsed.choices?.[0]?.message?.function_call || parsed.choices?.[0]?.function_call;
                        if (funcCallDelta) {
                            // Build a single current function call buffer keyed by index 0
                            if (!currentToolCalls[0])
                                currentToolCalls[0] = { id: `fc_${Date.now()}`, name: '', arguments: '' };
                            if (funcCallDelta.name)
                                currentToolCalls[0].name = funcCallDelta.name;
                            if (funcCallDelta.arguments)
                                currentToolCalls[0].arguments += funcCallDelta.arguments;
                        }
                        // Handle tool call deltas (provider-specific shapes)
                        const toolCalls = delta?.tool_calls || parsed.choices?.[0]?.tool_calls;
                        if (toolCalls) {
                            for (const toolCallDelta of toolCalls) {
                                const index = toolCallDelta.index ?? 0;
                                if (!currentToolCalls[index]) {
                                    currentToolCalls[index] = { id: '', name: '', arguments: '' };
                                }
                                if (toolCallDelta.id)
                                    currentToolCalls[index].id = toolCallDelta.id;
                                if (toolCallDelta.function?.name)
                                    currentToolCalls[index].name = toolCallDelta.function.name;
                                if (toolCallDelta.function?.arguments)
                                    currentToolCalls[index].arguments += toolCallDelta.function.arguments;
                            }
                        }
                        if (parsed.choices?.[0]?.finish_reason === 'tool_calls' || parsed.choices?.[0]?.finish_reason === 'function_call' || parsed.choices?.[0]?.finish_reason === 'function_call_finished' || parsed.choices?.[0]?.finish_reason === 'stop') {
                            for (const index in currentToolCalls) {
                                const toolCall = currentToolCalls[index];
                                if (toolCall.name && toolCall.arguments) {
                                    try {
                                        const args = JSON.parse(toolCall.arguments);
                                        const callId = toolCall.id || `fc_${Date.now()}`;
                                        this._sendChunk({ type: 'function_call', name: toolCall.name, data: args, callId }, onChunk);
                                    }
                                    catch (e) {
                                        // ignore parse errors
                                        const callId = toolCall.id || `fc_${Date.now()}`;
                                        this._sendChunk({ type: 'function_call', name: toolCall.name, data: toolCall.arguments, callId }, onChunk);
                                    }
                                }
                            }
                            currentToolCalls = {};
                        }
                    }
                    catch (e) {
                        // Not a JSON chunk; some providers might send plain text lines or fragmented TOOL_CALL
                        const maybeText = ev.replace(/^data:\s*/gm, '');
                        if (maybeText) {
                            plainTextBuffer += maybeText;
                            // Balanced-brace reassembly for TOOL_CALL: {...}
                            // This scans the buffer for the literal tag `TOOL_CALL:` and attempts
                            // to find a matching JSON object using a small state machine that
                            // respects strings and escapes so we don't try to parse incomplete JSON.
                            const TAG = 'TOOL_CALL:';
                            let scanPos = 0;
                            while (true) {
                                const tagIdx = plainTextBuffer.indexOf(TAG, scanPos);
                                if (tagIdx === -1)
                                    break;
                                // find first non-space character after the tag (expect '{')
                                let i = tagIdx + TAG.length;
                                while (i < plainTextBuffer.length && /\s/.test(plainTextBuffer[i]))
                                    i++;
                                if (i >= plainTextBuffer.length)
                                    break; // need more data
                                if (plainTextBuffer[i] !== '{') {
                                    // not a JSON start where we expect; continue searching after this point
                                    scanPos = i;
                                    continue;
                                }
                                // scan for matching closing brace, honoring strings and escapes
                                let depth = 0;
                                let inString = false;
                                let escape = false;
                                let endPos = -1;
                                for (let j = i; j < plainTextBuffer.length; j++) {
                                    const ch = plainTextBuffer[j];
                                    if (escape) {
                                        escape = false;
                                        continue;
                                    }
                                    if (ch === '\\') {
                                        escape = true;
                                        continue;
                                    }
                                    if (ch === '"') {
                                        inString = !inString;
                                        continue;
                                    }
                                    if (inString)
                                        continue;
                                    if (ch === '{')
                                        depth++;
                                    else if (ch === '}') {
                                        depth--;
                                        if (depth === 0) {
                                            endPos = j + 1;
                                            break;
                                        }
                                    }
                                }
                                if (endPos === -1)
                                    break; // incomplete JSON, wait for more chunks
                                const jsonText = plainTextBuffer.slice(i, endPos);
                                try {
                                    const payload = JSON.parse(jsonText);
                                    const name = payload.name || payload.tool || payload.function;
                                    const args = payload.arguments || payload.args || payload.parameters || {};
                                    const callId = payload.callId || `tool_fc_${Date.now()}`;
                                    console.log('[openai-compatible] Moonshot TOOL_CALL reassembled function_call:', name, 'args:', args);
                                    this._sendChunk({ type: 'function_call', name, data: args, callId }, onChunk);
                                    // remove everything up to endPos from the buffer and restart scanning
                                    plainTextBuffer = plainTextBuffer.slice(endPos);
                                    scanPos = 0;
                                    continue;
                                }
                                catch (err) {
                                    // malformed JSON at this region — skip past the tag to avoid tight loop
                                    scanPos = tagIdx + TAG.length;
                                    continue;
                                }
                            }
                            // After attempting to extract TOOL_CALL JSON objects, only flush remaining
                            // text if it does not look like the start of a TOOL_CALL (to avoid sending partial JSON)
                            const remainingText = plainTextBuffer.trim();
                            if (remainingText && !remainingText.startsWith('TOOL_CALL:')) {
                                this._sendChunk({ type: 'text', data: remainingText }, onChunk);
                                plainTextBuffer = '';
                            }
                            // Detect Gemini <tool_code> blocks with function calls e.g. write_file(path='...', content='...')
                            const toolCodeRegex = /<tool_code>\s*([a-zA-Z_][\w\-]*)\s*\(([^)]*)\)\s*<\/tool_code>/g;
                            let toolCodeMatch;
                            while ((toolCodeMatch = toolCodeRegex.exec(maybeText)) !== null) {
                                try {
                                    const name = toolCodeMatch[1];
                                    const argsRaw = toolCodeMatch[2] || '';
                                    let args = {};
                                    if (argsRaw.trim()) {
                                        const pairRe = /([a-zA-Z0-9_]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^,]+))(?:,|$)/g;
                                        let m;
                                        while ((m = pairRe.exec(argsRaw)) !== null) {
                                            const key = m[1];
                                            const val = m[2] ?? m[3] ?? m[4] ?? '';
                                            const v = (val || '').toString().trim();
                                            if (/^(true|false)$/.test(v))
                                                args[key] = v === 'true';
                                            else if (/^-?\d+(?:\.\d+)?$/.test(v))
                                                args[key] = Number(v);
                                            else
                                                args[key] = v;
                                        }
                                    }
                                    const callId = `gemini_tool_code_${Date.now()}`;
                                    console.log('[openai-compatible] Gemini <tool_code> function_call:', name, 'args:', args);
                                    this._sendChunk({ type: 'function_call', name, data: args, callId }, onChunk);
                                }
                                catch (err) {
                                    // ignore parse errors on tool_code blocks
                                }
                            }
                            // Detect explicit prose patterns like: "Call `write_file` with ..." or "Call write_file(args)"
                            const callProseMatch = maybeText.match(/Call\\s+`?([a-zA-Z_][\\w\\-]*)`?(?:\\s+with\\s+(.+))?/i);
                            if (callProseMatch) {
                                try {
                                    const name = callProseMatch[1];
                                    const argsRaw = (callProseMatch[2] || '').trim();
                                    let args = {};
                                    if (argsRaw) {
                                        try {
                                            args = JSON.parse(argsRaw);
                                        }
                                        catch (e) {
                                            const pairRe = /([a-zA-Z0-9_]+)\\s*=\\s*(?:'([^']*)'|\"([^\\\"]*)\"|([^,]+))(?:,|$)/g;
                                            let m;
                                            while ((m = pairRe.exec(argsRaw)) !== null) {
                                                const key = m[1];
                                                const val = m[2] ?? m[3] ?? m[4] ?? '';
                                                const v = (val || '').toString().trim();
                                                if (/^(true|false)$/.test(v))
                                                    args[key] = v === 'true';
                                                else if (/^-?\\d+(?:\.\d+)?$/.test(v))
                                                    args[key] = Number(v);
                                                else
                                                    args[key] = v;
                                            }
                                        }
                                    }
                                    const callId = `textcall_fc_${Date.now()}`;
                                    this._sendChunk({ type: 'function_call', name, data: args, callId }, onChunk);
                                    continue;
                                }
                                catch (err) {
                                    // fall through
                                }
                            }
                            // Heuristic: detect code-like function calls e.g. write_file(path='~/a', content='x')
                            const funcMatch = maybeText.match(/^\\s*([a-zA-Z_][\\w\\-]*)\\s*\\(\\s*([\\s\\S]*?)\\s*\\)\\s*;?\\s*$/);
                            if (funcMatch) {
                                try {
                                    const name = funcMatch[1];
                                    const argsRaw = funcMatch[2] || '';
                                    let args = {};
                                    const trimmed = argsRaw.trim();
                                    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                                        try {
                                            args = JSON.parse(trimmed);
                                        }
                                        catch (e) {
                                            args = {};
                                        }
                                    }
                                    else {
                                        const pairRe = /([a-zA-Z0-9_]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^,]+))(?:,|$)/g;
                                        let m;
                                        while ((m = pairRe.exec(argsRaw)) !== null) {
                                            const key = m[1];
                                            const val = m[2] ?? m[3] ?? m[4] ?? '';
                                            const v = val.trim();
                                            if (/^(true|false)$/.test(v))
                                                args[key] = v === 'true';
                                            else if (/^-?\\d+(?:\.\d+)?$/.test(v))
                                                args[key] = Number(v);
                                            else
                                                args[key] = v;
                                        }
                                    }
                                    const callId = `heuristic_fc_${Date.now()}`;
                                    this._sendChunk({ type: 'function_call', name, data: args, callId }, onChunk);
                                    continue;
                                }
                                catch (err) {
                                    // fall through to normal text handling
                                }
                            }
                            // Detect XML-like call format: <call:write_file path="..." content="..." />
                            const xmlCallMatch = maybeText.match(/<call:([a-zA-Z_][\w\-]*)\s+([^>]+?)\s*\/?>(?:<\/call:[a-zA-Z_][\w\-]*>)?/);
                            if (xmlCallMatch) {
                                try {
                                    const name = xmlCallMatch[1];
                                    const attrsRaw = xmlCallMatch[2] || '';
                                    const attrRe = /([a-zA-Z0-9_:-]+)\s*=\s*"([^"]*)"/g;
                                    let m;
                                    const args = {};
                                    while ((m = attrRe.exec(attrsRaw)) !== null) {
                                        args[m[1]] = m[2];
                                    }
                                    const callId = `xml_fc_${Date.now()}`;
                                    this._sendChunk({ type: 'function_call', name, data: args, callId }, onChunk);
                                    continue;
                                }
                                catch (err) {
                                    // fall through to other handlers
                                }
                            }
                            // Detect Gemini TOOL_CALL protocol: a single line beginning with TOOL_CALL: {json}
                            const toolCallMatch = maybeText.match(/TOOL_CALL:\\s*(\{[\\s\\S]*\\})/);
                            if (toolCallMatch) {
                                try {
                                    const payload = JSON.parse(toolCallMatch[1]);
                                    const name = payload.name || payload.tool || payload.function;
                                    const args = payload.arguments || payload.args || payload.parameters || {};
                                    const callId = payload.callId || `gemini_fc_${Date.now()}`;
                                    this._sendChunk({ type: 'function_call', name, data: args, callId }, onChunk);
                                    continue;
                                }
                                catch (err) {
                                    // fall back to text output if parsing fails
                                }
                            }
                            // If after all heuristics, we still have buffered text, send it
                            if (plainTextBuffer) {
                                this._sendChunk({ type: 'text', data: plainTextBuffer }, onChunk);
                                plainTextBuffer = '';
                            }
                        }
                    }
                }
            }
            // Flush any remaining text in plainTextBuffer before ending the stream
            if (plainTextBuffer.trim()) {
                this._sendChunk({ type: 'text', data: plainTextBuffer }, onChunk);
            }
            this._sendChunk({ type: 'done' }, onChunk);
        }
        catch (e) {
            if (e?.name !== 'AbortError') {
                this._sendChunk({ type: 'error', data: String(e.message || e) }, onChunk);
            }
            this._sendChunk({ type: 'done' }, onChunk);
        }
    }
    cancel() {
        if (this.cancelController) {
            this.cancelController.abort();
        }
    }
    _sendChunk(chunk, onChunk) {
        if (onChunk) {
            try {
                onChunk(chunk);
            }
            catch (e) {
                // Ignore callback errors
            }
        }
    }
    _getToolDefinitions() {
        return convertToolsToOpenAIFormat(tool_definitions_1.TOOL_DEFINITIONS);
    }
}
exports.OpenAICompatibleProvider = OpenAICompatibleProvider;
/**
 * Factory function to create provider-specific OpenAI-compatible wrappers
 */
function createOpenAICompatibleProvider(provider, apiKey, model) {
    const config = getOpenAIConfig(provider, apiKey, model);
    return new OpenAICompatibleProvider(config);
}
//# sourceMappingURL=openai-compatible.service.js.map