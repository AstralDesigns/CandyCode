# System Tray Integration

CandyCode now includes **cross-platform system tray functionality** with a dropdown menu for easy window management.

## Features

- **System Tray Icon**: Uses your app's `icon.png` from the `assets/` folder
- **Dropdown Menu Options**:
  - **Show/Hide**: Toggle window visibility (window stays running when hidden)
  - **Exit**: Quit the application completely
- **Cross-Platform Support**: Works on Linux, macOS, and Windows
- **Click Actions**:
  - Single-click: Toggle window show/hide
  - Double-click: Show window

## Important Behavior

- **Hide**: Only hides the window - the app continues running in the background
- **Show**: Restores the hidden window
- **Exit**: Completely quits the application and removes the tray icon

## Icon Setup

The installation and update scripts automatically set up tray icons:

### During Installation
```bash
npm run install-app
```

### During Updates
```bash
npm run update-app
```

The scripts will:
1. Create platform-specific icon formats in `assets/tray/`
2. Use ImageMagick (if available) to resize icons to appropriate tray sizes
3. Fall back to the original icon if ImageMagick is not available

## Platform-Specific Details

### Linux
- Creates PNG icons in sizes: 16x16, 22x22, 24x24, 32x32, 48x48
- Icons stored in: `assets/tray/`
- System tray support depends on your desktop environment

### macOS
- Creates template icons (18x18, 22x22) for Retina displays
- Converts to grayscale for menu bar compatibility
- Icons stored in: `assets/tray/`
- Follows macOS Human Interface Guidelines

### Windows
- Creates ICO file with multiple sizes (16, 24, 32, 48)
- Icons stored in: `assets/tray/icon.ico`
- Full system tray integration

## IPC Communication

The system tray service provides IPC handlers for renderer process communication:

```javascript
// Hide to tray
await window.electronAPI.trayHideToTray();

// Show window
await window.electronAPI.trayShowWindow();

// Exit app
await window.electronAPI.trayExitApp();
```

## Files Modified/Created

### Created
- `electron/services/system-tray.service.ts` - Core tray functionality

### Modified
- `electron/main.ts` - Integrated system tray service
- `scripts/install-app.js` - Added tray icon setup
- `scripts/update-app.js` - Added tray icon setup
- `package.json` - Updated to include tray icons in build

## Requirements

### Optional: ImageMagick
For optimal icon resizing, install ImageMagick:

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install imagemagick

# Fedora/RHEL
sudo dnf install ImageMagick

# Arch/CachyOS
sudo pacman -S imagemagick
```

**macOS:**
```bash
brew install imagemagick
```

**Windows:**
```bash
# Using Chocolatey
choco install imagemagick

# Using Scoop
scoop install imagemagick
```

## Troubleshooting

### Tray icon not showing
1. Ensure `assets/icon.png` exists
2. Run `npm run install-app` to set up tray icons
3. Check that your desktop environment supports system trays (Linux)

### Icon appears pixelated
- Install ImageMagick for proper icon resizing
- Re-run the installation script

### Menu options not working
- Restart the application after installation/update
- Check console logs for errors

## Technical Implementation

The system tray is implemented using Electron's `Tray` API with:
- Platform-specific icon handling
- Context menu with dynamic labels (Show/Hide toggles)
- Window state tracking
- IPC communication for renderer integration
- Graceful fallbacks when icons are unavailable
