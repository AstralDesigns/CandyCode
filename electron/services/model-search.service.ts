import { BrowserWindow } from 'electron';
import axios from 'axios';

export class ModelSearchService {
  mainWindow: BrowserWindow | null = null;

  constructor(mainWindow: BrowserWindow | null = null) {
    this.mainWindow = mainWindow;
  }

  /**
   * Search HuggingFace model hub for compatible models
   */
  async searchModels(query: string) {
    try {
      // Example API call to search for models
      // This is a placeholder implementation
      const response = await axios.get(`https://huggingface.co/api/models?search=${encodeURIComponent(query)}`, {
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
        models: models.map((model: any) => ({
          name: model.id,
          description: model.cardData?.tags?.join(', ') || 'No description available',
          downloads: model.downloads,
          likes: model.likes
        }))
      };
    } catch (error) {
      console.error('[ModelSearch] Error searching models:', (error as Error).message || 'Unknown error');
      return {
        success: false,
        error: (error as Error).message || 'Failed to search models',
        models: []
      };
    }
  }

  async getModelDetails(modelId: string) {
    try {
      const response = await axios.get(`https://huggingface.co/api/models/${modelId}`, {
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
    } catch (error) {
      console.error('[ModelSearch] Error getting model details:', (error as Error).message || 'Unknown error');
      return {
        success: false,
        error: (error as Error).message || 'Failed to get model details'
      };
    }
  }
}

export const modelSearchService = new ModelSearchService();