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
const fs_1 = require("fs");
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const fs_2 = require("fs");
const glob_1 = require("glob");
const ai_backend_service_1 = require("./services/ai-backend.service");
const system_tray_service_1 = require("./services/system-tray.service");
const pty = __importStar(require("node-pty"));
const isDev = !electron_1.app.isPackaged;
// Request single instance lock - prevents multiple app instances
// This ensures "Open With" opens files in the existing instance
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('[Electron] Another instance is already running - this is a secondary instance');
    // This is a secondary instance, quit immediately
    // The main instance will handle opening files via second-instance event
    electron_1.app.quit();
}
else {
    console.log('[Electron] Single instance lock acquired - this is the primary instance');
}
// Path to store the last opened project
const projectStorePath = path.join(electron_1.app.getPath('userData'), 'last-opened-project.json');
// --- PTY Terminal Management ---
const ptySessions = new Map();
function createPty(id, cols, rows, cwd, shellPath) {
    let shell = shellPath;
    if (!shell || shell.trim() === '') {
        shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
    }
    let targetCwd = cwd || os.homedir();
    try {
        if (cwd && cwd.startsWith('~')) {
            targetCwd = cwd.replace(/^~/, os.homedir());
        }
    }
    catch (e) {
        targetCwd = os.homedir();
    }
    const env = {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
    };
    try {
        if (ptySessions.has(id)) {
            console.log(`[PTY] Session \${id} already exists, killing it.`);
            ptySessions.get(id)?.kill();
            ptySessions.delete(id);
        }
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols: cols || 80,
            rows: rows || 24,
            cwd: targetCwd,
            env: env
        });
        ptySessions.set(id, ptyProcess);
        ptyProcess.onData((data) => {
            windows.forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('pty:data', { id, data });
                }
            });
        });
        ptyProcess.onExit(({ exitCode, signal }) => {
            ptySessions.delete(id);
            windows.forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('pty:exit', { id, exitCode });
                }
            });
        });
        console.log(`[PTY] Created session \${id} (shell: \${shell}, cols: \${cols}, rows: \${rows})`);
        return ptyProcess;
    }
    catch (error) {
        console.error('[PTY] Failed to create session:', error);
        return null;
    }
}
async function saveLastOpenedProject(projectPath) {
    try {
        if (projectPath) {
            await fs.writeFile(projectStorePath, JSON.stringify({ path: projectPath }), 'utf-8');
            console.log('[Electron] Saved last opened project:', projectPath);
        }
        else {
            await fs.unlink(projectStorePath).catch(() => { });
            console.log('[Electron] Cleared last opened project.');
        }
    }
    catch (error) {
        console.error('[Electron] Failed to save last opened project:', error);
    }
}
async function loadLastOpenedProject() {
    try {
        const data = await fs.readFile(projectStorePath, 'utf-8');
        const config = JSON.parse(data);
        console.log('[Electron] Loaded last opened project:', config.path);
        return config.path;
    }
    catch (error) {
        console.log('[Electron] No last opened project found or failed to load.', error);
        return null;
    }
}
if (process.platform === 'linux') {
    const forceHardware = process.env.CANDYCODE_HARDWARE_ACCEL === '1';
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
const aiBackendService = new ai_backend_service_1.AIBackendService();
async function ensureOllamaRunning() {
    console.log('[Ollama] Checking if Ollama is running...');
    const ollamaService = aiBackendService.getOllamaService();
    const status = await ollamaService.checkServerStatus();
    if (status.running) {
        console.log('[Ollama] Ollama is already running.');
        await autoLoadOllamaModel();
        return;
    }
    console.log('[Ollama] Ollama not running, attempting to start...');
    const platform = process.platform;
    let command = 'ollama serve';
    if (platform === 'win32') {
        const possiblePaths = [
            path.join(process.env.LOCALAPPDATA || '', 'Ollama', 'ollama.exe'),
            'ollama.exe'
        ];
        for (const p of possiblePaths) {
            try {
                await fs.access(p);
                command = `"\${p}" serve`;
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
    // Poll for Ollama to be ready (up to 15 seconds with retries)
    const maxRetries = 15;
    const retryDelay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        const newStatus = await ollamaService.checkServerStatus();
        if (newStatus.running) {
            console.log('[Ollama] Ollama started successfully after ' + (i + 1) + ' seconds.');
            await autoLoadOllamaModel();
            return;
        }
        console.log(`[Ollama] Waiting for Ollama to start... (${i + 1}/${maxRetries})`);
    }
    console.warn('[Ollama] Ollama failed to start automatically. User may need to:');
    console.warn('[Ollama]   1. Install Ollama from https://ollama.ai');
    console.warn('[Ollama]   2. Start Ollama manually by running: ollama serve');
}
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
            console.log('[Ollama] No previously selected model to auto-load.');
        }
    }
    catch (error) {
        console.error('[Ollama] Error auto-loading model:', error);
    }
}
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
const windows = [];
let projectWatcher = null;
let currentProjectPath = null;
let projectFilesCache = [];
let scanPromise = null;
const fileWatcherDebounceMap = new Map();
const processedEvents = new Set();
const DEBOUNCE_DELAY = 150;
async function scanProjectFiles(rootPath) {
    if (scanPromise)
        return scanPromise;
    scanPromise = (async () => {
        try {
            console.log('[Electron] Scanning project files for cache:', rootPath);
            let resolvedRoot = rootPath;
            if (rootPath === '~' || rootPath.startsWith('~/')) {
                resolvedRoot = rootPath.replace(/^~/, os.homedir());
            }
            const globRoot = resolvedRoot.replace(/\\/g, '/');
            const files = await (0, glob_1.glob)('**/*', {
                cwd: globRoot,
                nodir: true,
                dot: true,
                ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.DS_Store', '**/build/**', '**/.next/**', '**/.cache/**'],
                absolute: false
            });
            projectFilesCache = files;
            console.log(`[Electron] Cached \${files.length} files`);
        }
        catch (error) {
            console.error('[Electron] Failed to scan project files:', error);
            if (projectFilesCache.length === 0)
                projectFilesCache = [];
        }
        finally {
            scanPromise = null;
        }
    })();
    return scanPromise;
}
function createWindow() {
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log('[Electron] Preload path:', preloadPath);
    fs.access(preloadPath).catch(() => {
        console.warn('[Electron] Warning: Preload script not found at:', preloadPath);
    });
    const newWindow = new electron_1.BrowserWindow({
        width: 380,
        height: 500,
        minWidth: 380, // Allow much smaller window sizes
        minHeight: 185, // Allow much smaller window sizes
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        frame: true,
        backgroundColor: '#0a0e27',
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: false,
            devTools: isDev,
        },
        icon: path.join(__dirname, '../assets/icon.png'),
    });
    windows.push(newWindow);
    if (!mainWindow) {
        mainWindow = newWindow;
    }
    newWindow.webContents.on('context-menu', (event, params) => {
        const menu = new electron_1.Menu();
        if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
            for (const suggestion of params.dictionarySuggestions) {
                menu.append(new electron_1.MenuItem({
                    label: suggestion,
                    click: () => newWindow.webContents.replaceMisspelling(suggestion)
                }));
            }
            menu.append(new electron_1.MenuItem({ type: 'separator' }));
        }
        else if (params.misspelledWord) {
            menu.append(new electron_1.MenuItem({
                label: 'No suggestions',
                enabled: false
            }));
            menu.append(new electron_1.MenuItem({ type: 'separator' }));
        }
        menu.append(new electron_1.MenuItem({ role: 'undo' }));
        menu.append(new electron_1.MenuItem({ role: 'redo' }));
        menu.append(new electron_1.MenuItem({ type: 'separator' }));
        menu.append(new electron_1.MenuItem({ role: 'cut' }));
        menu.append(new electron_1.MenuItem({ role: 'copy' }));
        menu.append(new electron_1.MenuItem({ role: 'paste' }));
        menu.append(new electron_1.MenuItem({ role: 'delete' }));
        menu.append(new electron_1.MenuItem({ type: 'separator' }));
        menu.append(new electron_1.MenuItem({ role: 'selectAll' }));
        if (params.isEditable) {
            menu.append(new electron_1.MenuItem({ type: 'separator' }));
            menu.append(new electron_1.MenuItem({
                label: 'Insert Emoji',
                click: () => newWindow.webContents.send('context-menu-command', 'insert-emoji', { x: params.x, y: params.y })
            }));
            menu.append(new electron_1.MenuItem({
                label: 'Change Case',
                click: () => newWindow.webContents.send('context-menu-command', 'change-case')
            }));
        }
        menu.popup();
    });
    newWindow.on('closed', () => {
        const index = windows.indexOf(newWindow);
        if (index !== -1) {
            windows.splice(index, 1);
        }
        if (newWindow === mainWindow) {
            mainWindow = windows.length > 0 ? windows[0] : null;
        }
        if (windows.length === 0) {
            ptySessions.forEach(p => p.kill());
            ptySessions.clear();
            if (process.platform !== 'darwin') {
                electron_1.app.quit();
            }
        }
    });
    newWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('[Electron] Page load failed:', errorCode, errorDescription, validatedURL);
        if (newWindow) {
            const errorHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>CandyCode - Loading Error</title>
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
              <h1>Unable to Load CandyCode</h1>
              <p>Error: <code>\${errorDescription}</code></p>
              <p>Code: <code>\${errorCode}</code></p>
              <p>URL: <code>\${validatedURL}</code></p>
              <p style="margin-top: 20px;">Please check that the Vite dev server is running on port 5173.</p>
            </div>
          </body>
        </html>
      `;
            newWindow.loadURL(`data:text/html;charset=utf-8,\${encodeURIComponent(errorHTML)}`).catch(() => { });
            newWindow.show();
        }
    });
    newWindow.webContents.on('did-start-loading', () => {
        console.log('[Electron] Page started loading');
    });
    newWindow.webContents.on('did-finish-load', async () => {
        console.log('[Electron] Page finished loading');
        newWindow.show();
        newWindow.focus();
        // Note: We no longer send project:load-path here
        // The Sidebar component will request the last project on mount via project:get-current
        // This prevents race conditions and timing issues
        const lastProjectPath = await loadLastOpenedProject();
        if (lastProjectPath) {
            console.log('[Electron] Last project available for restore:', lastProjectPath);
            setupProjectWatcher(lastProjectPath);
        }
    });
    newWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) {
            electron_1.shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
    newWindow.webContents.on('console-message', (event, level, message) => {
        console.log(`[Renderer \${level}]:`, message);
    });
    newWindow.webContents.on('dom-ready', () => {
        console.log('[Electron] DOM ready');
        newWindow?.webContents.executeJavaScript(`
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
        newWindow.loadURL('http://localhost:5173').catch((err) => {
            console.error('[Electron] Failed to load URL:', err.message);
        });
    }
    else {
        console.log('[Electron] Loading production file');
        newWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch((err) => {
            console.error('[Electron] Failed to load file:', err);
        });
    }
    newWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.shift && input.key === 'F12') {
            if (newWindow.webContents.isDevToolsOpened()) {
                newWindow.webContents.closeDevTools();
            }
            else {
                newWindow.webContents.openDevTools();
            }
            event.preventDefault();
        }
    });
    // Handle Shift+Ctrl+N (New Window) and Ctrl+Q (Close Window)
    newWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown') {
            // Shift+Ctrl+N
            if (input.control && input.shift && input.key.toLowerCase() === 'n') {
                createWindow();
                event.preventDefault();
            }
            // Ctrl+Q (Close current window instead of quitting app)
            else if (input.control && input.key.toLowerCase() === 'q') {
                newWindow.close();
                event.preventDefault();
            }
        }
    });
    if (newWindow) {
        aiBackendService.setMainWindow(newWindow);
        system_tray_service_1.systemTrayService.setMainWindow(newWindow);
    }
}
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Window',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => createWindow()
                },
                { type: 'separator' },
                {
                    label: 'Close Window',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        const win = electron_1.BrowserWindow.getFocusedWindow();
                        if (win)
                            win.close();
                    }
                },
                {
                    label: 'Quit CandyCode',
                    accelerator: 'CmdOrCtrl+Shift+Q',
                    click: () => electron_1.app.quit()
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' },
                { type: 'separator' },
                { role: 'window' }
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        await electron_1.shell.openExternal('https://github.com/Tinker/AgenticApp');
                    }
                }
            ]
        }
    ];
    if (process.platform === 'darwin') {
        template.unshift({
            label: electron_1.app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                {
                    label: 'Quit CandyCode',
                    accelerator: 'Command+Shift+Q',
                    click: () => electron_1.app.quit()
                }
            ]
        });
    }
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
}
electron_1.ipcMain.handle('ai-backend:chat', async (event, prompt, options) => {
    try {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender) || mainWindow;
        const onChunk = (chunk) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('ai-backend:chunk', chunk);
            }
        };
        const originalMainWindow = aiBackendService['mainWindow'];
        aiBackendService['mainWindow'] = win;
        await aiBackendService.chatStream(prompt, options, onChunk);
        aiBackendService['mainWindow'] = originalMainWindow;
    }
    catch (error) {
        console.error('[AIBackend] Chat error:', error);
        const win = electron_1.BrowserWindow.fromWebContents(event.sender) || mainWindow;
        if (win && !win.isDestroyed()) {
            win.webContents.send('ai-backend:chunk', {
                type: 'error',
                data: error.message || String(error),
            });
            win.webContents.send('ai-backend:chunk', { type: 'done' });
        }
        throw error;
    }
});
electron_1.ipcMain.handle('ai-backend:cancel', (event) => {
    const win = electron_1.BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const originalMainWindow = aiBackendService['mainWindow'];
    aiBackendService['mainWindow'] = win;
    aiBackendService.cancel();
    aiBackendService['mainWindow'] = originalMainWindow;
    if (win && !win.isDestroyed()) {
        win.webContents.send('ai-backend:chunk', { type: 'done' });
    }
});
electron_1.ipcMain.handle('ai-backend:list-models', async (event) => {
    const win = electron_1.BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const originalMainWindow = aiBackendService['mainWindow'];
    aiBackendService['mainWindow'] = win;
    const result = await aiBackendService.listModels();
    aiBackendService['mainWindow'] = originalMainWindow;
    return result;
});
electron_1.ipcMain.handle('pty:create', (_, { id, cols, rows, cwd, shell }) => {
    createPty(id, cols, rows, cwd, shell);
});
electron_1.ipcMain.handle('pty:resize', (_, { id, cols, rows }) => {
    const pty = ptySessions.get(id);
    if (pty) {
        pty.resize(cols, rows);
    }
});
electron_1.ipcMain.handle('pty:write', (_, { id, data }) => {
    const pty = ptySessions.get(id);
    if (pty) {
        pty.write(data);
    }
});
electron_1.ipcMain.handle('pty:kill', (_, { id }) => {
    const pty = ptySessions.get(id);
    if (pty) {
        pty.kill();
        ptySessions.delete(id);
    }
});
electron_1.ipcMain.handle('ollama:check-server', async (event) => {
    return await aiBackendService.getOllamaService().checkServerStatus();
});
electron_1.ipcMain.handle('ollama:list-models', async (event) => {
    return await aiBackendService.getOllamaService().listModels();
});
electron_1.ipcMain.handle('ollama:pull-model', async (event, modelName) => {
    const win = electron_1.BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const ollamaService = aiBackendService.getOllamaService();
    let lastProgress = '';
    return new Promise((resolve) => {
        ollamaService.pullModel(modelName, (progress) => {
            lastProgress = progress;
            if (win && !win.isDestroyed()) {
                win.webContents.send('ollama:pull-progress', { modelName, progress });
            }
        }).then((result) => {
            resolve({ ...result, lastProgress });
        });
    });
});
electron_1.ipcMain.handle('ollama:delete-model', async (event, modelName) => {
    return await aiBackendService.getOllamaService().deleteModel(modelName);
});
electron_1.ipcMain.handle('ollama:search-models', async (event, query) => {
    return await aiBackendService.getOllamaService().searchModels(query);
});
electron_1.ipcMain.handle('ollama:run-model', async (event, modelName) => {
    console.log('[Main] Running Ollama model:', modelName);
    const result = await aiBackendService.getOllamaService().runModel(modelName);
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
electron_1.ipcMain.handle('web:search', async (_, query, maxResults = 5) => {
    const { webSearchService } = await Promise.resolve().then(() => __importStar(require('./services/web-search.service')));
    return await webSearchService.search(query, maxResults);
});
electron_1.ipcMain.handle('model:search', async (_, query) => {
    const { modelSearchService } = await Promise.resolve().then(() => __importStar(require('./services/model-search.service')));
    return await modelSearchService.searchModels(query);
});
// ESLint IPC Handlers
electron_1.ipcMain.handle('eslint:lint-file', async (_, filePath, content) => {
    const { eslintService } = await Promise.resolve().then(() => __importStar(require('./services/eslint.service')));
    return await eslintService.lintFile(filePath, content);
});
electron_1.ipcMain.handle('eslint:lint-files', async (_, files) => {
    const { eslintService } = await Promise.resolve().then(() => __importStar(require('./services/eslint.service')));
    return await eslintService.lintFiles(files);
});
electron_1.ipcMain.handle('eslint:set-enabled', async (_, enabled) => {
    const { eslintService } = await Promise.resolve().then(() => __importStar(require('./services/eslint.service')));
    eslintService.setEnabled(enabled);
    return { success: true };
});
electron_1.ipcMain.handle('eslint:is-enabled', async () => {
    const { eslintService } = await Promise.resolve().then(() => __importStar(require('./services/eslint.service')));
    return eslintService.isEnabled();
});
electron_1.ipcMain.handle('eslint:reload-config', async () => {
    const { eslintService } = await Promise.resolve().then(() => __importStar(require('./services/eslint.service')));
    await eslintService.reloadConfig();
    return { success: true };
});
function setupProjectWatcher(projectPath) {
    if (projectWatcher) {
        projectWatcher.close();
        projectWatcher = null;
    }
    currentProjectPath = projectPath;
    projectFilesCache = [];
    if (!projectPath)
        return;
    try {
        let resolvedPath = projectPath.startsWith('~') ? projectPath.replace(/^~/, os.homedir()) : projectPath;
        scanProjectFiles(resolvedPath);
        projectWatcher = (0, fs_2.watch)(resolvedPath, { recursive: true }, (eventType, filename) => {
            if (!filename)
                return;
            const filePath = path.join(resolvedPath, filename);
            const relativePath = path.relative(resolvedPath, filePath).split(path.sep).join('/');
            const eventKey = `\${eventType}:\${relativePath}`;
            const existingTimer = fileWatcherDebounceMap.get(eventKey);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            const timer = setTimeout(() => {
                if (processedEvents.has(eventKey)) {
                    processedEvents.delete(eventKey);
                    return;
                }
                processedEvents.add(eventKey);
                if (eventType === 'rename') {
                    const isRenameOperation = processedEvents.has(`rename:\${relativePath}`);
                    if (isRenameOperation) {
                        fileWatcherDebounceMap.delete(eventKey);
                        return;
                    }
                    fs.access(filePath).then(() => {
                        if (!projectFilesCache.includes(relativePath)) {
                            projectFilesCache.push(relativePath);
                        }
                        windows.forEach(win => {
                            if (!win.isDestroyed()) {
                                win.webContents.send('file-system:created', {
                                    path: projectPath.startsWith('~') ? `~/\${relativePath}` : relativePath,
                                    resolvedPath: filePath
                                });
                            }
                        });
                        setTimeout(() => processedEvents.delete(eventKey), 1000);
                    }).catch(() => {
                        const idx = projectFilesCache.indexOf(relativePath);
                        if (idx !== -1) {
                            projectFilesCache.splice(idx, 1);
                        }
                        windows.forEach(win => {
                            if (!win.isDestroyed()) {
                                win.webContents.send('file-system:deleted', {
                                    path: projectPath.startsWith('~') ? `~/\${relativePath}` : relativePath,
                                    resolvedPath: filePath
                                });
                            }
                        });
                        setTimeout(() => processedEvents.delete(eventKey), 1000);
                    });
                }
                else if (eventType === 'change') {
                    windows.forEach(win => {
                        if (!win.isDestroyed()) {
                            win.webContents.send('file-system:modified', {
                                path: projectPath.startsWith('~') ? `~/\${relativePath}` : relativePath,
                                resolvedPath: filePath
                            });
                        }
                    });
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
electron_1.ipcMain.handle('project:set-current', async (event, projectPath) => {
    console.log('[Project] project:set-current called with:', projectPath);
    console.log('[Project] currentProjectPath is:', currentProjectPath);
    // Avoid duplicate saves
    if (currentProjectPath === projectPath) {
        console.log('[Project] Project already set to:', projectPath);
        return;
    }
    currentProjectPath = projectPath;
    console.log('[Project] Saving last opened project:', projectPath);
    await saveLastOpenedProject(projectPath);
    console.log('[Project] Setting up project watcher');
    setupProjectWatcher(projectPath);
    // Notify the renderer that the project has been loaded
    const win = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed() && projectPath) {
        console.log('[Project] Sending project:load-path to renderer:', projectPath);
        win.webContents.send('project:load-path', projectPath);
    }
    else {
        console.log('[Project] Not sending event - win:', !!win, 'projectPath:', projectPath);
    }
});
electron_1.ipcMain.handle('project:get-current', async () => {
    console.log('[Project] project:get-current called');
    const result = await loadLastOpenedProject();
    console.log('[Project] project:get-current returning:', result);
    return result;
});
// Handle app-ready signal from renderer (signals that UI is fully loaded)
electron_1.ipcMain.handle('app:ready', (event) => {
    console.log('[App] Renderer signaled ready');
    // Open any files that were requested on launch
    if (filesToOpenWhenReady.length > 0) {
        console.log('[App] Opening files from launch:', filesToOpenWhenReady);
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            openFilesInWindow(win, filesToOpenWhenReady);
        }
        filesToOpenWhenReady = [];
    }
    return { success: true };
});
// Handle new window creation (same as Shift+Ctrl+N)
electron_1.ipcMain.handle('app:new-window', () => {
    console.log('[App] Creating new window');
    createWindow();
    return { success: true };
});
// Handle close confirmation from renderer (for exit with unsaved changes check)
electron_1.ipcMain.handle('app:confirm-close-response', (event, response) => {
    console.log('[App] Close confirmation response:', response.action);
    if (response.action === 'close') {
        // User confirmed close without saving - quit ALL windows (tray exit)
        console.log('[App] Quitting all windows (tray exit)');
        shouldQuit = true;
        // Close all windows
        const allWindows = electron_1.BrowserWindow.getAllWindows();
        allWindows.forEach(win => win.destroy());
        // Force exit after brief delay
        setTimeout(() => {
            console.log('[App] Forcing exit');
            electron_1.app.quit();
        }, 100);
    }
    else if (response.action === 'cancel') {
        // User cancelled - do nothing, app stays open
        shouldQuit = false;
    }
    else if (response.action === 'save') {
        // User wants to save - don't quit, let them save manually
        shouldQuit = false;
    }
    return { success: true };
});
// Handle close current window (for header exit and Ctrl+Q)
electron_1.ipcMain.handle('app:close-current-window', (event) => {
    console.log('[App] Closing current window');
    const win = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
        win.close();
        console.log('[App] Window closed');
    }
    return { success: true };
});
// Get system theme (for GTK/Qt on Linux, native on Mac/Windows)
electron_1.ipcMain.handle('system:get-theme', () => {
    const isDark = electron_1.nativeTheme.shouldUseDarkColors;
    console.log('[System] Theme:', isDark ? 'dark' : 'light');
    return { isDark };
});
// Listen for system theme changes and notify renderer
electron_1.ipcMain.handle('system:on-theme-change', (event) => {
    const onChange = () => {
        const isDark = electron_1.nativeTheme.shouldUseDarkColors;
        console.log('[System] Theme changed to:', isDark ? 'dark' : 'light');
        event.sender.send('system:theme-changed', { isDark });
    };
    electron_1.nativeTheme.on('updated', onChange);
    // Return cleanup function info
    return { success: true };
});
electron_1.ipcMain.handle('copy-file', async (_, sourcePath, destPath) => {
    try {
        let resolvedSource = sourcePath.startsWith('~') ? sourcePath.replace(/^~/, os.homedir()) : sourcePath;
        let resolvedDest = destPath.startsWith('~') ? destPath.replace(/^~/, os.homedir()) : destPath;
        const stats = await fs.stat(resolvedSource);
        if (stats.isDirectory()) {
            await copyDirectory(resolvedSource, resolvedDest);
        }
        else {
            await fs.copyFile(resolvedSource, resolvedDest);
        }
        return { success: true };
    }
    catch (error) {
        console.error('[Electron] Failed to copy file:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('move-file', async (_, sourcePath, destPath) => {
    try {
        let resolvedSource = sourcePath.startsWith('~') ? sourcePath.replace(/^~/, os.homedir()) : sourcePath;
        let resolvedDest = destPath.startsWith('~') ? destPath.replace(/^~/, os.homedir()) : destPath;
        await fs.rename(resolvedSource, resolvedDest);
        return { success: true };
    }
    catch (error) {
        console.error('[Electron] Failed to move file:', error);
        return { success: false, error: error.message };
    }
});
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
electron_1.ipcMain.handle('rename-file', async (_, oldPath, newName) => {
    try {
        let resolvedOldPath = oldPath.startsWith('~') ? oldPath.replace(/^~/, os.homedir()) : oldPath;
        if (!newName || newName.trim() === '') {
            return { success: false, error: 'New name cannot be empty' };
        }
        const invalidChars = process.platform === 'win32' ? /[<>:"/\\\\|?*]/ : /[/]/;
        if (invalidChars.test(newName)) {
            return { success: false, error: 'New name contains invalid characters' };
        }
        const dir = path.dirname(resolvedOldPath);
        const newPath = path.join(dir, newName.trim());
        try {
            await fs.access(newPath);
            return { success: false, error: 'A file or folder with that name already exists' };
        }
        catch { }
        await fs.rename(resolvedOldPath, newPath);
        const relativeOldPath = currentProjectPath ? path.relative(currentProjectPath.replace(/^~/, os.homedir()), resolvedOldPath) : '';
        const relativeNewPath = currentProjectPath ? path.relative(currentProjectPath.replace(/^~/, os.homedir()), newPath) : '';
        if (relativeOldPath && relativeNewPath && currentProjectPath) {
            const idx = projectFilesCache.indexOf(relativeOldPath.split(path.sep).join('/'));
            if (idx !== -1) {
                projectFilesCache[idx] = relativeNewPath.split(path.sep).join('/');
            }
            else {
                projectFilesCache.push(relativeNewPath.split(path.sep).join('/'));
            }
            processedEvents.add(`rename:\${relativeOldPath}`);
            processedEvents.add(`rename:\${relativeNewPath}`);
            setTimeout(() => {
                processedEvents.delete(`rename:\${relativeOldPath}`);
                processedEvents.delete(`rename:\${relativeNewPath}`);
            }, 2000);
        }
        windows.forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('file-system:renamed', {
                    oldPath: oldPath,
                    newPath: path.join(path.dirname(oldPath), newName.trim()),
                    oldResolvedPath: resolvedOldPath,
                    newResolvedPath: newPath
                });
            }
        });
        return { success: true, newPath };
    }
    catch (error) {
        console.error('[Electron] Failed to rename file:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('find-files', async (_, rootPath, query) => {
    try {
        if (!rootPath || !query)
            return [];
        let resolvedRoot = rootPath;
        if (rootPath === '~' || rootPath.startsWith('~/')) {
            resolvedRoot = rootPath.replace(/^~/, os.homedir());
        }
        if (projectFilesCache.length === 0) {
            await scanProjectFiles(currentProjectPath || rootPath);
        }
        else if (scanPromise) {
            await scanPromise;
        }
        const q = query.toLowerCase();
        const matches = projectFilesCache
            .filter(file => {
            const name = path.basename(file).toLowerCase();
            const fullPath = file.toLowerCase();
            if (name.includes(q))
                return true;
            if (q.length > 2) {
                let searchIdx = 0, fileIdx = 0;
                while (searchIdx < q.length && fileIdx < fullPath.length) {
                    if (q[searchIdx] === fullPath[fileIdx])
                        searchIdx++;
                    fileIdx++;
                }
                return searchIdx === q.length;
            }
            return false;
        })
            .slice(0, 100)
            .map(file => ({
            name: path.basename(file),
            path: path.join(rootPath, file).replace(/\\\\/g, '/'),
            type: 'file'
        }));
        return matches;
    }
    catch (error) {
        console.error('[Electron] Find files error:', error);
        return [];
    }
});
electron_1.app.whenReady().then(() => {
    createMenu();
    createWindow();
    system_tray_service_1.systemTrayService.createTray();
    // Existing hotkeys for new window
    electron_1.globalShortcut.register('Shift+Ctrl+N', () => {
        createWindow();
    });
    if (process.platform === 'darwin') {
        electron_1.globalShortcut.register('Cmd+Shift+N', () => {
            createWindow();
        });
    }
    // CandyCode launch/focus hotkey: Super/Command + Alt + C
    const candycodeHotkey = process.platform === 'darwin' ? 'Command+Alt+C' :
        process.platform === 'win32' ? 'Ctrl+Alt+C' :
            'Super+Alt+C';
    const registered = electron_1.globalShortcut.register(candycodeHotkey, () => {
        console.log(`[Hotkey] CandyCode hotkey triggered: ${candycodeHotkey}`);
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            if (!mainWindow.isVisible()) {
                mainWindow.show();
            }
            mainWindow.focus();
            mainWindow.flashFrame(true);
        }
        else {
            createWindow();
        }
    });
    if (registered) {
        console.log(`[Hotkey] Global shortcut registered: ${candycodeHotkey}`);
    }
    else {
        console.error('[Hotkey] Global shortcut registration failed - may be reserved by OS');
    }
    ensureOllamaRunning();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// =============================================================================
// Cross-Platform "Open With" File Handling
// Supports: Linux (command line), macOS (open-file), Windows (second-instance)
// =============================================================================
/**
 * Open files in the active or most recently focused window
 * @param filePaths - Array of file paths to open
 */
function openFilesInApp(filePaths) {
    if (!filePaths || filePaths.length === 0)
        return;
    console.log('[OpenWith] Opening files:', filePaths);
    // Get the main window or create one if needed
    let targetWindow = mainWindow;
    if (!targetWindow) {
        const windows = electron_1.BrowserWindow.getAllWindows();
        targetWindow = windows.length > 0 ? windows[0] : null;
    }
    if (!targetWindow) {
        console.log('[OpenWith] No window available, creating new window');
        createWindow();
        // Wait for window to be ready
        setTimeout(() => {
            if (mainWindow) {
                openFilesInWindow(mainWindow, filePaths);
            }
        }, 500);
        return;
    }
    // Focus and show the window
    if (targetWindow.isMinimized()) {
        targetWindow.restore();
    }
    targetWindow.show();
    targetWindow.focus();
    // Open files in the window
    openFilesInWindow(targetWindow, filePaths);
}
/**
 * Send file paths to renderer to open in new tabs
 * @param win - BrowserWindow to open files in
 * @param filePaths - Array of file paths
 */
function openFilesInWindow(win, filePaths) {
    if (!win || win.isDestroyed())
        return;
    console.log('[OpenWith] Sending files to window:', filePaths.length);
    // Wait a bit for window to be fully ready
    setTimeout(() => {
        if (!win.isDestroyed()) {
            win.webContents.send('app:open-files', filePaths);
            console.log('[OpenWith] Files sent to renderer');
        }
    }, 200);
}
// Store files to open when app is fully ready
let filesToOpenWhenReady = [];
let shouldQuit = false; // Flag to track if we should actually quit (for exit with unsaved changes)
// Parse file paths from command line arguments
function parseFileArgs(args) {
    return args.filter(arg => {
        // Skip Electron/Chromium flags
        if (arg.startsWith('--'))
            return false;
        if (arg.startsWith('-') && arg.length > 1 && !arg.startsWith('-/'))
            return false;
        // Skip AppImage mount paths (/tmp/.mount_*)
        if (arg.includes('/tmp/.mount_') || arg.includes('AppImage')) {
            console.log('[OpenWith] Skipping AppImage path:', arg);
            return false;
        }
        // Skip known non-file arguments
        if (arg.includes('electron') ||
            arg.includes('vite') ||
            arg.includes('node_modules') ||
            arg.includes('app.asar') ||
            arg === '.' || arg === '..' || arg === '/') {
            return false;
        }
        // Accept paths that look like files
        const isAbsolutePath = arg.startsWith('/') || (process.platform === 'win32' && /^[A-Z]:\\/i.test(arg));
        const isRelativePath = arg.startsWith('./') || arg.startsWith('../') || (arg.includes('/') && !arg.startsWith('-'));
        const hasExtension = arg.includes('.') && !arg.startsWith('.');
        return isAbsolutePath || isRelativePath || hasExtension;
    });
}
// Handle files from command line (Linux/Windows fresh launch)
const initialFiles = parseFileArgs(process.argv.slice(1));
if (initialFiles.length > 0) {
    console.log('[OpenWith] Files from command line:', initialFiles);
    filesToOpenWhenReady = initialFiles;
    // Files will be opened when renderer signals it's ready
}
// macOS: Handle "Open With" from Finder
electron_1.app.on('open-file', (event, filePath) => {
    event.preventDefault();
    console.log('[OpenWith] macOS open-file:', filePath);
    openFilesInApp([filePath]);
});
// Linux/Windows: Handle second instance (file manager "Open With" when app is running)
electron_1.app.on('second-instance', (event, commandLine) => {
    console.log('[OpenWith] second-instance command line:', commandLine);
    const filePaths = parseFileArgs(commandLine);
    if (filePaths.length > 0) {
        console.log('[OpenWith] Opening files from second instance:', filePaths);
        openFilesInApp(filePaths);
    }
    // Focus existing window
    if (mainWindow) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
    }
});
process.on('uncaughtException', (error) => {
    console.error('[Electron] Uncaught exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Electron] Unhandled rejection at:', promise, 'reason:', reason);
});
electron_1.app.on('window-all-closed', () => {
    // Prevent app from quitting when windows are closed/hidden (for system tray)
    // This allows the tray icon to remain functional even when window is hidden
    console.log('[SystemTray] Window closed but app continues running for tray');
});
electron_1.app.on('will-quit', () => {
    // Unregister all global shortcuts
    electron_1.globalShortcut.unregisterAll();
    system_tray_service_1.systemTrayService.destroyTray();
    console.log('[Hotkey] All global shortcuts unregistered');
});
electron_1.app.on('before-quit', () => {
    // Do NOT clear the last opened project - we want to restore it on next launch
    // saveLastOpenedProject(null); // REMOVED - this was clearing the saved project
    console.log('[Electron] App quitting, preserving last opened project for next launch');
});
electron_1.ipcMain.handle('read-directory', async (_, dirPath) => {
    try {
        let resolvedPath = dirPath;
        if (dirPath === '~' || dirPath.startsWith('~/')) {
            resolvedPath = dirPath.replace(/^~/, os.homedir());
        }
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
            return { error: `Path is a file, not a directory: \${dirPath}` };
        }
        const items = await fs.readdir(resolvedPath, { withFileTypes: true });
        const itemsWithDetails = await Promise.all(items.map(async (item) => {
            const itemPath = path.join(resolvedPath, item.name);
            let type = 'file', size = 0, isSymlink = item.isSymbolicLink();
            try {
                if (item.isDirectory())
                    type = 'folder';
                else if (item.isSymbolicLink()) {
                    const targetStats = await fs.stat(itemPath);
                    type = targetStats.isDirectory() ? 'folder' : 'file';
                    if (type === 'file')
                        size = targetStats.size;
                }
                else {
                    type = 'file';
                    const stat = await fs.stat(itemPath);
                    size = stat.size;
                }
            }
            catch (e) {
                type = 'file';
            }
            return { name: item.name, path: itemPath, type: type, size, isSymlink };
        }));
        itemsWithDetails.sort((a, b) => {
            if (a.type === b.type)
                return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
            return a.type === 'folder' ? -1 : 1;
        });
        return itemsWithDetails;
    }
    catch (error) {
        return { error: error.message };
    }
});
electron_1.ipcMain.handle('read-file', async (_, filePath) => {
    try {
        const resolvedPath = filePath.startsWith('~') ? filePath.replace('~', os.homedir()) : filePath;
        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory())
            return { error: `Path is a directory, not a file: \${resolvedPath}` };
        const ext = path.extname(resolvedPath).toLowerCase();
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
        if (imageExtensions.includes(ext) && ext !== '.svg') {
            const buffer = await fs.readFile(resolvedPath);
            const base64 = buffer.toString('base64');
            const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/\${ext.slice(1)}`;
            return { content: `data:\${mimeType};base64,\${base64}`, encoding: 'base64' };
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
        let resolvedPath = filePath.startsWith('~/') || filePath === '~' ? filePath.replace(/^~/, os.homedir()) : filePath;
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolvedPath, content, 'utf-8');
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
});
electron_1.ipcMain.handle('approve-diff', async (_, filePath, content) => {
    try {
        let resolvedPath = filePath.startsWith('~/') || filePath === '~' ? filePath.replace(/^~/, os.homedir()) : filePath;
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolvedPath, content, 'utf-8');
        windows.forEach(win => {
            if (!win.isDestroyed())
                win.webContents.send('file-operation:diff-approved', { filePath });
        });
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
});
electron_1.ipcMain.handle('reject-diff', async (_, filePath) => {
    try {
        windows.forEach(win => {
            if (!win.isDestroyed())
                win.webContents.send('file-operation:diff-rejected', { filePath });
        });
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
});
electron_1.ipcMain.handle('ai-backend:check-pending-approvals', async () => {
    return false;
});
electron_1.ipcMain.handle('show-open-dialog', async (event, options) => {
    try {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender) || mainWindow;
        const result = await electron_1.dialog.showOpenDialog(win, options);
        if (!result.canceled && result.filePaths.length > 0 && options.properties?.includes('openDirectory')) {
            await saveLastOpenedProject(result.filePaths[0]);
        }
        return result;
    }
    catch (error) {
        return { canceled: true, error: error.message };
    }
});
electron_1.ipcMain.handle('show-save-dialog', async (event, options) => {
    try {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender) || mainWindow;
        const result = await electron_1.dialog.showSaveDialog(win, options);
        return result;
    }
    catch (error) {
        return { canceled: true, error: error.message };
    }
});
electron_1.ipcMain.handle('execute-command', async (_, command, options = {}) => {
    const { cwd = process.cwd(), timeout = 30000 } = options;
    const lowerCommand = command.toLowerCase().trim();
    const dangerousPatterns = [/rm\s+-rf\s+\//, /rm\s+-rf\s+~/, /format\s+c:/i, /shutdown/i, /reboot/i];
    if (dangerousPatterns.some(pattern => pattern.test(lowerCommand))) {
        return { error: 'Command blocked for security reasons', stdout: '', stderr: '', exitCode: -1 };
    }
    return new Promise((resolve) => {
        const child = (0, child_process_1.spawn)(command, [], { cwd, shell: true, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '', stderr = '', timeoutId = null;
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                child.kill();
                resolve({ error: 'Command timed out', stdout, stderr, exitCode: -1 });
            }, timeout);
        }
        child.stdout.on('data', (data) => stdout += data.toString());
        child.stderr.on('data', (data) => stderr += data.toString());
        child.on('close', (code) => {
            if (timeoutId)
                clearTimeout(timeoutId);
            resolve({ stdout, stderr, exitCode: code || 0, error: code !== 0 ? `Command exited with code \${code}` : undefined });
        });
        child.on('error', (error) => {
            if (timeoutId)
                clearTimeout(timeoutId);
            resolve({ error: error.message, stdout, stderr, exitCode: -1 });
        });
    });
});
electron_1.ipcMain.handle('get-system-info', async () => {
    return { platform: process.platform, arch: process.arch, nodeVersion: process.version, cwd: process.cwd(), homeDir: os.homedir() };
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
electron_1.ipcMain.handle('get-app-asset-path', async (event, assetName) => {
    let assetPath = '';
    if (isDev) {
        // Development mode: try multiple possible locations
        const possiblePaths = [
            path.join(__dirname, '../assets', assetName), // dist-electron/../assets
            path.join(process.cwd(), 'assets', assetName), // Project root
            path.join(electron_1.app.getAppPath(), 'assets', assetName), // App root
        ];
        // Find the first existing path
        for (const p of possiblePaths) {
            if ((0, fs_1.existsSync)(p)) {
                assetPath = p;
                break;
            }
        }
        // Fallback to project root if none exist
        if (!assetPath) {
            assetPath = path.join(process.cwd(), 'assets', assetName);
        }
    }
    else {
        // Production mode: try multiple locations
        // Electron packs files into app.asar, but we need to handle unpacked resources
        const possiblePaths = [
            path.join(process.resourcesPath, 'assets', assetName), // electron-builder resources
            path.join(path.dirname(electron_1.app.getPath('exe')), 'assets', assetName), // Next to executable
            path.join(electron_1.app.getAppPath(), 'assets', assetName), // App root (might be in asar)
            path.join(process.cwd(), 'assets', assetName), // Current working directory
        ];
        // Find the first existing path
        for (const p of possiblePaths) {
            if ((0, fs_1.existsSync)(p)) {
                assetPath = p;
                break;
            }
        }
        // Ultimate fallback: use the public directory from Vite build
        if (!assetPath) {
            const publicPath = path.join(path.dirname(electron_1.app.getPath('exe')), 'dist', assetName);
            if ((0, fs_1.existsSync)(publicPath)) {
                assetPath = publicPath;
            }
            else {
                // Last resort: return a path that will trigger the fallback in the renderer
                assetPath = path.join(process.resourcesPath, 'assets', assetName);
            }
        }
    }
    const fileUrl = `file://${assetPath}`;
    console.log(`[AssetPath] ${assetName}: ${fileUrl} (exists: ${(0, fs_1.existsSync)(assetPath)})`);
    return { path: assetPath, url: fileUrl };
});
// =============================================================================
// Global Hotkey Management
// =============================================================================
const registeredHotkeys = new Map();
electron_1.ipcMain.handle('register-global-hotkey', async (event, hotkey, action) => {
    try {
        // Unregister existing hotkey with same action
        for (const [key, callback] of registeredHotkeys.entries()) {
            if (key.startsWith(`${action}:`)) {
                electron_1.globalShortcut.unregister(key);
                registeredHotkeys.delete(key);
            }
        }
        const success = electron_1.globalShortcut.register(hotkey, () => {
            console.log(`[Hotkey] Triggered: ${hotkey} -> ${action}`);
            // Notify renderer
            mainWindow?.webContents.send('global-hotkey-triggered', { hotkey, action });
        });
        if (success) {
            registeredHotkeys.set(`${action}:${hotkey}`, () => { });
            console.log(`[Hotkey] Registered: ${hotkey} -> ${action}`);
            return { success: true, hotkey };
        }
        else {
            console.error(`[Hotkey] Failed to register: ${hotkey}`);
            return { success: false, error: 'Failed to register hotkey - may be reserved by OS' };
        }
    }
    catch (error) {
        console.error('[Hotkey] Registration error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('unregister-global-hotkey', async (event, hotkey) => {
    try {
        electron_1.globalShortcut.unregister(hotkey);
        // Remove from map
        for (const key of registeredHotkeys.keys()) {
            if (key.includes(hotkey)) {
                registeredHotkeys.delete(key);
                break;
            }
        }
        console.log(`[Hotkey] Unregistered: ${hotkey}`);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('get-registered-hotkeys', async () => {
    return Array.from(registeredHotkeys.keys()).map(key => {
        const [action, hotkey] = key.split(':');
        return { action, hotkey };
    });
});
electron_1.ipcMain.handle('unregister-all-hotkeys', async () => {
    electron_1.globalShortcut.unregisterAll();
    registeredHotkeys.clear();
    console.log('[Hotkey] All hotkeys unregistered');
    return { success: true };
});
electron_1.ipcMain.handle('show-context-menu', async (event, filePath, fileName) => {
    return new Promise((resolve) => {
        const menu = new electron_1.Menu();
        menu.append(new electron_1.MenuItem({ label: 'Open', click: () => { event.sender.send('context-menu-action', 'open-file', { filePath, fileName }); resolve({ action: 'open-file' }); } }));
        menu.append(new electron_1.MenuItem({ label: 'Add to Context', click: () => { event.sender.send('context-menu-action', 'add-to-context', { filePath, fileName }); resolve({ action: 'add-to-context' }); } }));
        menu.append(new electron_1.MenuItem({ type: 'separator' }));
        menu.append(new electron_1.MenuItem({ label: 'Copy to...', click: async () => {
                const win = electron_1.BrowserWindow.fromWebContents(event.sender);
                if (!win)
                    return;
                const result = await electron_1.dialog.showOpenDialog(win, { title: `Copy "\${fileName}" to...`, properties: ['openDirectory'], buttonLabel: 'Copy Here' });
                if (!result.canceled && result.filePaths.length > 0) {
                    const destPath = path.join(result.filePaths[0], fileName);
                    let resolvedSource = filePath.startsWith('~') ? filePath.replace(/^~/, os.homedir()) : filePath;
                    try {
                        const stats = await fs.stat(resolvedSource);
                        if (stats.isDirectory())
                            await copyDirectory(resolvedSource, destPath);
                        else
                            await fs.copyFile(resolvedSource, destPath);
                        event.sender.send('context-menu-action', 'copy-complete', { filePath, fileName, destPath });
                        resolve({ action: 'copy', success: true });
                    }
                    catch (error) {
                        event.sender.send('context-menu-action', 'copy-error', { filePath, fileName, error: error.message });
                        resolve({ action: 'copy', error: error.message });
                    }
                }
            } }));
        menu.append(new electron_1.MenuItem({ label: 'Move to...', click: async () => {
                const win = electron_1.BrowserWindow.fromWebContents(event.sender);
                if (!win)
                    return;
                const result = await electron_1.dialog.showOpenDialog(win, { title: `Move "\${fileName}" to...`, properties: ['openDirectory'], buttonLabel: 'Move Here' });
                if (!result.canceled && result.filePaths.length > 0) {
                    const destPath = path.join(result.filePaths[0], fileName);
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
            } }));
        menu.append(new electron_1.MenuItem({ type: 'separator' }));
        menu.append(new electron_1.MenuItem({ label: 'Delete', click: async () => {
                const win = electron_1.BrowserWindow.fromWebContents(event.sender);
                if (!win)
                    return;
                const result = await electron_1.dialog.showMessageBox(win, { type: 'warning', title: 'Delete Item', message: `Are you sure you want to delete "\${fileName}"?`, detail: 'This will move the item to the trash.', buttons: ['Cancel', 'Delete'], defaultId: 0, cancelId: 0 });
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
            } }));
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win)
            menu.popup({ window: win });
    });
});
//# sourceMappingURL=main.js.map