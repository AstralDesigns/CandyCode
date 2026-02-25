export interface ElectronAPI {
  readDirectory: (path: string) => Promise<any>;
  readFile: (path: string) => Promise<{ content?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success?: boolean; error?: string }>;
  approveDiff: (filePath: string, content: string) => Promise<{ success?: boolean; error?: string }>;
  rejectDiff: (filePath: string) => Promise<{ success?: boolean; error?: string }>;
  showOpenDialog: (options: any) => Promise<any>;
  showSaveDialog: (options: any) => Promise<any>;
  executeCommand: (command: string, options?: any) => Promise<any>;
  getSystemInfo: () => Promise<any>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  getAppAssetPath: (assetName: string) => Promise<{ path: string; url: string }>;
  showContextMenu: (filePath: string, fileName: string, itemType: 'file' | 'folder') => Promise<any>;
  
  // Global Hotkey Management
  registerGlobalHotkey: (hotkey: string, action: string) => Promise<{ success: boolean; hotkey?: string; error?: string }>;
  unregisterGlobalHotkey: (hotkey: string) => Promise<{ success: boolean; error?: string }>;
  getRegisteredHotkeys: () => Promise<Array<{ action: string; hotkey: string }>>;
  unregisterAllHotkeys: () => Promise<{ success: boolean }>;
  on: (channel: string, callback: (data: any) => void) => void;
  off: (channel: string, callback: (data: any) => void) => void;
  copyFile: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
  moveFile: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
  trashFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  renameFile: (oldPath: string, newName: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  findFiles: (rootPath: string, query: string) => Promise<Array<{ name: string; path: string; type: 'file' }>>;
  project: {
    setCurrent: (projectPath: string | null) => Promise<void>;
    getCurrent: () => Promise<string | null>;
    onLoadPath: (callback: (projectPath: string) => void) => () => void;
  };
  aiBackend: {
    chat: (prompt: string, options: any) => Promise<void>;
    cancel: () => Promise<void>;
    onChunk: (callback: (chunk: any) => void) => void;
    removeAllListeners: (channel: string) => void;
    listModels: () => Promise<any>;
  };
  webSearch: (query: string, maxResults?: number) => Promise<any>;
  ollama: {
    checkServer: () => Promise<{ running: boolean; error?: string }>;
    listModels: () => Promise<{ success: boolean; models: Array<{ name: string; size: number; modified: string }> }>;
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string; lastProgress?: string }>;
    deleteModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    searchModels: (query: string) => Promise<{ success: boolean; models: Array<{ name: string; description?: string }> }>;
    runModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    onPullProgress: (callback: (data: { modelName: string; progress: string }) => void) => () => void;
  };
  pty: {
    create: (options: { id: string; cols: number; rows: number; cwd?: string; shell?: string }) => Promise<void>;
    resize: (id: string, cols: number, rows: number) => Promise<void>;
    write: (id: string, data: string) => Promise<void>;
    kill: (id: string) => Promise<void>;
    onData: (callback: (data: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (data: { id: string; exitCode: number }) => void) => () => void;
  };
  app: {
    confirmCloseResponse: (response: { action: 'close' | 'cancel' | 'save' }) => Promise<void>;
    newWindow: () => Promise<{ success: boolean }>;
    onOpenFiles: (callback: (filePaths: string[]) => void) => () => void;
    ready: () => Promise<{ success: boolean }>;
    closeCurrentWindow: () => Promise<{ success: boolean }>;
  };
  system: {
    getTheme: () => Promise<{ isDark: boolean }>;
    onThemeChange: (callback: (theme: { isDark: boolean }) => void) => () => void;
  };
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
  off: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
