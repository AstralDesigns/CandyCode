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
  getAppAssetPath: (assetName: string) => ipcRenderer.invoke('get-app-asset-path', assetName),
  showContextMenu: (filePath: string, fileName: string, itemType: 'file' | 'folder') =>
    ipcRenderer.invoke('show-context-menu', filePath, fileName, itemType),
  copyFile: (sourcePath: string, destPath: string) =>
    ipcRenderer.invoke('copy-file', sourcePath, destPath),
  moveFile: (sourcePath: string, destPath: string) =>
    ipcRenderer.invoke('move-file', sourcePath, destPath),
  trashFile: (filePath: string) => ipcRenderer.invoke('trash-file', filePath),
  renameFile: (oldPath: string, newName: string) => ipcRenderer.invoke('rename-file', oldPath, newName),
  findFiles: (rootPath: string, query: string) => ipcRenderer.invoke('find-files', rootPath, query),
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
  pty: {
    create: (options: { id: string; cols: number; rows: number; cwd?: string; shell?: string }) => ipcRenderer.invoke('pty:create', options),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('pty:resize', { id, cols, rows }),
    write: (id: string, data: string) => ipcRenderer.invoke('pty:write', { id, data }),
    kill: (id: string) => ipcRenderer.invoke('pty:kill', { id }),
    onData: (callback: (data: { id: string; data: string }) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('pty:data', handler);
      return () => ipcRenderer.removeListener('pty:data', handler);
    },
    onExit: (callback: (data: { id: string; exitCode: number }) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('pty:exit', handler);
      return () => ipcRenderer.removeListener('pty:exit', handler);
    }
  },
  project: {
    setCurrent: (projectPath: string | null) => ipcRenderer.invoke('project:set-current', projectPath),
    getCurrent: () => ipcRenderer.invoke('project:get-current'),
    onLoadPath: (callback: (projectPath: string) => void) => {
      const handler = (_: any, projectPath: string) => callback(projectPath);
      ipcRenderer.on('project:load-path', handler);
      return () => {
        ipcRenderer.removeListener('project:load-path', handler);
      };
    },
  },
  app: {
    onOpenFiles: (callback: (filePaths: string[]) => void) => {
      const handler = (_: any, filePaths: string[]) => callback(filePaths);
      ipcRenderer.on('app:open-files', handler);
      return () => {
        ipcRenderer.removeListener('app:open-files', handler);
      };
    },
    ready: () => ipcRenderer.invoke('app:ready'),
    newWindow: () => ipcRenderer.invoke('app:new-window'),
    closeCurrentWindow: () => ipcRenderer.invoke('app:close-current-window'),
    confirmCloseResponse: (response: { action: 'close' | 'cancel' | 'save' }) =>
      ipcRenderer.invoke('app:confirm-close-response', response),
  },
  system: {
    getTheme: () => ipcRenderer.invoke('system:get-theme'),
    onThemeChange: (callback: (theme: { isDark: boolean }) => void) => {
      ipcRenderer.invoke('system:on-theme-change');
      const handler = (_: any, theme: { isDark: boolean }) => callback(theme);
      ipcRenderer.on('system:theme-changed', handler);
      return () => {
        ipcRenderer.removeListener('system:theme-changed', handler);
      };
    },
  },
  eslint: {
    lintFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('eslint:lint-file', filePath, content),
    lintFiles: (files: Array<{ path: string; content: string }>) =>
      ipcRenderer.invoke('eslint:lint-files', files),
    setEnabled: (enabled: boolean) =>
      ipcRenderer.invoke('eslint:set-enabled', enabled),
    isEnabled: () =>
      ipcRenderer.invoke('eslint:is-enabled'),
    reloadConfig: () =>
      ipcRenderer.invoke('eslint:reload-config'),
  },
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
  },
  off: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
