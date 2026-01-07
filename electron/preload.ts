import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readDirectory: (path: string) => ipcRenderer.invoke('read-directory', path),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', path, content),
  approveDiff: (filePath: string, content: string) => ipcRenderer.invoke('approve-diff', filePath, content),
  rejectDiff: (filePath: string) => ipcRenderer.invoke('reject-diff', filePath),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  executeCommand: (command: string, options?: any) => ipcRenderer.invoke('execute-command', command, options),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  showContextMenu: (filePath: string, fileName: string, itemType: 'file' | 'folder') =>
    ipcRenderer.invoke('show-context-menu', filePath, fileName, itemType),
  copyFile: (sourcePath: string, destPath: string) =>
    ipcRenderer.invoke('copy-file', sourcePath, destPath),
  moveFile: (sourcePath: string, destPath: string) =>
    ipcRenderer.invoke('move-file', sourcePath, destPath),
  trashFile: (filePath: string) => ipcRenderer.invoke('trash-file', filePath),
  renameFile: (oldPath: string, newName: string) => ipcRenderer.invoke('rename-file', oldPath, newName),
  aiBackend: {
    chat: (prompt: string, options: any) => ipcRenderer.invoke('ai-backend:chat', prompt, options),
    cancel: () => ipcRenderer.invoke('ai-backend:cancel'),
    onChunk: (callback: (chunk: any) => void) => {
      ipcRenderer.on('ai-backend:chunk', (_, chunk: any) => {
        callback(chunk);
      });
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
    listModels: () => ipcRenderer.invoke('ai-backend:list-models'),
  },
  webSearch: (query: string, maxResults?: number) => ipcRenderer.invoke('web:search', query, maxResults),
  ollama: {
    checkServer: () => ipcRenderer.invoke('ollama:check-server'),
    listModels: () => ipcRenderer.invoke('ollama:list-models'),
    pullModel: (modelName: string) => ipcRenderer.invoke('ollama:pull-model', modelName),
    deleteModel: (modelName: string) => ipcRenderer.invoke('ollama:delete-model', modelName),
    searchModels: (query: string) => ipcRenderer.invoke('ollama:search-models', query),
    runModel: (modelName: string) => ipcRenderer.invoke('ollama:run-model', modelName),
    onPullProgress: (callback: (data: { modelName: string; progress: string }) => void) => {
      const handler = (_: any, data: { modelName: string; progress: string }) => callback(data);
      ipcRenderer.on('ollama:pull-progress', handler);
      return () => {
        ipcRenderer.removeListener('ollama:pull-progress', handler);
      };
    },
  },
  project: {
    setCurrent: (projectPath: string | null) => ipcRenderer.invoke('project:set-current', projectPath),
    onLoadPath: (callback: (projectPath: string) => void) => {
      const handler = (_: any, projectPath: string) => callback(projectPath);
      ipcRenderer.on('project:load-path', handler);
      return () => {
        ipcRenderer.removeListener('project:load-path', handler);
      };
    },
  },
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
  },
  off: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
