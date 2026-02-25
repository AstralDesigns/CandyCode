"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIBackendService = void 0;
const gemini_service_1 = require("./gemini.service");
const groq_service_1 = require("./groq.service");
const grok_service_1 = require("./grok.service");
const moonshot_service_1 = require("./moonshot.service");
const ollama_service_1 = require("./ollama.service");
const openai_service_1 = require("./openai.service");
const anthropic_service_1 = require("./anthropic.service");
class AIBackendService {
    mainWindow = null;
    geminiService;
    groqService;
    grokService;
    moonshotService;
    ollamaService;
    openaiService;
    anthropicService;
    constructor() {
        this.geminiService = new gemini_service_1.GeminiService();
        this.groqService = new groq_service_1.GroqService();
        this.grokService = new grok_service_1.GrokService();
        this.moonshotService = new moonshot_service_1.MoonshotService();
        this.ollamaService = new ollama_service_1.OllamaService();
        this.openaiService = new openai_service_1.OpenAIService();
        this.anthropicService = new anthropic_service_1.AnthropicService();
    }
    /**
     * Set the main window for IPC communication
     * Passed to all provider services
     */
    setMainWindow(window) {
        this.mainWindow = window;
        this.geminiService.setMainWindow(window);
        this.groqService.setMainWindow(window);
        this.grokService.setMainWindow(window);
        this.moonshotService.setMainWindow(window);
        this.ollamaService.setMainWindow(window);
        this.openaiService.setMainWindow(window);
        this.anthropicService.setMainWindow(window);
    }
    /**
     * Optimize conversation history for API models
     * - Retains only recent history in full
     * - Summarizes or simplifies older messages
     */
    optimizeHistory(history, provider) {
        if (!history || history.length === 0)
            return [];
        // For Ollama (local), we can keep more history
        if (provider === 'ollama') {
            return history.slice(-50);
        }
        // For API providers, optimize more aggressively
        // Keep the last 10 messages in full
        const recentHistory = history.slice(-10);
        const olderHistory = history.slice(0, -10);
        if (olderHistory.length === 0)
            return recentHistory;
        // Simplify older history: keep only the first user message and a summary of intermediate steps
        const simplifiedOlder = [];
        // Keep the very first user message as it often contains the main goal
        if (olderHistory[0].role === 'user') {
            simplifiedOlder.push(olderHistory[0]);
        }
        // Add a summary placeholder for the middle part
        simplifiedOlder.push({
            role: 'assistant',
            content: `[Previous conversation history summarized: ${olderHistory.length} messages omitted to optimize context usage. I have already completed several steps of the task.]`
        });
        return [...simplifiedOlder, ...recentHistory];
    }
    /**
     * Main chat stream method - routes to appropriate provider
     */
    async chatStream(prompt, options, onChunk, continuationState) {
        const provider = options.provider || 'gemini';
        // Optimize history before routing
        if (options.conversationHistory) {
            options.conversationHistory = this.optimizeHistory(options.conversationHistory, provider);
        }
        console.log(`[AIBackend] Routing to provider: ${provider}`);
        console.log(`[AIBackend] Options:`, {
            provider: options.provider,
            model: options.model,
            apiKeyLength: options.apiKey?.length || 0,
            hasContext: !!options.context,
            historyLength: options.conversationHistory?.length || 0,
            isPro: options.isPro,
            licenseTier: options.licenseTier
        });
        switch (provider) {
            case 'groq':
                return this.groqService.chatStream(prompt, options, onChunk);
            case 'grok':
                return this.grokService.chatStream(prompt, options, onChunk);
            case 'moonshot':
                return this.moonshotService.chatStream(prompt, options, onChunk);
            case 'ollama':
                return this.ollamaService.chatStream(prompt, options, onChunk);
            case 'openai':
                return this.openaiService.chatStream(prompt, options, onChunk);
            case 'anthropic':
                return this.anthropicService.chatStream(prompt, options, onChunk);
            case 'gemini':
            default:
                return this.geminiService.chatStream(prompt, options, onChunk, continuationState);
        }
    }
    /**
     * Cancel all active requests across all providers
     */
    cancel() {
        console.log('[AIBackend] Cancelling all provider requests');
        this.geminiService.cancel();
        this.groqService.cancel();
        this.grokService.cancel();
        this.moonshotService.cancel();
        this.ollamaService.cancel();
        this.openaiService.cancel();
        this.anthropicService.cancel();
    }
    /**
     * Get list of available providers
     */
    async listProviders() {
        return [
            {
                id: 'gemini',
                name: 'Google Gemini',
                description: 'Native Gemini API with 1M+ context. Best for complex tasks. RECOMMENDED.',
                isFree: true
            },
            {
                id: 'grok',
                name: 'Grok (xAI)',
                description: 'xAI Grok models with better rate limits than Groq. OpenAI-compatible API.',
                isFree: false
            },
            {
                id: 'groq',
                name: 'Groq',
                description: 'Fast inference with Llama 3.3 70B (128K context). Free tier available.',
                isFree: true
            },
            {
                id: 'moonshot',
                name: 'Moonshot',
                description: 'Kimi AI with 128K context. China-based servers, may be slower.',
                isFree: false
            },
            {
                id: 'openai',
                name: 'OpenAI',
                description: 'Industry standard GPT-4 models. High reliability and quality.',
                isFree: false
            },
            {
                id: 'anthropic',
                name: 'Anthropic',
                description: 'Claude 3.5 Sonnet and Opus. Excellent reasoning and coding capabilities.',
                isFree: false
            },
            {
                id: 'ollama',
                name: 'Ollama (Local)',
                description: 'Run models locally for privacy and offline use. No API keys required.',
                isFree: true
            }
        ];
    }
    /**
     * Get combined list of models from all providers
     */
    async listModels() {
        const [geminiModels, groqModels, grokModels, moonshotModels, ollamaModels, openaiModels, anthropicModels] = await Promise.all([
            this.geminiService.listModels(),
            this.groqService.listModels(),
            this.grokService.listModels(),
            this.moonshotService.listModels(),
            this.ollamaService.listModels(),
            this.openaiService.listModels(),
            this.anthropicService.listModels()
        ]);
        const allModels = [
            ...geminiModels.models,
            ...grokModels.models,
            ...groqModels.models,
            ...moonshotModels.models,
            ...ollamaModels.models,
            ...openaiModels.models,
            ...anthropicModels.models
        ];
        return {
            success: true,
            models: allModels
        };
    }
    /**
     * Get the current provider name (for compatibility)
     */
    getCurrentProvider() {
        return 'gemini'; // Default provider
    }
    /**
     * Set provider (for compatibility - actual routing happens in chatStream)
     */
    setProvider(providerName) {
        const validProviders = ['gemini', 'groq', 'grok', 'moonshot', 'ollama', 'openai', 'anthropic'];
        return validProviders.includes(providerName);
    }
    /**
     * Get Ollama service instance for model management
     */
    getOllamaService() {
        return this.ollamaService;
    }
}
exports.AIBackendService = AIBackendService;
//# sourceMappingURL=ai-backend.service.js.map