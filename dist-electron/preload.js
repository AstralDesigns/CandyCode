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
    showContextMenu: (filePath, fileName, itemType) => electron_1.ipcRenderer.invoke('show-context-menu', filePath, fileName, itemType),
    copyFile: (sourcePath, destPath) => electron_1.ipcRenderer.invoke('copy-file', sourcePath, destPath),
    moveFile: (sourcePath, destPath) => electron_1.ipcRenderer.invoke('move-file', sourcePath, destPath),
    trashFile: (filePath) => electron_1.ipcRenderer.invoke('trash-file', filePath),
    renameFile: (oldPath, newName) => electron_1.ipcRenderer.invoke('rename-file', oldPath, newName),
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
    project: {
        setCurrent: (projectPath) => electron_1.ipcRenderer.invoke('project:set-current', projectPath),
        onLoadPath: (callback) => {
            const handler = (_, projectPath) => callback(projectPath);
            electron_1.ipcRenderer.on('project:load-path', handler);
            return () => {
                electron_1.ipcRenderer.removeListener('project:load-path', handler);
            };
        },
    },
    on: (channel, callback) => {
        electron_1.ipcRenderer.on(channel, callback);
    },
    off: (channel, callback) => {
        electron_1.ipcRenderer.removeListener(channel, callback);
    },
});
//# sourceMappingURL=preload.js.map