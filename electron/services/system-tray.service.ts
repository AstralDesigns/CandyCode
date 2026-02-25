import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class SystemTrayService {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private isWindowVisible = true;

  constructor() {
    this.setupIPCListeners();
  }

  setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window;
    if (window) {
      this.setupWindowListeners();
    }
  }

  private setupWindowListeners() {
    if (!this.mainWindow) return;

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

  private setupIPCListeners() {
    // Handle requests from renderer to hide to tray
    ipcMain.handle('tray:hide-to-tray', () => {
      this.hideAllToTray();
    });

    // Handle requests from renderer to show window
    ipcMain.handle('tray:show-window', () => {
      this.showAllWindows();
    });

    // Handle requests from renderer to exit app
    ipcMain.handle('tray:exit-app', () => {
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

      let trayIcon: Electron.NativeImage;

      if (process.platform === 'darwin') {
        // macOS requires template images for tray icons
        const icon = nativeImage.createFromPath(iconPath);
        // Resize to appropriate size for macOS tray
        const resized = icon.resize({ width: 18, height: 18 });
        resized.setTemplateImage(true);
        trayIcon = resized;
      } else if (process.platform === 'win32') {
        // Windows uses ICO or resized PNG
        const icon = nativeImage.createFromPath(iconPath);
        // Resize to appropriate size for Windows tray
        trayIcon = icon.resize({ width: 32, height: 32 });
      } else {
        // Linux uses PNG directly
        trayIcon = nativeImage.createFromPath(iconPath);
      }

      this.tray = new Tray(trayIcon);

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
    } catch (error) {
      console.error('[SystemTray] Failed to create tray:', error);
    }
  }

  private getTrayIconPath(): string | null {
    const platform = process.platform;
    const resourcesPath = app.isPackaged
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

    const paths = iconPaths[platform as keyof typeof iconPaths] || iconPaths.linux;

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

  private createContextMenu(): Menu {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: this.isWindowVisible ? 'Hide' : 'Show',
        click: () => {
          if (this.isWindowVisible) {
            this.hideAllToTray();
          } else {
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

    return Menu.buildFromTemplate(template);
  }

  private updateTrayMenu() {
    if (!this.tray) return;

    const contextMenu = this.createContextMenu();
    this.tray.setContextMenu(contextMenu);
  }

  hideAllToTray() {
    // Hide ALL windows, not just the main window
    const allWindows = BrowserWindow.getAllWindows();
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
    const allWindows = BrowserWindow.getAllWindows();
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
    } else {
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
      app.quit();
    }, 100);
  }

  destroyTray() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

export const systemTrayService = new SystemTrayService();
