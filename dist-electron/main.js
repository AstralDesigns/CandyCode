"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const ai_backend_service_1 = require("./services/ai-backend.service");
const isDev = !electron_1.app.isPackaged;
// Path to store the last opened project
const projectStorePath = path.join(electron_1.app.getPath('userData'), 'last-opened-project.json');
// Function to save the last opened project path
async function saveLastOpenedProject(projectPath) {
    try {
        if (projectPath) {
            await fs.writeFile(projectStorePath, JSON.stringify({ path: projectPath }), 'utf-8');
            console.log('[Electron] Saved last opened project:', projectPath);
        }
        else {
            // If projectPath is null, delete the file to indicate no project is open
            await fs.unlink(projectStorePath).catch(() => { }); // Ignore error if file doesn't exist
            console.log('[Electron] Cleared last opened project.');
        }
    }
    catch (error) {
        console.error('[Electron] Failed to save last opened project:', error);
    }
}
// Function to load the last opened project path
async function loadLastOpenedProject() {
    try {
        const data = await fs.readFile(projectStorePath, 'utf-8');
        const config = JSON.parse(data);
        console.log('[Electron] Loaded last opened project:', config.path);
        return config.path;
    }
    catch (error) {
        // File not found or parsing error, assume no last opened project
        console.log('[Electron] No last opened project found or failed to load.', error);
        return null;
    }
}
// Configure Electron for hybrid graphics and GPU issues
if (process.platform === 'linux') {
    const forceHardware = process.env.ALPHASTUDIO_HARDWARE_ACCEL === '1';
    if (!forceHardware) {
        electron_1.app.commandLine.appendSwitch('--disable-gpu');
        electron_1.app.commandLine.appendSwitch('--disable-gpu-compositing');
    }
    else {
        electron_1.app.commandLine.appendSwitch('--disable-gpu-sandbox');
        electron_1.app.commandLine.appendSwitch('--use-gl', 'egl');
        electron_1.app.commandLine.appendSwitch('--enable-gpu-rasterization');
        if (!process.env.DRI_PRIME) {
            process.env.DRI_PRIME = '1';
        }
    }
}
// Initialize AI service
const aiBackendService = new ai_backend_service_1.AIBackendService();
/**
 * Auto-start Ollama if it's not running
 */
async function ensureOllamaRunning() {
    console.log('[Ollama] Checking if Ollama is running...');
    const ollamaService = aiBackendService.getOllamaService();
    const status = await ollamaService.checkServerStatus();
    if (status.running) {
        console.log('[Ollama] Ollama is already running.');
        // Auto-load the previously selected Ollama model
        await autoLoadOllamaModel();
        return;
    }
    console.log('[Ollama] Ollama not running, attempting to start...');
    const platform = process.platform;
    let command = 'ollama serve';
    if (platform === 'win32') {
        // On Windows, Ollama might be in a specific path
        const possiblePaths = [
            path.join(process.env.LOCALAPPDATA || '', 'Ollama', 'ollama.exe'),
            'ollama.exe'
        ];
        for (const p of possiblePaths) {
            try {
                await fs.access(p);
                command = `"${p}" serve`;
                break;
            }
            catch (e) { }
        }
    }
    const ollamaProcess = (0, child_process_1.spawn)(command, {
        shell: true,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434' }
    });
    ollamaProcess.unref();
    console.log('[Ollama] Ollama start command issued.');
    // Wait a bit and check again
    setTimeout(async () => {
        const newStatus = await ollamaService.checkServerStatus();
        if (newStatus.running) {
            console.log('[Ollama] Ollama started successfully.');
            // Auto-load the previously selected Ollama model
            await autoLoadOllamaModel();
        }
        else {
            console.warn('[Ollama] Ollama failed to start automatically. User may need to start it manually.');
        }
    }, 5000);
}
/**
 * Auto-load the previously selected Ollama model on app startup
 */
async function autoLoadOllamaModel() {
    try {
        const ollamaService = aiBackendService.getOllamaService();
        const ollamaModelPath = path.join(electron_1.app.getPath('userData'), 'ollama-active-model.json');
        try {
            const data = await fs.readFile(ollamaModelPath, 'utf-8');
            const config = JSON.parse(data);
            const modelName = config.model;
            if (modelName) {
                console.log('[Ollama] Auto-loading previously selected model:', modelName);
                const result = await ollamaService.runModel(modelName);
                if (result.success) {
                    console.log('[Ollama] Model auto-loaded successfully:', modelName);
                }
                else {
                    console.warn('[Ollama] Failed to auto-load model:', modelName, result.error);
                }
            }
        }
        catch (error) {
            // File doesn't exist or parsing error - no model was previously selected
            console.log('[Ollama] No previously selected model to auto-load.');
        }
    }
    catch (error) {
        console.error('[Ollama] Error auto-loading model:', error);
    }
}
// Helper function to recursively copy directories
async function copyDirectory(source, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDirectory(sourcePath, destPath);
        }
        else {
            await fs.copyFile(sourcePath, destPath);
        }
    }
}
let mainWindow = null;
let projectWatcher = null;
let currentProjectPath = null;
// Debouncing for file watcher events
const fileWatcherDebounceMap = new Map();
const processedEvents = new Set();
const DEBOUNCE_DELAY = 150; // ms
function createWindow() {
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log('[Electron] Preload path:', preloadPath);
    // Check if preload exists (warn but don't fail)
    fs.access(preloadPath).catch(() => {
        console.warn('[Electron] Warning: Preload script not found at:', preloadPath);
    });
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        frame: true,
        backgroundColor: '#0a0e27',
        show: true, // Show immediately
        autoHideMenuBar: true,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: false,
            devTools: isDev, // Enable dev tools in dev mode
        },
        icon: path.join(__dirname, '../assets/icon.png'),
    });
    // Ensure window is visible and focused
    mainWindow.show();
    mainWindow.focus();
    // Window is already shown, but ensure it stays visible
    const ensureVisible = () => {
        if (mainWindow && !mainWindow.isVisible()) {
            console.log('[Electron] Ensuring window is visible');
            mainWindow.show();
            mainWindow.focus();
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
        }
    };
    // Check visibility periodically
    const visibilityCheck = setInterval(ensureVisible, 1000);
    // Clear interval when window closes
    mainWindow.on('closed', () => {
        clearInterval(visibilityCheck);
    });
    // Handle page load errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('[Electron] Page load failed:', errorCode, errorDescription, validatedURL);
        // Show error page if load fails
        if (mainWindow) {
            const errorHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>AlphaStudio - Loading Error</title>
            <style>
              body {
                background: #0a0e27;
                color: #e2e8f0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                padding: 20px;
              }
              .error-container {
                text-align: center;
                max-width: 600px;
              }
              h1 { color: #fbbf24; margin-bottom: 10px; }
              p { color: #94a3b8; line-height: 1.6; }
              code { background: #1e293b; padding: 2px 6px; border-radius: 3px; }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1>Unable to Load AlphaStudio</h1>
              <p>Error: <code>${errorDescription}</code></p>
              <p>Code: <code>${errorCode}</code></p>
              <p>URL: <code>${validatedURL}</code></p>
              <p style="margin-top: 20px;">Please check that the Vite dev server is running on port 5173.</p>
            </div>
          </body>
        </html>
      `;
            mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`).catch(() => { });
            if (!mainWindow.isVisible()) {
                console.log('[Electron] Showing window despite load error');
                mainWindow.show();
                mainWindow.focus();
                if (mainWindow.isMinimized()) {
                    mainWindow.restore();
                }
            }
        }
    });
    // Log when page starts loading
    mainWindow.webContents.on('did-start-loading', () => {
        console.log('[Electron] Page started loading');
    });
    // Log when page finishes loading
    mainWindow.webContents.on('did-finish-load', async () => {
        console.log('[Electron] Page finished loading');
        // Ensure window is visible after page loads
        if (mainWindow && !mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.focus();
        }
        // Attempt to load the last opened project
        const lastProjectPath = await loadLastOpenedProject();
        if (lastProjectPath) {
            console.log('[Electron] Sending last opened project path to renderer:', lastProjectPath);
            setupProjectWatcher(lastProjectPath);
            mainWindow?.webContents.send('project:load-path', lastProjectPath);
        }
    });
    // Log console messages from renderer
    mainWindow.webContents.on('console-message', (event, level, message) => {
        console.log(`[Renderer ${level}]:`, message);
    });
    // Handle DOM ready
    mainWindow.webContents.on('dom-ready', () => {
        console.log('[Electron] DOM ready');
        // Inject error handler to catch React errors
        mainWindow?.webContents.executeJavaScript(`
      window.addEventListener('error', (e) => {
        console.error('[Renderer Error]:', e.error);
      });
      window.addEventListener('unhandledrejection', (e) => {
        console.error('[Renderer Unhandled Rejection]:', e.reason);
      });
    `).catch(() => { });
    });
    if (isDev) {
        console.log('[Electron] Loading dev URL: http://localhost:5173');
        // Check if Vite server is ready before loading
        const checkViteServer = async (retries = 20) => {
            try {
                const http = await Promise.resolve().then(() => __importStar(require('http')));
                return new Promise((resolve) => {
                    const req = http.get('http://localhost:5173', (res) => {
                        resolve(res.statusCode === 200);
                    });
                    req.on('error', () => {
                        if (retries > 0) {
                            setTimeout(() => checkViteServer(retries - 1).then(resolve), 500);
                        }
                        else {
                            resolve(false);
                        }
                    });
                    req.setTimeout(1000, () => {
                        req.destroy();
                        if (retries > 0) {
                            setTimeout(() => checkViteServer(retries - 1).then(resolve), 500);
                        }
                        else {
                            resolve(false);
                        }
                    });
                });
            }
            catch (err) {
                return false;
            }
        };
        // Wait for Vite server, then load
        checkViteServer().then((ready) => {
            if (ready) {
                console.log('[Electron] Vite server ready, loading URL...');
                mainWindow?.loadURL('http://localhost:5173').catch((err) => {
                    console.error('[Electron] Failed to load URL:', err.message);
                    // Window is already visible
                });
            }
            else {
                console.error('[Electron] Vite server not ready after retries. Loading anyway...');
                mainWindow?.loadURL('http://localhost:5173').catch((err) => {
                    console.error('[Electron] Failed to load URL:', err.message);
                });
                // Window is already visible
            }
        });
    }
    else {
        console.log('[Electron] Loading production file');
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch((err) => {
            console.error('[Electron] Failed to load file:', err);
            // Window is already visible
        });
    }
    // Toggle dev tools with SHIFT+F12
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.shift && input.key === 'F12') {
            if (mainWindow?.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
            }
            else {
                mainWindow?.webContents.openDevTools();
            }
        }
    });
    // Removed ready-to-show handler - using fallback timeout as primary method
    // Set main window reference immediately
    if (mainWindow) {
        aiBackendService.setMainWindow(mainWindow);
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// Register IPC handlers
electron_1.ipcMain.handle('ai-backend:chat', async (_, prompt, options) => {
    try {
        await aiBackendService.chatStream(prompt, options);
    }
    catch (error) {
        console.error('[AIBackend] Chat error:', error);
        if (mainWindow) {
            mainWindow.webContents.send('ai-backend:chunk', {
                type: 'error',
                data: error.message || String(error),
            });
            mainWindow.webContents.send('ai-backend:chunk', { type: 'done' });
        }
        throw error;
    }
});
electron_1.ipcMain.handle('ai-backend:cancel', () => {
    aiBackendService.cancel();
});
electron_1.ipcMain.handle('ai-backend:list-models', async () => {
    return await aiBackendService.listModels();
});
// Ollama Model Management IPC Handlers
electron_1.ipcMain.handle('ollama:check-server', async () => {
    return await aiBackendService.getOllamaService().checkServerStatus();
});
electron_1.ipcMain.handle('ollama:list-models', async () => {
    return await aiBackendService.getOllamaService().listModels();
});
electron_1.ipcMain.handle('ollama:pull-model', async (_, modelName) => {
    const ollamaService = aiBackendService.getOllamaService();
    let lastProgress = '';
    return new Promise((resolve) => {
        ollamaService.pullModel(modelName, (progress) => {
            lastProgress = progress;
            if (mainWindow) {
                mainWindow.webContents.send('ollama:pull-progress', { modelName, progress });
            }
        }).then((result) => {
            resolve({ ...result, lastProgress });
        });
    });
});
electron_1.ipcMain.handle('ollama:delete-model', async (_, modelName) => {
    return await aiBackendService.getOllamaService().deleteModel(modelName);
});
electron_1.ipcMain.handle('ollama:search-models', async (_, query) => {
    return await aiBackendService.getOllamaService().searchModels(query);
});
// Run/load an Ollama model into memory
electron_1.ipcMain.handle('ollama:run-model', async (_, modelName) => {
    console.log('[Main] Running Ollama model:', modelName);
    const result = await aiBackendService.getOllamaService().runModel(modelName);
    // If successful, persist the model selection for auto-load on next app start
    if (result.success) {
        try {
            const ollamaModelPath = path.join(electron_1.app.getPath('userData'), 'ollama-active-model.json');
            await fs.writeFile(ollamaModelPath, JSON.stringify({ model: modelName }, null, 2), 'utf-8');
            console.log('[Main] Persisted Ollama model selection:', modelName);
        }
        catch (e) {
            console.warn('[Main] Could not persist model selection:', e);
        }
    }
    return result;
});
// Web Search IPC Handler
electron_1.ipcMain.handle('web:search', async (_, query, maxResults = 5) => {
    const { webSearchService } = await Promise.resolve().then(() => __importStar(require('./services/web-search.service')));
    return await webSearchService.search(query, maxResults);
});
// File system watcher setup
function setupProjectWatcher(projectPath) {
    // Close existing watcher
    if (projectWatcher) {
        projectWatcher.close();
        projectWatcher = null;
    }
    currentProjectPath = projectPath;
    if (!projectPath || !mainWindow)
        return;
    try {
        let resolvedPath = projectPath.startsWith('~') ? projectPath.replace(/^~/, os.homedir()) : projectPath;
        projectWatcher = (0, fs_1.watch)(resolvedPath, { recursive: true }, (eventType, filename) => {
            if (!mainWindow || !filename)
                return;
            const filePath = path.join(resolvedPath, filename);
            const relativePath = path.relative(resolvedPath, filePath);
            const eventKey = `${eventType}:${relativePath}`;
            // Clear existing debounce timer for this event
            const existingTimer = fileWatcherDebounceMap.get(eventKey);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            // Create new debounced handler
            const timer = setTimeout(() => {
                // Check if we've already processed this exact event recently
                if (processedEvents.has(eventKey)) {
                    processedEvents.delete(eventKey);
                    return;
                }
                processedEvents.add(eventKey);
                // Determine event type
                if (eventType === 'rename') {
                    // Check if this is part of a rename operation we're already handling
                    const isRenameOperation = processedEvents.has(`rename:${relativePath}`);
                    if (isRenameOperation) {
                        // This is from our explicit rename, skip watcher event
                        fileWatcherDebounceMap.delete(eventKey);
                        return;
                    }
                    // Check if file exists to determine if it was created or deleted
                    fs.access(filePath).then(() => {
                        // File exists - it was created or renamed to this
                        mainWindow?.webContents.send('file-system:created', {
                            path: projectPath.startsWith('~') ? `~/${relativePath}` : relativePath,
                            resolvedPath: filePath
                        });
                        // Clean up after a delay
                        setTimeout(() => processedEvents.delete(eventKey), 1000);
                    }).catch(() => {
                        // File doesn't exist - it was deleted
                        mainWindow?.webContents.send('file-system:deleted', {
                            path: projectPath.startsWith('~') ? `~/${relativePath}` : relativePath,
                            resolvedPath: filePath
                        });
                        // Clean up after a delay
                        setTimeout(() => processedEvents.delete(eventKey), 1000);
                    });
                }
                else if (eventType === 'change') {
                    // File was modified
                    mainWindow?.webContents.send('file-system:modified', {
                        path: projectPath.startsWith('~') ? `~/${relativePath}` : relativePath,
                        resolvedPath: filePath
                    });
                    // Clean up after a delay
                    setTimeout(() => processedEvents.delete(eventKey), 1000);
                }
                fileWatcherDebounceMap.delete(eventKey);
            }, DEBOUNCE_DELAY);
            fileWatcherDebounceMap.set(eventKey, timer);
        });
        console.log('[Electron] Started file watcher for project:', resolvedPath);
    }
    catch (error) {
        console.error('[Electron] Failed to setup file watcher:', error);
    }
}
// New IPC handler to set the current project path from the renderer
electron_1.ipcMain.handle('project:set-current', async (_, projectPath) => {
    await saveLastOpenedProject(projectPath);
    setupProjectWatcher(projectPath);
});
// IPC handler for trashing a file
electron_1.ipcMain.handle('trash-file', async (_, filePath) => {
    try {
        let resolvedPath = filePath.startsWith('~') ? filePath.replace(/^~/, os.homedir()) : filePath;
        await electron_1.shell.trashItem(resolvedPath);
        return { success: true };
    }
    catch (error) {
        console.error('[Electron] Failed to trash file:', error);
        return { success: false, error: error.message };
    }
});
// IPC handler for renaming a file or folder
electron_1.ipcMain.handle('rename-file', async (_, oldPath, newName) => {
    try {
        let resolvedOldPath = oldPath.startsWith('~') ? oldPath.replace(/^~/, os.homedir()) : oldPath;
        // Validate new name
        if (!newName || newName.trim() === '') {
            return { success: false, error: 'New name cannot be empty' };
        }
        // Remove invalid characters (OS-specific)
        const invalidChars = process.platform === 'win32' ? /[<>:"/\\|?*]/ : /[/]/;
        if (invalidChars.test(newName)) {
            return { success: false, error: 'New name contains invalid characters' };
        }
        const dir = path.dirname(resolvedOldPath);
        const newPath = path.join(dir, newName.trim());
        // Check if target already exists
        try {
            await fs.access(newPath);
            return { success: false, error: 'A file or folder with that name already exists' };
        }
        catch {
            // Target doesn't exist, proceed with rename
        }
        await fs.rename(resolvedOldPath, newPath);
        // Mark this as a rename operation to suppress duplicate watcher events
        const relativeOldPath = currentProjectPath ? path.relative(currentProjectPath.replace(/^~/, os.homedir()), resolvedOldPath) : '';
        const relativeNewPath = currentProjectPath ? path.relative(currentProjectPath.replace(/^~/, os.homedir()), newPath) : '';
        if (relativeOldPath && relativeNewPath && currentProjectPath) {
            // Mark both old and new paths as being renamed to suppress watcher events
            processedEvents.add(`rename:${relativeOldPath}`);
            processedEvents.add(`rename:${relativeNewPath}`);
            setTimeout(() => {
                processedEvents.delete(`rename:${relativeOldPath}`);
                processedEvents.delete(`rename:${relativeNewPath}`);
            }, 2000);
        }
        // Notify renderer about the rename for file watching
        if (mainWindow) {
            mainWindow.webContents.send('file-system:renamed', {
                oldPath: oldPath,
                newPath: path.join(path.dirname(oldPath), newName.trim()),
                oldResolvedPath: resolvedOldPath,
                newResolvedPath: newPath
            });
        }
        return { success: true, newPath };
    }
    catch (error) {
        console.error('[Electron] Failed to rename file:', error);
        return { success: false, error: error.message };
    }
});
electron_1.app.whenReady().then(() => {
    console.log('[Electron] App ready, creating window...');
    createWindow();
    // Auto-start Ollama
    ensureOllamaRunning();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            console.log('[Electron] App activated, creating window...');
            createWindow();
        }
    });
});
// Log any uncaught errors
process.on('uncaughtException', (error) => {
    console.error('[Electron] Uncaught exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Electron] Unhandled rejection at:', promise, 'reason:', reason);
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // On non-macOS, quit the app immediately if all windows are closed.
        // We've already handled saving the project via project:set-current IPC.
        electron_1.app.quit();
    }
});
// File system IPC Handlers
electron_1.ipcMain.handle('read-directory', async (_, dirPath) => {
    try {
        let resolvedPath = dirPath;
        if (dirPath === '~' || dirPath.startsWith('~/')) {
            resolvedPath = dirPath.replace(/^~/, os.homedir());
        }
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
            return { error: `Path is a file, not a directory: ${dirPath}` };
        }
        const items = await fs.readdir(resolvedPath, { withFileTypes: true });
        const itemsWithSizes = await Promise.all(items.map(async (item) => {
            const itemPath = path.join(resolvedPath, item.name);
            const size = item.isFile() ? (await fs.stat(itemPath)).size : undefined;
            return {
                name: item.name,
                path: itemPath,
                type: item.isDirectory() ? 'folder' : 'file',
                size,
            };
        }));
        return itemsWithSizes;
    }
    catch (error) {
        return { error: error.message };
    }
});
electron_1.ipcMain.handle('read-file', async (_, filePath) => {
    try {
        const resolvedPath = filePath.startsWith('~')
            ? filePath.replace('~', os.homedir())
            : filePath;
        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory()) {
            return { error: `Path is a directory, not a file: ${resolvedPath}` };
        }
        const ext = path.extname(resolvedPath).toLowerCase();
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
        if (imageExtensions.includes(ext) && ext !== '.svg') {
            const buffer = await fs.readFile(resolvedPath);
            const base64 = buffer.toString('base64');
            const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.slice(1)}`;
            return { content: `data:${mimeType};base64,${base64}`, encoding: 'base64' };
        }
        const content = await fs.readFile(resolvedPath, 'utf-8');
        return { content, encoding: 'utf-8' };
    }
    catch (error) {
        return { error: error.message };
    }
});
electron_1.ipcMain.handle('write-file', async (_, filePath, content) => {
    try {
        let resolvedPath = filePath;
        if (filePath.startsWith('~/') || filePath === '~') {
            resolvedPath = filePath.replace(/^~/, os.homedir());
        }
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolvedPath, content, 'utf-8');
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
});
// Handle diff approval - write file when approved
electron_1.ipcMain.handle('approve-diff', async (_, filePath, content) => {
    try {
        let resolvedPath = filePath;
        if (filePath.startsWith('~/') || filePath === '~') {
            resolvedPath = filePath.replace(/^~/, os.homedir());
        }
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolvedPath, content, 'utf-8');
        // Notify AI backend that file was approved (if agent is waiting)
        if (mainWindow) {
            mainWindow.webContents.send('file-operation:diff-approved', { filePath });
        }
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
});
// Handle diff rejection - notify agent
electron_1.ipcMain.handle('reject-diff', async (_, filePath) => {
    try {
        // Notify AI backend that file was rejected (agent should query user)
        if (mainWindow) {
            mainWindow.webContents.send('file-operation:diff-rejected', { filePath });
        }
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
});
// Handle check for pending approvals
electron_1.ipcMain.handle('ai-backend:check-pending-approvals', async () => {
    // This will be handled by the renderer process checking the store
    return false; // Default to no pending
});
electron_1.ipcMain.on('ai-backend:pending-approvals-status', (event, hasPending) => {
    // Forward status to AI backend service if needed
});
electron_1.ipcMain.handle('show-open-dialog', async (_, options) => {
    try {
        const win = electron_1.BrowserWindow.fromWebContents(_.sender) || mainWindow;
        const result = await electron_1.dialog.showOpenDialog(win, options);
        // If a directory was selected, save it as the last opened project
        if (!result.canceled && result.filePaths.length > 0 && options.properties?.includes('openDirectory')) {
            await saveLastOpenedProject(result.filePaths[0]);
        }
        return result;
    }
    catch (error) {
        return { canceled: true, error: error.message };
    }
});
electron_1.ipcMain.handle('show-save-dialog', async (_, options) => {
    try {
        const win = electron_1.BrowserWindow.fromWebContents(_.sender) || mainWindow;
        const result = await electron_1.dialog.showSaveDialog(win, options);
        return result;
    }
    catch (error) {
        return { canceled: true, error: error.message };
    }
});
electron_1.ipcMain.handle('execute-command', async (_, command, options = {}) => {
    const { cwd = process.cwd(), timeout = 30000 } = options;
    // Security: Block dangerous commands
    const lowerCommand = command.toLowerCase().trim();
    const dangerousPatterns = [
        /rm\s+-rf\s+\//,
        /rm\s+-rf\s+~/,
        /format\s+c:/i,
        /shutdown/i,
        /reboot/i,
    ];
    if (dangerousPatterns.some(pattern => pattern.test(lowerCommand))) {
        return {
            error: 'Command blocked for security reasons',
            stdout: '',
            stderr: '',
            exitCode: -1,
        };
    }
    return new Promise((resolve) => {
        const child = (0, child_process_1.spawn)(command, [], {
            cwd,
            shell: true,
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        let timeoutId = null;
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                child.kill();
                resolve({
                    error: 'Command timed out',
                    stdout,
                    stderr,
                    exitCode: -1,
                });
            }, timeout);
        }
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('close', (code) => {
            if (timeoutId)
                clearTimeout(timeoutId);
            resolve({
                stdout,
                stderr,
                exitCode: code || 0,
                error: code !== 0 ? `Command exited with code ${code}` : undefined,
            });
        });
        child.on('error', (error) => {
            if (timeoutId)
                clearTimeout(timeoutId);
            resolve({
                error: error.message,
                stdout,
                stderr,
                exitCode: -1,
            });
        });
    });
});
electron_1.ipcMain.handle('get-system-info', async () => {
    return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cwd: process.cwd(),
        homeDir: os.homedir(),
    };
});
electron_1.ipcMain.handle('open-external', async (_, url) => {
    try {
        await electron_1.shell.openExternal(url);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Context menu handler
electron_1.ipcMain.handle('show-context-menu', async (event, filePath, fileName) => {
    return new Promise((resolve) => {
        const menu = new electron_1.Menu();
        menu.append(new electron_1.MenuItem({
            label: 'Open',
            click: () => {
                event.sender.send('context-menu-action', 'open-file', { filePath, fileName });
                resolve({ action: 'open-file' });
            },
        }));
        menu.append(new electron_1.MenuItem({
            label: 'Add to Context',
            click: () => {
                event.sender.send('context-menu-action', 'add-to-context', { filePath, fileName });
                resolve({ action: 'add-to-context' });
            },
        }));
        menu.append(new electron_1.MenuItem({ type: 'separator' }));
        menu.append(new electron_1.MenuItem({
            label: 'Copy to...',
            click: async () => {
                const win = electron_1.BrowserWindow.fromWebContents(event.sender);
                if (!win)
                    return;
                const result = await electron_1.dialog.showOpenDialog(win, {
                    title: `Copy "${fileName}" to...`,
                    properties: ['openDirectory'],
                    buttonLabel: 'Copy Here',
                });
                if (!result.canceled && result.filePaths.length > 0) {
                    const destDir = result.filePaths[0];
                    const destPath = path.join(destDir, fileName);
                    let resolvedSource = filePath.startsWith('~') ? filePath.replace(/^~/, os.homedir()) : filePath;
                    try {
                        const stats = await fs.stat(resolvedSource);
                        if (stats.isDirectory()) {
                            await copyDirectory(resolvedSource, destPath);
                        }
                        else {
                            await fs.copyFile(resolvedSource, destPath);
                        }
                        event.sender.send('context-menu-action', 'copy-complete', { filePath, fileName, destPath });
                        resolve({ action: 'copy', success: true });
                    }
                    catch (error) {
                        event.sender.send('context-menu-action', 'copy-error', { filePath, fileName, error: error.message });
                        resolve({ action: 'copy', error: error.message });
                    }
                }
            },
        }));
        menu.append(new electron_1.MenuItem({
            label: 'Move to...',
            click: async () => {
                const win = electron_1.BrowserWindow.fromWebContents(event.sender);
                if (!win)
                    return;
                const result = await electron_1.dialog.showOpenDialog(win, {
                    title: `Move "${fileName}" to...`,
                    properties: ['openDirectory'],
                    buttonLabel: 'Move Here',
                });
                if (!result.canceled && result.filePaths.length > 0) {
                    const destDir = result.filePaths[0];
                    const destPath = path.join(destDir, fileName);
                    let resolvedSource = filePath.startsWith('~') ? filePath.replace(/^~/, os.homedir()) : filePath;
                    try {
                        await fs.rename(resolvedSource, destPath);
                        event.sender.send('context-menu-action', 'move-complete', { filePath, fileName, destPath });
                        resolve({ action: 'move', success: true });
                    }
                    catch (error) {
                        event.sender.send('context-menu-action', 'move-error', { filePath, fileName, error: error.message });
                        resolve({ action: 'move', error: error.message });
                    }
                }
            },
        }));
        menu.append(new electron_1.MenuItem({ type: 'separator' }));
        menu.append(new electron_1.MenuItem({
            label: 'Delete',
            click: async () => {
                const win = electron_1.BrowserWindow.fromWebContents(event.sender);
                if (!win)
                    return;
                const result = await electron_1.dialog.showMessageBox(win, {
                    type: 'warning',
                    title: 'Delete Item',
                    message: `Are you sure you want to delete "${fileName}"?`,
                    detail: 'This will move the item to the trash.',
                    buttons: ['Cancel', 'Delete'],
                    defaultId: 0,
                    cancelId: 0,
                });
                if (result.response === 1) {
                    let resolvedPath = filePath.startsWith('~') ? filePath.replace(/^~/, os.homedir()) : filePath;
                    try {
                        await electron_1.shell.trashItem(resolvedPath);
                        event.sender.send('context-menu-action', 'trash-complete', { filePath, fileName });
                        resolve({ action: 'trash', success: true });
                    }
                    catch (error) {
                        event.sender.send('context-menu-action', 'trash-error', { filePath, fileName, error: error.message });
                        resolve({ action: 'trash', error: error.message });
                    }
                }
            },
        }));
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win) {
            menu.popup({ window: win });
        }
    });
});
//# sourceMappingURL=main.js.map