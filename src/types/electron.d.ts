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
  showContextMenu: (filePath: string, fileName: string, itemType: 'file' | 'folder') => Promise<any>;
  copyFile: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
  moveFile: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
  trashFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  renameFile: (oldPath: string, newName: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  findFiles: (rootPath: string, query: string) => Promise<Array<{ name: string; path: string; type: 'file' }>>;
  project: {
    setCurrent: (projectPath: string | null) => Promise<void>;
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
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
  off: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
