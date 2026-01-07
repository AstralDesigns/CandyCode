import { create } from 'zustand';

interface ThumbnailStore {
  thumbnailUrls: Map<string, string>;
  loadedThumbnails: Set<string>;
  
  getThumbnailUrl: (filePath: string) => string | null;
  loadThumbnail: (filePath: string, fileName: string) => Promise<void>;
  preloadThumbnails: (items: Array<{ path: string; name: string }>) => Promise<void>;
  clearCache: () => void;
}

export const useThumbnailService = create<ThumbnailStore>((set, get) => ({
  thumbnailUrls: new Map(),
  loadedThumbnails: new Set(),
  
  getThumbnailUrl: (filePath: string) => {
    return get().thumbnailUrls.get(filePath) || null;
  },
  
  loadThumbnail: async (filePath: string, fileName: string) => {
    const { loadedThumbnails, thumbnailUrls } = get();
    
    if (loadedThumbnails.has(filePath)) {
      return;
    }
    
    try {
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension);
      const isVideo = ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(extension);
      
      if (isImage || isVideo) {
        // DESKTOP-NATIVE: Use file:// URLs directly - Electron handles this natively
        // This is MUCH faster than loading entire files into memory as base64
        const fileUrl = `file://${filePath}`;
        
        set((state) => {
          const newUrls = new Map(state.thumbnailUrls);
          newUrls.set(filePath, fileUrl);
          const newLoaded = new Set(state.loadedThumbnails);
          newLoaded.add(filePath);
          return {
            thumbnailUrls: newUrls,
            loadedThumbnails: newLoaded,
          };
        });
      }
    } catch (error) {
      console.error(`Failed to load thumbnail for ${filePath}:`, error);
      // Mark as loaded to prevent retry loops
      set((state) => {
        const newLoaded = new Set(state.loadedThumbnails);
        newLoaded.add(filePath);
        return { loadedThumbnails: newLoaded };
      });
    }
  },
  
  preloadThumbnails: async (items: Array<{ path: string; name: string }>) => {
    // Load first 20 items in parallel
    const itemsToLoad = items.slice(0, 20);
    const { loadThumbnail } = get();
    
    const loadPromises = itemsToLoad
      .filter(item => !get().loadedThumbnails.has(item.path))
      .map(item => 
        loadThumbnail(item.path, item.name).catch(err => {
          console.warn(`Failed to load thumbnail ${item.path}:`, err);
        })
      );
    
    await Promise.all(loadPromises);
  },
  
  clearCache: () => {
    set({
      thumbnailUrls: new Map(),
      loadedThumbnails: new Set(),
    });
  },
}));

