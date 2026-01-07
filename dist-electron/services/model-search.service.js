"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelSearchService = exports.ModelSearchService = void 0;
class ModelSearchService {
    /**
     * Search HuggingFace model hub for compatible models
     * Filters for models suitable for vLLM/Ollama (text-generation)
     */
    async search(query, limit = 20) {
        try {
            // HuggingFace API endpoint - no authentication required for public models
            const url = new URL('https://huggingface.co/api/models');
            url.searchParams.set('search', query);
            url.searchParams.set('limit', limit.toString());
            url.searchParams.set('sort', 'downloads'); // Sort by popularity
            url.searchParams.set('direction', '-1'); // Descending
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'User-Agent': 'AlphaStudio/1.0',
                },
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) {
                throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            const models = Array.isArray(data) ? data : [];
            // Filter for models compatible with vLLM/Ollama
            const compatibleModels = models.filter((model) => {
                // Check if it's a text generation model
                const isTextGen = model.pipeline_tag === 'text-generation' ||
                    model.tags?.includes('text-generation') ||
                    model.tags?.includes('text-generation-inference') ||
                    model.tags?.includes('llama') ||
                    model.tags?.includes('mistral') ||
                    model.tags?.includes('phi') ||
                    model.tags?.includes('qwen') ||
                    model.tags?.includes('gemma');
                // Exclude certain model types that aren't suitable
                const excludedTypes = ['image', 'audio', 'video', 'multimodal'];
                const hasExcludedType = excludedTypes.some((type) => model.tags?.some((tag) => tag.toLowerCase().includes(type)));
                return isTextGen && !hasExcludedType;
            });
            return {
                success: true,
                models: compatibleModels.map((model) => ({
                    id: model.id,
                    downloads: model.downloads || 0,
                    likes: model.likes || 0,
                    tags: model.tags || [],
                    model_type: model.model_type,
                    pipeline_tag: model.pipeline_tag,
                    library_name: model.library_name,
                    author: model.author,
                })),
            };
        }
        catch (error) {
            console.error('[ModelSearch] Error searching models:', error);
            return {
                success: false,
                models: [],
                error: error.message || 'Failed to search models',
            };
        }
    }
    /**
     * Get detailed information about a specific model
     */
    async getModelDetails(modelId) {
        try {
            const response = await fetch(`https://huggingface.co/api/models/${modelId}`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'AlphaStudio/1.0',
                },
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) {
                throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
            }
            const model = await response.json();
            return {
                success: true,
                model: {
                    id: model.id,
                    downloads: model.downloads || 0,
                    likes: model.likes || 0,
                    tags: model.tags || [],
                    model_type: model.model_type,
                    pipeline_tag: model.pipeline_tag,
                    library_name: model.library_name,
                    author: model.author,
                },
            };
        }
        catch (error) {
            console.error('[ModelSearch] Error getting model details:', error);
            return {
                success: false,
                error: error.message || 'Failed to get model details',
            };
        }
    }
}
exports.ModelSearchService = ModelSearchService;
exports.modelSearchService = new ModelSearchService();
//# sourceMappingURL=model-search.service.js.map