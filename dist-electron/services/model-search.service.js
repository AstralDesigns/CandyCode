"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelSearchService = exports.ModelSearchService = void 0;
const axios_1 = __importDefault(require("axios"));
class ModelSearchService {
    mainWindow = null;
    constructor(mainWindow = null) {
        this.mainWindow = mainWindow;
    }
    /**
     * Search HuggingFace model hub for compatible models
     */
    async searchModels(query) {
        try {
            // Example API call to search for models
            // This is a placeholder implementation
            const response = await axios_1.default.get(`https://huggingface.co/api/models?search=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': 'CandyCode/1.0',
                },
                params: {
                    limit: 20,
                    filter: 'gguf' // Looking for GGUF format models
                }
            });
            const models = response.data?.slice(0, 20) || [];
            return {
                success: true,
                models: models.map((model) => ({
                    name: model.id,
                    description: model.cardData?.tags?.join(', ') || 'No description available',
                    downloads: model.downloads,
                    likes: model.likes
                }))
            };
        }
        catch (error) {
            console.error('[ModelSearch] Error searching models:', error.message || 'Unknown error');
            return {
                success: false,
                error: error.message || 'Failed to search models',
                models: []
            };
        }
    }
    async getModelDetails(modelId) {
        try {
            const response = await axios_1.default.get(`https://huggingface.co/api/models/${modelId}`, {
                headers: {
                    'User-Agent': 'CandyCode/1.0',
                }
            });
            return {
                success: true,
                model: {
                    id: response.data.id,
                    tags: response.data.tags,
                    cardData: response.data.cardData,
                    siblings: response.data.siblings
                }
            };
        }
        catch (error) {
            console.error('[ModelSearch] Error getting model details:', error.message || 'Unknown error');
            return {
                success: false,
                error: error.message || 'Failed to get model details'
            };
        }
    }
}
exports.ModelSearchService = ModelSearchService;
exports.modelSearchService = new ModelSearchService();
//# sourceMappingURL=model-search.service.js.map