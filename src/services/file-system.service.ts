import { create } from 'zustand';

export interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
}

interface Breadcrumb {
  name: string;
  path: string;
}

interface FileSystemState {
  currentPath: string;
  directoryContent: FileSystemItem[];
  showDotfiles: boolean;
  navigationHistory: string[];
  historyIndex: number;
  
  // Actions
  setCurrentPath: (path: string) => void;
  setDirectoryContent: (content: FileSystemItem[]) => void;
  toggleDotfiles: () => void;
  navigateTo: (path: string) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  navigateUp: () => void;
  goHome: () => void;
  refreshDirectory: () => Promise<void>;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;
  getBreadcrumbs: () => Breadcrumb[];
}

export const useFileSystem = create<FileSystemState>()((set, get) => ({
  currentPath: '~',
  directoryContent: [],
  showDotfiles: false,
  navigationHistory: ['~'],
  historyIndex: 0,

  setCurrentPath: (path) => {
    set({ currentPath: path });
    get().refreshDirectory();
  },

  setDirectoryContent: (content) => set({ directoryContent: content }),

  toggleDotfiles: () => {
    set((state) => ({ showDotfiles: !state.showDotfiles }));
    get().refreshDirectory();
  },

  navigateTo: (path: string) => {
    const state = get();
    const history = [...state.navigationHistory];
    const currentIndex = state.historyIndex;
    
    // Remove forward history if navigating to new path
    if (currentIndex < history.length - 1) {
      history.splice(currentIndex + 1);
    }
    
    // Don't add if it's the same as current
    const currentPath = history[history.length - 1];
    if (currentPath !== path) {
      history.push(path);
      set({
        navigationHistory: history,
        historyIndex: history.length - 1,
        currentPath: path,
      });
      get().refreshDirectory();
    }
  },

  navigateBack: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      set({
        historyIndex: newIndex,
        currentPath: state.navigationHistory[newIndex],
      });
      get().refreshDirectory();
    }
  },

  navigateForward: () => {
    const state = get();
    if (state.historyIndex < state.navigationHistory.length - 1) {
      const newIndex = state.historyIndex + 1;
      set({
        historyIndex: newIndex,
        currentPath: state.navigationHistory[newIndex],
      });
      get().refreshDirectory();
    }
  },

  navigateUp: () => {
    const state = get();
    const current = state.currentPath;
    if (current === '~') {
      get().navigateTo('/');
      return;
    }
    if (current === '/') return;
    const parentPath = current.substring(0, current.lastIndexOf('/')) || '/';
    get().navigateTo(parentPath);
  },

  goHome: () => {
    get().navigateTo('~');
  },

  refreshDirectory: async () => {
    const state = get();
    const path = state.currentPath;
    
    if (!window.electronAPI) {
      // Retry after a short delay
      setTimeout(() => {
        if (window.electronAPI) {
          get().refreshDirectory();
        }
      }, 100);
      return;
    }

    try {
      let resolvedPath = path;
      if (path === '~' || path.startsWith('~/')) {
        if (window.electronAPI.getSystemInfo) {
          const info = await window.electronAPI.getSystemInfo();
          resolvedPath = path.replace(/^~/, info.homeDir || '~');
        }
      }

      const result = await window.electronAPI.readDirectory(resolvedPath);
      if ('error' in result) {
        console.error(result.error);
        set({ directoryContent: [] });
      } else {
        // Filter dotfiles based on showDotfiles setting
        const filtered = state.showDotfiles
          ? result
          : result.filter((item: FileSystemItem) => !item.name.startsWith('.'));
        set({ directoryContent: filtered });
      }
    } catch (error) {
      console.error('Error reading directory:', error);
      set({ directoryContent: [] });
    }
  },

  canNavigateBack: () => {
    return get().historyIndex > 0;
  },

  canNavigateForward: () => {
    const state = get();
    return state.historyIndex < state.navigationHistory.length - 1;
  },

  getBreadcrumbs: () => {
    const path = get().currentPath;
    if (path === '~') return [{ name: '~', path: '~' }];

    const parts = path.split('/').filter((p) => p);
    const crumbs = parts.map((part, index) => {
      const crumbPath = '/' + parts.slice(0, index + 1).join('/');
      return { name: part, path: crumbPath };
    });
    return [{ name: '/', path: '/' }, ...crumbs];
  },
}));

// Initialize on mount
if (typeof window !== 'undefined' && window.electronAPI) {
  useFileSystem.getState().refreshDirectory();
}

