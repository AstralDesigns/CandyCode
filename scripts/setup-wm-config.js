#!/usr/bin/env node

/**
 * CandyCode Tiling Window Manager Configuration Generator
 * Generates configuration snippets for Hyprland, sway, i3, and other WMs
 * Also sets up CandyCode as default editor with proper MIME associations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// =============================================================================
// Dynamic Installation Directory Detection
// =============================================================================

function getInstallationDirectory() {
  const strategies = [
    () => {
      const scriptDir = path.resolve(__dirname, '..');
      if (isValidCandyCodeRoot(scriptDir)) return scriptDir;
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
    () => {
      const home = os.homedir();
      const locations = [
        path.join(home, 'AgenticApp'),
        path.join(home, 'CandyCode'),
        path.join(home, '.local', 'opt', 'CandyCode'),
        path.join('/opt', 'CandyCode'),
      ];
      for (const loc of locations) {
        if (isValidCandyCodeRoot(loc)) return loc;
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
  } catch {
    return false;
  }
}

const INSTALL_DIR = getInstallationDirectory();
if (!INSTALL_DIR) {
  console.error('ERROR: Could not determine CandyCode installation directory.');
  process.exit(1);
}

const CANDYCODE_CMD = path.join(os.homedir(), '.local', 'bin', 'CandyCode');
const DESKTOP_FILE = path.join(os.homedir(), '.local', 'share', 'applications', 'candycode.desktop');

console.log(`[WMConfig] Using installation directory: ${INSTALL_DIR}`);

// =============================================================================
// Configuration Templates
// =============================================================================

const HYPRLAND_CONFIG = `# =============================================================================
# CandyCode Configuration for Hyprland
# Add this to your hyprland.conf
# =============================================================================

# Keyboard shortcut to launch CandyCode
# You can customize the keybind (currently: SUPER + ALT + C)
bind = \$mainMod ALT, C, exec, ${CANDYCODE_CMD}

# Alternative keybinds (uncomment your preferred one):
# bind = \$mainMod, E, exec, ${CANDYCODE_CMD}                    # SUPER + E (like VSCode)
# bind = \$mainMod SHIFT, C, exec, ${CANDYCODE_CMD}              # SUPER + SHIFT + C
# bind = ALT SUPER, C, exec, ${CANDYCODE_CMD}                    # ALT + SUPER + C

# Optional: Set CandyCode as default editor for specific file types
# Add to your environment section:
# env = EDITOR,${CANDYCODE_CMD}
# env = VISUAL,${CANDYCODE_CMD}

# Window rules for CandyCode (optional)
# windowrulev2 = float, class:^(CandyCode)$, title:^(CandyCode)$
# windowrulev2 = size 1200 800, class:^(CandyCode)$
# windowrulev2 = center, class:^(CandyCode)$
`;

const SWAY_CONFIG = `# =============================================================================
# CandyCode Configuration for sway
# Add this to your sway config (~/.config/sway/config)
# =============================================================================

# Keyboard shortcut to launch CandyCode
# You can customize the keybind (currently: Mod4 + Alt + C)
bindsym \$mod+Alt+C exec ${CANDYCODE_CMD}

# Alternative keybinds (uncomment your preferred one):
# bindsym \$mod+e exec ${CANDYCODE_CMD}                        # Mod + E (like VSCode)
# bindsym \$mod+Shift+c exec ${CANDYCODE_CMD}                  # Mod + Shift + C
# bindsym Alt+Mod4+C exec ${CANDYCODE_CMD}                     # Alt + Super + C

# Set as default editor (add to your config)
# set \$env EDITOR ${CANDYCODE_CMD}
# set \$env VISUAL ${CANDYCODE_CMD}

# Window preferences for CandyCode (optional)
# for_window [class="CandyCode"] resize set 1200 800
# for_window [class="CandyCode"] move position center
`;

const I3_CONFIG = `# =============================================================================
# CandyCode Configuration for i3
# Add this to your i3 config (~/.config/i3/config)
# =============================================================================

# Keyboard shortcut to launch CandyCode
# You can customize the keybind (currently: Mod4 + Alt + C)
bindsym \$mod+Alt+C exec ${CANDYCODE_CMD}

# Alternative keybinds (uncomment your preferred one):
# bindsym \$mod+e exec ${CANDYCODE_CMD}                        # Mod + E (like VSCode)
# bindsym \$mod+Shift+c exec ${CANDYCODE_CMD}                  # Mod + Shift + C
# bindsym Alt+Mod4+C exec ${CANDYCODE_CMD}                     # Alt + Super + C

# Set as default editor (add to your config)
# set \$env EDITOR ${CANDYCODE_CMD}
# set \$env VISUAL ${CANDYCODE_CMD}

# Window preferences for CandyCode (optional)
# for_window [class="CandyCode"] resize set 1200 800
# for_window [class="CandyCode"] move position center
`;

const BASHRC_ADDITION = `
# =============================================================================
# CandyCode Configuration
# =============================================================================

# Set CandyCode as default editor
export EDITOR="${CANDYCODE_CMD}"
export VISUAL="${CANDYCODE_CMD}"

# Add CandyCode to PATH if not already present
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    export PATH="$HOME/.local/bin:$PATH"
fi

# Optional: Alias for quick access
alias candycode="${CANDYCODE_CMD}"
alias cc="${CANDYCODE_CMD}"
`;

const FISHRC_ADDITION = `
# =============================================================================
# CandyCode Configuration
# =============================================================================

# Set CandyCode as default editor
set -gx EDITOR "${CANDYCODE_CMD}"
set -gx VISUAL "${CANDYCODE_CMD}"

# Add CandyCode to PATH if not already present
if not string match -q -- "$HOME/.local/bin" $PATH
    fish_add_path $HOME/.local/bin
end

# Optional: Alias for quick access
alias candycode="${CANDYCODE_CMD}"
alias cc="${CANDYCODE_CMD}"
`;

const ZSHRC_ADDITION = `
# =============================================================================
# CandyCode Configuration
# =============================================================================

# Set CandyCode as default editor
export EDITOR="${CANDYCODE_CMD}"
export VISUAL="${CANDYCODE_CMD}"

# Add CandyCode to PATH if not already present
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    export PATH="$HOME/.local/bin:$PATH"
fi

# Optional: Alias for quick access
alias candycode="${CANDYCODE_CMD}"
alias cc="${CANDYCODE_CMD}"
`;

// =============================================================================
// Setup Functions
// =============================================================================

function setupDesktopEntry() {
  console.log('[WMConfig] Setting up desktop entry...');
  
  const desktopDir = path.join(os.homedir(), '.local', 'share', 'applications');
  if (!fs.existsSync(desktopDir)) {
    fs.mkdirSync(desktopDir, { recursive: true });
  }
  
  const desktopContent = `[Desktop Entry]
Name=CandyCode
Comment=A futuristic AI-powered code editor and workspace
Exec=${CANDYCODE_CMD} %F
Icon=candycode
Terminal=false
Type=Application
Categories=Development;IDE;TextEditor;
StartupNotify=true
StartupWMClass=CandyCode
MimeType=text/plain;text/html;text/css;text/javascript;application/javascript;application/json;text/xml;application/xml;text/markdown;text/x-python;text/x-java;text/x-c;text/x-c++;text/x-csharp;text/x-ruby;text/x-php;text/x-go;text/x-rust;text/x-typescript;text/x-yaml;text/x-shellscript;application/x-sh;
Keywords=code;editor;ide;development;ai;programming;
Actions=NewWindow;

[Desktop Action NewWindow]
Name=Open New Window
Exec=${CANDYCODE_CMD}
`;

  fs.writeFileSync(DESKTOP_FILE, desktopContent);
  console.log(`✓ Desktop entry created: ${DESKTOP_FILE}`);
  
  // Update desktop database
  try {
    execSync('update-desktop-database ~/.local/share/applications 2>/dev/null || true', { stdio: 'pipe' });
    console.log('✓ Desktop database updated');
  } catch {
    console.log('  (Could not update desktop database, but this is optional)');
  }
}

function setupMIMEAssociations() {
  console.log('[WMConfig] Setting up MIME type associations...');
  
  const mimeAppsFiles = [
    path.join(os.homedir(), '.config', 'mimeapps.list'),
    path.join(os.homedir(), '.local', 'share', 'applications', 'mimeapps.list'),
  ];
  
  const textMimeTypes = [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/json',
    'text/xml',
    'application/xml',
    'text/markdown',
    'text/x-python',
    'text/x-java',
    'text/x-c',
    'text/x-c++',
    'text/x-csharp',
    'text/x-ruby',
    'text/x-php',
    'text/x-go',
    'text/x-rust',
    'text/x-typescript',
    'text/x-yaml',
    'text/x-shellscript',
  ].join(';');
  
  const association = `\n[Default Applications]\ntext/plain=candycode.desktop\n`;
  
  for (const mimeFile of mimeAppsFiles) {
    try {
      let content = '';
      if (fs.existsSync(mimeFile)) {
        content = fs.readFileSync(mimeFile, 'utf8');
      }
      
      // Check if already configured
      if (content.includes('candycode.desktop')) {
        console.log(`  MIME already configured in ${mimeFile}`);
        continue;
      }
      
      // Add or update Default Applications section
      if (content.includes('[Default Applications]')) {
        content = content.replace(
          /(\[Default Applications\][^\[]*)/s,
          `$1text/plain=candycode.desktop\n`
        );
      } else {
        content += association;
      }
      
      // Ensure directory exists
      const dir = path.dirname(mimeFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(mimeFile, content);
      console.log(`✓ MIME associations updated: ${mimeFile}`);
    } catch (error) {
      console.log(`  Could not update ${mimeFile}: ${error.message}`);
    }
  }
}

function setupShellConfig() {
  console.log('[WMConfig] Setting up shell configurations...');
  
  const shellConfigs = [
    { file: path.join(os.homedir(), '.bashrc'), content: BASHRC_ADDITION },
    { file: path.join(os.homedir(), '.bash_profile'), content: BASHRC_ADDITION },
    { file: path.join(os.homedir(), '.zshrc'), content: ZSHRC_ADDITION },
    { file: path.join(os.homedir(), '.config', 'fish', 'config.fish'), content: FISHRC_ADDITION },
  ];
  
  for (const { file, content } of shellConfigs) {
    try {
      // Ensure directory exists
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      let existingContent = '';
      if (fs.existsSync(file)) {
        existingContent = fs.readFileSync(file, 'utf8');
      }
      
      // Check if already configured
      if (existingContent.includes('CandyCode Configuration')) {
        console.log(`  Shell config already exists: ${file}`);
        continue;
      }
      
      fs.appendFileSync(file, content);
      console.log(`✓ Shell configuration added: ${file}`);
    } catch (error) {
      console.log(`  Could not update ${file}: ${error.message}`);
    }
  }
}

function generateWMConfig(wmType) {
  console.log(`[WMConfig] Generating configuration for ${wmType}...`);
  
  const configDir = path.join(os.homedir(), '.config', 'candycode');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  let configContent = '';
  let configFile = '';
  
  switch (wmType) {
    case 'hyprland':
      configContent = HYPRLAND_CONFIG;
      configFile = path.join(configDir, 'hyprland.conf');
      break;
    case 'sway':
      configContent = SWAY_CONFIG;
      configFile = path.join(configDir, 'sway.conf');
      break;
    case 'i3':
      configContent = I3_CONFIG;
      configFile = path.join(configDir, 'i3.conf');
      break;
    default:
      console.error(`Unknown WM type: ${wmType}`);
      return;
  }
  
  fs.writeFileSync(configFile, configContent);
  console.log(`✓ Configuration generated: ${configFile}`);
  
  // Try to auto-install if the WM config exists
  let targetConfig = null;
  switch (wmType) {
    case 'hyprland':
      targetConfig = path.join(os.homedir(), '.config', 'hypr', 'hyprland.conf');
      break;
    case 'sway':
      targetConfig = path.join(os.homedir(), '.config', 'sway', 'config');
      break;
    case 'i3':
      targetConfig = path.join(os.homedir(), '.config', 'i3', 'config');
      break;
  }
  
  if (targetConfig && fs.existsSync(targetConfig)) {
    console.log(`\n[Auto-Install] Found existing config at: ${targetConfig}`);
    console.log('To add CandyCode to your WM config, add these lines:\n');
    console.log('--- CUT HERE ---');
    if (wmType === 'hyprland') {
      console.log(`bind = $mainMod ALT, C, exec, ${CANDYCODE_CMD}`);
    } else {
      console.log(`bindsym $mod+Alt+C exec ${CANDYCODE_CMD}`);
    }
    console.log('--- CUT HERE ---\n');
    console.log('Or manually edit your config and add the lines above.');
  } else {
    console.log(`\n[Info] Copy the generated config to your WM configuration:`);
    console.log(`  For Hyprland: Add to ~/.config/hypr/hyprland.conf`);
    console.log(`  For sway: Add to ~/.config/sway/config`);
    console.log(`  For i3: Add to ~/.config/i3/config`);
  }
}

function detectWM() {
  console.log('[WMConfig] Detecting window manager...');
  
  // Check environment variables
  const wmVars = ['HYPRLAND_INSTANCE_SIGNATURE', 'SWAYSOCK', 'I3SOCK'];
  for (const envVar of wmVars) {
    if (process.env[envVar]) {
      const wm = envVar.split('_')[0].toLowerCase();
      console.log(`✓ Detected: ${wm} (via ${envVar})`);
      return wm;
    }
  }
  
  // Check running processes
  try {
    const output = execSync('ps aux', { encoding: 'utf8' });
    if (output.includes('Hyprland')) return 'hyprland';
    if (output.includes('sway')) return 'sway';
    if (output.includes('i3')) return 'i3';
  } catch {}
  
  // Check config files
  const configPaths = [
    { path: path.join(os.homedir(), '.config', 'hypr', 'hyprland.conf'), wm: 'hyprland' },
    { path: path.join(os.homedir(), '.config', 'sway', 'config'), wm: 'sway' },
    { path: path.join(os.homedir(), '.config', 'i3', 'config'), wm: 'i3' },
  ];
  
  for (const { path: configPath, wm } of configPaths) {
    if (fs.existsSync(configPath)) {
      console.log(`✓ Detected: ${wm} (via config file)`);
      return wm;
    }
  }
  
  console.log('  No supported WM detected');
  return null;
}

function showUsage() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║     CandyCode Tiling WM Configuration Generator                   ║
╚═══════════════════════════════════════════════════════════════════╝

Usage: node scripts/setup-wm-config.js [options]

Options:
  --wm <type>       Specify window manager (hyprland, sway, i3)
  --auto            Auto-detect WM and setup
  --desktop-only    Only setup desktop entry and MIME associations
  --shell-only      Only setup shell configurations
  --help            Show this help message

Examples:
  node scripts/setup-wm-config.js --auto              # Auto-detect and setup all
  node scripts/setup-wm-config.js --wm hyprland       # Generate Hyprland config
  node scripts/setup-wm-config.js --desktop-only      # Setup as default editor
  node scripts/setup-wm-config.js --wm sway --desktop-only

After running:
  1. Add the generated keybind to your WM config (if not auto-detected)
  2. Reload your WM config (usually Mod+Shift+R or similar)
  3. Restart your shell or run: source ~/.bashrc (or appropriate file)
  4. Test with your configured keybind (default: Super+Alt+C)
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
║     CandyCode Tiling WM Configuration Generator                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);
  
  console.log(`Installation: ${INSTALL_DIR}`);
  console.log(`Command path: ${CANDYCODE_CMD}\n`);
  
  const autoDetect = args.includes('--auto');
  const desktopOnly = args.includes('--desktop-only');
  const shellOnly = args.includes('--shell-only');
  const wmArg = args.find(arg => arg === '--wm') ? args[args.indexOf('--wm') + 1] : null;
  
  let wm = wmArg;
  if (autoDetect && !wm) {
    wm = detectWM();
  }
  
  try {
    if (!shellOnly) {
      setupDesktopEntry();
      setupMIMEAssociations();
    }
    
    if (!desktopOnly) {
      setupShellConfig();
      
      if (wm) {
        generateWMConfig(wm);
      }
    }
    
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                    Setup Complete!                                ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
    
    console.log('Next steps:');
    console.log('1. Restart your terminal or run: source ~/.bashrc (or ~/.zshrc, etc.)');
    if (wm) {
      console.log(`2. Add the keybind to your ${wm} config (see generated config file)`);
      console.log(`3. Reload ${wm} config (usually Mod+Shift+R)`);
    }
    console.log('4. Test with: CandyCode (command) or your configured keybind\n');
    
  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
