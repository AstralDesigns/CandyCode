#!/usr/bin/env node

/**
 * CandyCode Global Hotkey Setup Script
 * Configures system-wide keyboard shortcuts for launching CandyCode
 * Supports: Linux (GNOME, KDE, XFCE), macOS, Windows
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// =============================================================================
// Dynamic Installation Directory Detection (same as install-app.js)
// =============================================================================

function getInstallationDirectory() {
  const strategies = [
    () => {
      const scriptDir = path.resolve(__dirname, '..');
      if (isValidCandyCodeRoot(scriptDir)) return scriptDir;
      return null;
    },
    () => {
      if (process.platform === 'linux') {
        const xdgDataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
        const xdgLocations = [
          path.join(xdgDataHome, 'candycode'),
          path.join(xdgDataHome, 'CandyCode'),
        ];
        for (const loc of xdgLocations) {
          if (isValidCandyCodeRoot(loc)) return loc;
        }
      }
      return null;
    },
    () => {
      const home = os.homedir();
      const standardLocations = [
        path.join(home, '.local', 'opt', 'CandyCode'),
        path.join(home, '.opt', 'CandyCode'),
        path.join('/opt', 'CandyCode'),
        path.join(home, 'Applications', 'CandyCode'),
        path.join('/Applications', 'CandyCode.app', 'Contents', 'Resources', 'app'),
        path.join(process.env.LOCALAPPDATA || home, 'Programs', 'CandyCode'),
        path.join(home, 'AgenticApp'),
        path.join(home, 'CandyCode'),
      ];
      for (const loc of standardLocations) {
        if (isValidCandyCodeRoot(loc)) return loc;
      }
      return null;
    },
    () => {
      const envVars = ['CANDYCODE_HOME', 'CANDYCODE_ROOT', 'CANDYCODE_DIR'];
      for (const envVar of envVars) {
        const envPath = process.env[envVar];
        if (envPath && isValidCandyCodeRoot(envPath)) return envPath;
      }
      return null;
    },
  ];
  
  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result) return result;
    } catch (error) {}
  }
  
  return null;
}

function isValidCandyCodeRoot(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return false;
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) return false;
    const packageJsonPath = path.join(dirPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return false;
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.name === 'candycode' || 
           packageJson.productName === 'CandyCode';
  } catch (error) {
    return false;
  }
}

// =============================================================================
// Configuration
// =============================================================================

const INSTALL_DIR = getInstallationDirectory();
const PLATFORM = process.platform;

if (!INSTALL_DIR) {
  console.error('ERROR: Could not determine CandyCode installation directory.');
  process.exit(1);
}

console.log(`[HotkeySetup] Using installation directory: ${INSTALL_DIR}`);

// Default hotkey: Super/Command + Alt + C
const DEFAULT_HOTKEY = {
  linux: '<Super><Alt>C',
  darwin: '<Command><Alt>C',
  win32: '<Ctrl><Alt>C',
};

// =============================================================================
// Utility Functions
// =============================================================================

function runCommand(command, options = {}) {
  try {
    const result = execSync(command, { encoding: 'utf8', ...options });
    return { success: true, output: result };
  } catch (error) {
    if (options.ignoreError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function detectDesktopEnvironment() {
  if (PLATFORM !== 'linux') return null;
  
  const deVars = [
    'GNOME_DESKTOP_SESSION_ID',
    'KDE_FULL_SESSION',
    'XDG_CURRENT_DESKTOP',
    'DESKTOP_SESSION',
  ];
  
  for (const envVar of deVars) {
    const value = process.env[envVar]?.toLowerCase() || '';
    if (value.includes('gnome')) return 'gnome';
    if (value.includes('kde')) return 'kde';
    if (value.includes('xfce')) return 'xfce';
    if (value.includes('mate')) return 'mate';
    if (value.includes('lxqt')) return 'lxqt';
    if (value.includes('cinnamon')) return 'cinnamon';
  }
  
  // Try to detect via running processes
  try {
    const output = execSync('ps aux', { encoding: 'utf8' });
    if (output.includes('gnome-shell')) return 'gnome';
    if (output.includes('kwin')) return 'kde';
    if (output.includes('xfce4-panel')) return 'xfce';
  } catch {}
  
  return 'unknown';
}

// =============================================================================
// Linux Hotkey Setup
// =============================================================================

function setupLinuxHotkeys(de = null) {
  const desktopEnv = de || detectDesktopEnvironment();
  console.log(`[HotkeySetup] Detected desktop environment: ${desktopEnv}`);
  
  const candycodePath = path.join(os.homedir(), '.local', 'bin', 'CandyCode');
  
  switch (desktopEnv) {
    case 'gnome':
      setupGnomeHotkeys(candycodePath);
      break;
    case 'kde':
      setupKdeHotkeys(candycodePath);
      break;
    case 'xfce':
      setupXfceHotkeys(candycodePath);
      break;
    case 'mate':
      setupMateHotkeys(candycodePath);
      break;
    case 'cinnamon':
      setupCinnamonHotkeys(candycodePath);
      break;
    default:
      setupGenericX11Hotkeys(candycodePath);
  }
}

function setupGnomeHotkeys(execPath) {
  console.log('[HotkeySetup] Setting up GNOME hotkeys...');
  
  const hotkeyId = 'candycode-launch';
  const binding = DEFAULT_HOTKEY.linux;
  
  try {
    // Get next custom keybinding ID
    const existingBindings = runCommand(
      'gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings',
      { ignoreError: true }
    );
    
    let customKeybindings = [];
    if (existingBindings.success) {
      try {
        customKeybindings = JSON.parse(existingBindings.output.trim());
      } catch {}
    }
    
    // Check if our binding already exists
    const existingIndex = customKeybindings.findIndex(k => k.includes(hotkeyId));
    if (existingIndex !== -1) {
      console.log('[HotkeySetup] GNOME hotkey already configured, updating...');
    } else {
      // Add new binding
      const newBinding = `/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/${hotkeyId}/`;
      customKeybindings.push(newBinding);
      
      // Update the list
      runCommand(`gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "${JSON.stringify(customKeybindings)}"`);
    }
    
    // Set the binding properties
    runCommand(`gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:${hotkeyId} name "Launch CandyCode"`);
    runCommand(`gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:${hotkeyId} command "${execPath}"`);
    runCommand(`gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:${hotkeyId} binding "${binding}"`);
    
    console.log(`✓ GNOME hotkey configured: ${binding} → ${execPath}`);
  } catch (error) {
    console.error('✗ Failed to setup GNOME hotkeys:', error.message);
    console.log('  Make sure gsettings is available and GNOME is running.');
  }
}

function setupKdeHotkeys(execPath) {
  console.log('[HotkeySetup] Setting up KDE hotkeys...');
  
  const khotkeysPath = path.join(os.homedir(), '.local', 'share', 'khotkeys');
  const configFile = path.join(khotkeysPath, 'candycode.khotkeys');
  
  try {
    if (!fs.existsSync(khotkeysPath)) {
      fs.mkdirSync(khotkeysPath, { recursive: true });
    }
    
    // Create KHotKeys configuration
    const khotkeysContent = `<?xml version="1.0"?>
<!DOCTYPE KHotKeys><khotkeys version="1" khotkeys_version="1.0">
<entry>
  <name>CandyCode Launcher</name>
  <comment>Launch CandyCode with keyboard shortcut</comment>
  <type>ACTION</type>
  <action_group_list>
    <action_group>
      <action_list>
        <action>
          <type>COMMAND</type>
          <command>${execPath}</command>
        </action>
      </action_list>
      <trigger_list>
        <trigger>
          <type>SHORTCUT</type>
          <shortcut>${DEFAULT_HOTKEY.linux.replace(/<|>/g, '')}</shortcut>
        </trigger>
      </trigger_list>
    </action_group>
  </action_group_list>
</entry>
</khotkeys>`;
    
    fs.writeFileSync(configFile, khotkeysContent);
    console.log(`✓ KDE hotkey configuration created: ${configFile}`);
    console.log('  Note: You may need to restart KDE or run: qdbus org.kde.khotkeys /khotkeys refresh');
  } catch (error) {
    console.error('✗ Failed to setup KDE hotkeys:', error.message);
  }
}

function setupXfceHotkeys(execPath) {
  console.log('[HotkeySetup] Setting up XFCE hotkeys...');
  
  try {
    // Use xfce4-keyboard-settings
    const cmdId = runCommand('xfconf-query -c xfce4-keyboard-shortcuts -l | grep -c "Custom"', { ignoreError: true });
    
    // Find next available custom command ID
    let customCmd = 'Custom%3'; // Default starting point
    for (let i = 3; i < 20; i++) {
      const testCmd = `Custom%${i}`;
      const check = runCommand(`xfconf-query -c xfce4-keyboard-shortcuts -l | grep -c "${testCmd}"`, { ignoreError: true });
      if (!check.success || check.output.trim() === '0') {
        customCmd = testCmd;
        break;
      }
    }
    
    // Set the command
    runCommand(`xfconf-query -c xfce4-keyboard-shortcuts -p /commands/custom/${customCmd} -n -t string -s "${execPath}"`);
    
    // Set the binding (Super+Alt+C)
    runCommand(`xfconf-query -c xfce4-keyboard-shortcuts -p /commands/custom/None -n -t string -s "${execPath}"`);
    
    console.log(`✓ XFCE hotkey configured: ${DEFAULT_HOTKEY.linux} → ${execPath}`);
    console.log('  Note: You may need to log out and back in for changes to take effect.');
  } catch (error) {
    console.error('✗ Failed to setup XFCE hotkeys:', error.message);
    console.log('  Make sure xfconf-query is available.');
  }
}

function setupMateHotkeys(execPath) {
  console.log('[HotkeySetup] Setting up MATE hotkeys...');
  
  try {
    const hotkeyId = 'candycode-launch';
    
    runCommand(`gsettings set org.mate.desktop.keybindings.${hotkeyId} name "Launch CandyCode"`);
    runCommand(`gsettings set org.mate.desktop.keybindings.${hotkeyId} action "${execPath}"`);
    runCommand(`gsettings set org.mate.desktop.keybindings.${hotkeyId} binding "${DEFAULT_HOTKEY.linux}"`);
    
    console.log(`✓ MATE hotkey configured: ${DEFAULT_HOTKEY.linux} → ${execPath}`);
  } catch (error) {
    console.error('✗ Failed to setup MATE hotkeys:', error.message);
  }
}

function setupCinnamonHotkeys(execPath) {
  console.log('[HotkeySetup] Setting up Cinnamon hotkeys...');
  
  try {
    const hotkeyId = 'candycode-launch';
    
    runCommand(`gsettings set org.cinnamon.desktop.keybindings.${hotkeyId} name "Launch CandyCode"`);
    runCommand(`gsettings set org.cinnamon.desktop.keybindings.${hotkeyId} action "${execPath}"`);
    runCommand(`gsettings set org.cinnamon.desktop.keybindings.${hotkeyId} binding "${DEFAULT_HOTKEY.linux}"`);
    
    console.log(`✓ Cinnamon hotkey configured: ${DEFAULT_HOTKEY.linux} → ${execPath}`);
  } catch (error) {
    console.error('✗ Failed to setup Cinnamon hotkeys:', error.message);
  }
}

function setupGenericX11Hotkeys(execPath) {
  console.log('[HotkeySetup] Setting up generic X11 hotkeys using xbindkeys...');
  
  const xbindkeysConfig = path.join(os.homedir(), '.xbindkeysrc');
  
  try {
    let content = '';
    if (fileExists(xbindkeysConfig)) {
      content = fs.readFileSync(xbindkeysConfig, 'utf8');
    }
    
    // Check if already configured
    if (!content.includes('CandyCode')) {
      const hotkeyEntry = `
# CandyCode Launcher
"${execPath}"
  Mod4 + Mod1 + c
`;
      content += hotkeyEntry;
      fs.writeFileSync(xbindkeysConfig, content);
      console.log(`✓ xbindkeys configuration updated: ${xbindkeysConfig}`);
      console.log('  Run "xbindkeys -p" to reload or restart xbindkeys.');
    } else {
      console.log('✓ CandyCode already configured in xbindkeys.');
    }
  } catch (error) {
    console.error('✗ Failed to setup xbindkeys:', error.message);
    console.log('  Install xbindkeys: sudo apt install xbindkeys');
  }
}

// =============================================================================
// macOS Hotkey Setup
// =============================================================================

function setupMacOsHotkeys() {
  console.log('[HotkeySetup] Setting up macOS hotkeys...');
  
  const candycodePath = '/Applications/CandyCode.app';
  const hotkeyScriptPath = path.join(os.homedir(), 'Library', 'Scripts', 'CandyCodeLauncher.scpt');
  
  try {
    // Create Scripts directory
    const scriptsDir = path.join(os.homedir(), 'Library', 'Scripts');
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }
    
    // Create AppleScript
    const appleScript = `on run
    tell application "CandyCode"
        activate
    end tell
end run`;
    
    fs.writeFileSync(hotkeyScriptPath, appleScript);
    console.log(`✓ AppleScript created: ${hotkeyScriptPath}`);
    
    // Instructions for System Preferences
    console.log('\n[HotkeySetup] To enable the hotkey in macOS:');
    console.log('1. Open System Preferences → Keyboard → Shortcuts');
    console.log('2. Select "App Shortcuts" in the left panel');
    console.log('3. Click "+" to add a new shortcut');
    console.log('4. Select CandyCode application');
    console.log('5. Enter Menu Title: "Launch"');
    console.log(`6. Press keyboard shortcut: ${DEFAULT_HOTKEY.darwin.replace(/<|>/g, '+')}`);
    console.log('\nAlternatively, use a third-party tool like:');
    console.log('  - Karabiner-Elements (free): https://karabiner-elements.pqrs.org/');
    console.log('  - BetterTouchTool (paid): https://folivora.ai/');
    console.log('  - Raycast (free): https://www.raycast.com/');
    
  } catch (error) {
    console.error('✗ Failed to setup macOS hotkeys:', error.message);
  }
}

// =============================================================================
// Windows Hotkey Setup
// =============================================================================

function setupWindowsHotkeys() {
  console.log('[HotkeySetup] Setting up Windows hotkeys...');
  
  const startupPath = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const shortcutPath = path.join(startupPath, 'CandyCode.lnk');
  
  try {
    // Create startup directory if needed
    if (!fs.existsSync(startupPath)) {
      fs.mkdirSync(startupPath, { recursive: true });
    }
    
    // Create VBScript for hotkey (since we can't create .lnk directly from Node.js)
    const vbsPath = path.join(os.tmpdir(), 'create_shortcut.vbs');
    const vbsContent = `
Set WshShell = WScript.CreateObject("WScript.Shell")
Set oShellLink = WshShell.CreateShortcut("${shortcutPath}")
oShellLink.TargetPath = "${path.join(INSTALL_DIR, 'release', 'CandyCode*.exe').replace(/\\/g, '\\\\')}"
oShellLink.Description = "Launch CandyCode"
oShellLink.HotKey = "CTRL+ALT+C"
oShellLink.WindowStyle = 1
oShellLink.Save
Set oShellLink = Nothing
Set WshShell = Nothing
WScript.Echo "Shortcut created successfully"
`;
    
    fs.writeFileSync(vbsPath, vbsContent);
    
    // Execute the VBScript
    runCommand(`cscript //nologo "${vbsPath}"`);
    
    // Clean up
    fs.unlinkSync(vbsPath);
    
    console.log(`✓ Windows shortcut created: ${shortcutPath}`);
    console.log('  Hotkey: Ctrl+Alt+C');
    console.log('  The shortcut will be added to Startup for automatic launch.');
    
    // Also create a desktop shortcut
    const desktopPath = path.join(os.homedir(), 'Desktop', 'CandyCode.lnk');
    const vbsContent2 = `
Set WshShell = WScript.CreateObject("WScript.Shell")
Set oShellLink = WshShell.CreateShortcut("${desktopPath}")
oShellLink.TargetPath = "${path.join(INSTALL_DIR, 'release', 'CandyCode*.exe').replace(/\\/g, '\\\\')}"
oShellLink.Description = "Launch CandyCode"
oShellLink.HotKey = "CTRL+ALT+C"
oShellLink.WindowStyle = 1
oShellLink.Save
Set oShellLink = Nothing
Set WshShell = Nothing
`;
    fs.writeFileSync(vbsPath, vbsContent2);
    runCommand(`cscript //nologo "${vbsPath}"`);
    fs.unlinkSync(vbsPath);
    
    console.log(`✓ Desktop shortcut created: ${desktopPath}`);
    
  } catch (error) {
    console.error('✗ Failed to setup Windows hotkeys:', error.message);
  }
}

// =============================================================================
// Electron Global Hotkey (Runtime)
// =============================================================================

function setupElectronHotkey() {
  console.log('[HotkeySetup] Setting up Electron global hotkey...');
  
  const electronMainPath = path.join(INSTALL_DIR, 'electron', 'main.ts');
  const electronMainJsPath = path.join(INSTALL_DIR, 'dist-electron', 'main.js');
  
  const hotkeyCode = `
// =============================================================================
// Global Hotkey Registration
// =============================================================================

const { globalShortcut } = require('electron');

function registerGlobalHotkeys() {
  // Register Super/Command + Alt + C to launch CandyCode
  const hotkey = process.platform === 'darwin' ? 'Command+Alt+C' : 
                 process.platform === 'win32' ? 'Ctrl+Alt+C' : 
                 'Super+Alt+C';
  
  const registered = globalShortcut.register(hotkey, () => {
    console.log('[Hotkey] CandyCode launch hotkey triggered!');
    
    // Focus or create the main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
    } else {
      createWindow();
    }
  });
  
  if (registered) {
    console.log(\`[Hotkey] Global shortcut registered: \${hotkey}\`);
  } else {
    console.error('[Hotkey] Global shortcut registration failed');
  }
}

// Unregister hotkeys on app quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
`;
  
  try {
    // Check if main.ts exists
    if (fileExists(electronMainPath)) {
      let content = fs.readFileSync(electronMainPath, 'utf8');
      
      if (!content.includes('globalShortcut')) {
        // Find the app.on('ready') section
        const readyPattern = /app\.on\(['"]ready['"],\s*(?:async\s*)?\(\)\s*=>\s*\{/;
        const match = content.match(readyPattern);
        
        if (match) {
          const insertPos = match.index + match[0].length;
          content = content.slice(0, insertPos) + '\n  registerGlobalHotkeys();' + content.slice(insertPos);
          
          // Add the import at the top
          if (!content.includes('globalShortcut')) {
            content = content.replace(
              /import\s*{\s*app[^}]*}\s*from\s*['"]electron['"]/,
              "import { app, globalShortcut } from 'electron'"
            );
          }
          
          // Add the function before the app.on('ready')
          const functionInsertPos = content.indexOf('app.on(\'ready\'');
          if (functionInsertPos !== -1) {
            content = content.slice(0, functionInsertPos) + hotkeyCode + '\n' + content.slice(functionInsertPos);
          }
          
          fs.writeFileSync(electronMainPath, content);
          console.log('✓ Electron main.ts updated with global hotkey support');
        }
      } else {
        console.log('✓ Electron main.ts already has hotkey support');
      }
    }
    
    // Also update dist-electron/main.js if it exists
    if (fileExists(electronMainJsPath)) {
      let content = fs.readFileSync(electronMainJsPath, 'utf8');
      
      if (!content.includes('globalShortcut')) {
        console.log('  Note: You should rebuild the app (npm run build) to apply hotkey changes to main.js');
      }
    }
    
  } catch (error) {
    console.error('✗ Failed to setup Electron hotkey:', error.message);
  }
}

// =============================================================================
// Main Setup Function
// =============================================================================

function showUsage() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║           CandyCode Global Hotkey Setup                           ║
╚═══════════════════════════════════════════════════════════════════╝

Usage: node scripts/setup-hotkeys.js [options]

Options:
  --de <name>       Specify desktop environment (gnome, kde, xfce, mate, cinnamon)
  --electron        Setup Electron runtime global hotkey
  --all             Setup both system and Electron hotkeys
  --help            Show this help message

Default Hotkeys:
  Linux:   Super + Alt + C
  macOS:   Command + Alt + C
  Windows: Ctrl + Alt + C

Examples:
  node scripts/setup-hotkeys.js           # Auto-detect and setup
  node scripts/setup-hotkeys.js --de gnome
  node scripts/setup-hotkeys.js --electron
  node scripts/setup-hotkeys.js --all
`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }
  
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║           CandyCode Global Hotkey Setup                           ║
╚═══════════════════════════════════════════════════════════════════╝
`);
  
  console.log(`Platform: ${PLATFORM}`);
  console.log(`Installation: ${INSTALL_DIR}\n`);
  
  const setupElectron = args.includes('--electron') || args.includes('--all');
  const forceDE = args.find(arg => arg === '--de') ? args[args.indexOf('--de') + 1] : null;
  
  try {
    if (PLATFORM === 'linux') {
      setupLinuxHotkeys(forceDE);
    } else if (PLATFORM === 'darwin') {
      setupMacOsHotkeys();
    } else if (PLATFORM === 'win32') {
      setupWindowsHotkeys();
    }
    
    if (setupElectron) {
      setupElectronHotkey();
    }
    
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                    Setup Complete!                                ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
