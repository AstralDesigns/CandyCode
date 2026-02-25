"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    readDirectory: (path) => electron_1.ipcRenderer.invoke('read-directory', path),
    readFile: (path) => electron_1.ipcRenderer.invoke('read-file', path),
    writeFile: (path, content) => electron_1.ipcRenderer.invoke('write-file', path, content),
    approveDiff: (filePath, content) => electron_1.ipcRenderer.invoke('approve-diff', filePath, content),
    rejectDiff: (filePath) => electron_1.ipcRenderer.invoke('reject-diff', filePath),
    showOpenDialog: (options) => electron_1.ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => electron_1.ipcRenderer.invoke('show-save-dialog', options),
    executeCommand: (command, options) => electron_1.ipcRenderer.invoke('execute-command', command, options),
    getSystemInfo: () => electron_1.ipcRenderer.invoke('get-system-info'),
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    getAppAssetPath: (assetName) => electron_1.ipcRenderer.invoke('get-app-asset-path', assetName),
    showContextMenu: (filePath, fileName, itemType) => electron_1.ipcRenderer.invoke('show-context-menu', filePath, fileName, itemType),
    copyFile: (sourcePath, destPath) => electron_1.ipcRenderer.invoke('copy-file', sourcePath, destPath),
    moveFile: (sourcePath, destPath) => electron_1.ipcRenderer.invoke('move-file', sourcePath, destPath),
    trashFile: (filePath) => electron_1.ipcRenderer.invoke('trash-file', filePath),
    renameFile: (oldPath, newName) => electron_1.ipcRenderer.invoke('rename-file', oldPath, newName),
    findFiles: (rootPath, query) => electron_1.ipcRenderer.invoke('find-files', rootPath, query),
    aiBackend: {
        chat: (prompt, options) => electron_1.ipcRenderer.invoke('ai-backend:chat', prompt, options),
        cancel: () => electron_1.ipcRenderer.invoke('ai-backend:cancel'),
        onChunk: (callback) => {
            electron_1.ipcRenderer.on('ai-backend:chunk', (_, chunk) => {
                callback(chunk);
            });
        },
        removeAllListeners: (channel) => {
            electron_1.ipcRenderer.removeAllListeners(channel);
        },
        listModels: () => electron_1.ipcRenderer.invoke('ai-backend:list-models'),
    },
    webSearch: (query, maxResults) => electron_1.ipcRenderer.invoke('web:search', query, maxResults),
    ollama: {
        checkServer: () => electron_1.ipcRenderer.invoke('ollama:check-server'),
        listModels: () => electron_1.ipcRenderer.invoke('ollama:list-models'),
        pullModel: (modelName) => electron_1.ipcRenderer.invoke('ollama:pull-model', modelName),
        deleteModel: (modelName) => electron_1.ipcRenderer.invoke('ollama:delete-model', modelName),
        searchModels: (query) => electron_1.ipcRenderer.invoke('ollama:search-models', query),
        runModel: (modelName) => electron_1.ipcRenderer.invoke('ollama:run-model', modelName),
        onPullProgress: (callback) => {
            const handler = (_, data) => callback(data);
            electron_1.ipcRenderer.on('ollama:pull-progress', handler);
            return () => {
                electron_1.ipcRenderer.removeListener('ollama:pull-progress', handler);
            };
        },
    },
    pty: {
        create: (options) => electron_1.ipcRenderer.invoke('pty:create', options),
        resize: (id, cols, rows) => electron_1.ipcRenderer.invoke('pty:resize', { id, cols, rows }),
        write: (id, data) => electron_1.ipcRenderer.invoke('pty:write', { id, data }),
        kill: (id) => electron_1.ipcRenderer.invoke('pty:kill', { id }),
        onData: (callback) => {
            const handler = (_, data) => callback(data);
            electron_1.ipcRenderer.on('pty:data', handler);
            return () => electron_1.ipcRenderer.removeListener('pty:data', handler);
        },
        onExit: (callback) => {
            const handler = (_, data) => callback(data);
            electron_1.ipcRenderer.on('pty:exit', handler);
            return () => electron_1.ipcRenderer.removeListener('pty:exit', handler);
        }
    },
    project: {
        setCurrent: (projectPath) => electron_1.ipcRenderer.invoke('project:set-current', projectPath),
        getCurrent: () => electron_1.ipcRenderer.invoke('project:get-current'),
        onLoadPath: (callback) => {
            const handler = (_, projectPath) => callback(projectPath);
            electron_1.ipcRenderer.on('project:load-path', handler);
            return () => {
                electron_1.ipcRenderer.removeListener('project:load-path', handler);
            };
        },
    },
    app: {
        onOpenFiles: (callback) => {
            const handler = (_, filePaths) => callback(filePaths);
            electron_1.ipcRenderer.on('app:open-files', handler);
            return () => {
                electron_1.ipcRenderer.removeListener('app:open-files', handler);
            };
        },
        ready: () => electron_1.ipcRenderer.invoke('app:ready'),
        newWindow: () => electron_1.ipcRenderer.invoke('app:new-window'),
        closeCurrentWindow: () => electron_1.ipcRenderer.invoke('app:close-current-window'),
        confirmCloseResponse: (response) => electron_1.ipcRenderer.invoke('app:confirm-close-response', response),
    },
    system: {
        getTheme: () => electron_1.ipcRenderer.invoke('system:get-theme'),
        onThemeChange: (callback) => {
            electron_1.ipcRenderer.invoke('system:on-theme-change');
            const handler = (_, theme) => callback(theme);
            electron_1.ipcRenderer.on('system:theme-changed', handler);
            return () => {
                electron_1.ipcRenderer.removeListener('system:theme-changed', handler);
            };
        },
    },
    eslint: {
        lintFile: (filePath, content) => electron_1.ipcRenderer.invoke('eslint:lint-file', filePath, content),
        lintFiles: (files) => electron_1.ipcRenderer.invoke('eslint:lint-files', files),
        setEnabled: (enabled) => electron_1.ipcRenderer.invoke('eslint:set-enabled', enabled),
        isEnabled: () => electron_1.ipcRenderer.invoke('eslint:is-enabled'),
        reloadConfig: () => electron_1.ipcRenderer.invoke('eslint:reload-config'),
    },
    on: (channel, callback) => {
        electron_1.ipcRenderer.on(channel, callback);
    },
    off: (channel, callback) => {
        electron_1.ipcRenderer.removeListener(channel, callback);
    },
});
//# sourceMappingURL=preload.js.map