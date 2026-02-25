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
exports.systemTrayService = exports.SystemTrayService = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class SystemTrayService {
    tray = null;
    mainWindow = null;
    isWindowVisible = true;
    constructor() {
        this.setupIPCListeners();
    }
    setMainWindow(window) {
        this.mainWindow = window;
        if (window) {
            this.setupWindowListeners();
        }
    }
    setupWindowListeners() {
        if (!this.mainWindow)
            return;
        this.mainWindow.on('show', () => {
            this.isWindowVisible = true;
            this.updateTrayMenu();
        });
        this.mainWindow.on('hide', () => {
            this.isWindowVisible = false;
            this.updateTrayMenu();
        });
        this.mainWindow.on('restore', () => {
            this.isWindowVisible = true;
            this.updateTrayMenu();
        });
    }
    setupIPCListeners() {
        // Handle requests from renderer to hide to tray
        electron_1.ipcMain.handle('tray:hide-to-tray', () => {
            this.hideAllToTray();
        });
        // Handle requests from renderer to show window
        electron_1.ipcMain.handle('tray:show-window', () => {
            this.showAllWindows();
        });
        // Handle requests from renderer to exit app
        electron_1.ipcMain.handle('tray:exit-app', () => {
            this.exitApp();
        });
    }
    createTray() {
        try {
            const iconPath = this.getTrayIconPath();
            if (!iconPath || !fs.existsSync(iconPath)) {
                console.warn('[SystemTray] Icon not found at:', iconPath);
                return;
            }
            let trayIcon;
            if (process.platform === 'darwin') {
                // macOS requires template images for tray icons
                const icon = electron_1.nativeImage.createFromPath(iconPath);
                // Resize to appropriate size for macOS tray
                const resized = icon.resize({ width: 18, height: 18 });
                resized.setTemplateImage(true);
                trayIcon = resized;
            }
            else if (process.platform === 'win32') {
                // Windows uses ICO or resized PNG
                const icon = electron_1.nativeImage.createFromPath(iconPath);
                // Resize to appropriate size for Windows tray
                trayIcon = icon.resize({ width: 32, height: 32 });
            }
            else {
                // Linux uses PNG directly
                trayIcon = electron_1.nativeImage.createFromPath(iconPath);
            }
            this.tray = new electron_1.Tray(trayIcon);
            const contextMenu = this.createContextMenu();
            this.tray.setContextMenu(contextMenu);
            // Set tooltip
            this.tray.setToolTip('CandyCode');
            // Handle tray icon click
            this.tray.on('click', () => {
                this.toggleWindow();
            });
            // Handle double-click on Windows/Linux
            this.tray.on('double-click', () => {
                this.showAllWindows();
            });
            console.log('[SystemTray] Tray created successfully');
        }
        catch (error) {
            console.error('[SystemTray] Failed to create tray:', error);
        }
    }
    getTrayIconPath() {
        const platform = process.platform;
        const resourcesPath = electron_1.app.isPackaged
            ? path.join(process.resourcesPath, 'assets')
            : path.join(__dirname, '../../assets');
        // Check for platform-specific icon formats
        const iconPaths = {
            darwin: [
                path.join(resourcesPath, 'iconTemplate.png'),
                path.join(resourcesPath, 'icon.icns'),
                path.join(resourcesPath, 'icon.png'),
            ],
            win32: [
                path.join(resourcesPath, 'icon.ico'),
                path.join(resourcesPath, 'icon.png'),
            ],
            linux: [
                path.join(resourcesPath, 'icon.png'),
            ],
        };
        const paths = iconPaths[platform] || iconPaths.linux;
        for (const iconPath of paths) {
            if (fs.existsSync(iconPath)) {
                return iconPath;
            }
        }
        // Fallback to assets directory in development
        const devAssetPath = path.join(__dirname, '../../assets/icon.png');
        if (fs.existsSync(devAssetPath)) {
            return devAssetPath;
        }
        return null;
    }
    createContextMenu() {
        const template = [
            {
                label: this.isWindowVisible ? 'Hide' : 'Show',
                click: () => {
                    if (this.isWindowVisible) {
                        this.hideAllToTray();
                    }
                    else {
                        this.showAllWindows();
                    }
                },
            },
            { type: 'separator' },
            {
                label: 'Exit',
                click: () => {
                    this.exitApp();
                },
            },
        ];
        return electron_1.Menu.buildFromTemplate(template);
    }
    updateTrayMenu() {
        if (!this.tray)
            return;
        const contextMenu = this.createContextMenu();
        this.tray.setContextMenu(contextMenu);
    }
    hideAllToTray() {
        // Hide ALL windows, not just the main window
        const allWindows = electron_1.BrowserWindow.getAllWindows();
        allWindows.forEach(win => {
            if (!win.isDestroyed()) {
                win.hide();
            }
        });
        this.isWindowVisible = false;
        this.updateTrayMenu();
        console.log('[SystemTray] All windows hidden to tray');
    }
    showAllWindows() {
        // Show ALL windows, not just the main window
        const allWindows = electron_1.BrowserWindow.getAllWindows();
        allWindows.forEach((win, index) => {
            if (!win.isDestroyed()) {
                win.show();
                win.focus();
                win.restore();
            }
        });
        this.isWindowVisible = true;
        this.updateTrayMenu();
        console.log('[SystemTray] All windows shown from tray');
    }
    toggleWindow() {
        if (this.isWindowVisible) {
            this.hideAllToTray();
        }
        else {
            this.showAllWindows();
        }
    }
    exitApp() {
        // Save state before exiting
        if (this.mainWindow) {
            this.mainWindow.webContents.send('app:before-exit');
        }
        // Give renderer time to save state
        setTimeout(() => {
            electron_1.app.quit();
        }, 100);
    }
    destroyTray() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}
exports.SystemTrayService = SystemTrayService;
exports.systemTrayService = new SystemTrayService();
//# sourceMappingURL=system-tray.service.js.map