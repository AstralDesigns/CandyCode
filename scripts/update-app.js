const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const glob = require('glob');

const npmFlags = '--prefer-offline --no-audit --no-fund';

// NVM versions
const NVM_VERSION = 'v0.40.0';
const NVM_WINDOWS_VERSION = 'v1.1.12';

// =============================================================================
// Prerequisite Checks
// Ensures Node.js and npm are installed before proceeding
// =============================================================================

/**
 * Parse version string to comparable array
 * @param {string} version - Version string (e.g., 'v22.12.0')
 * @returns {number[]} Array of version numbers
 */
function parseVersion(version) {
  return version.replace(/^v/, '').split('.').map(Number);
}

/**
 * Compare two version strings
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const v1Parts = parseVersion(v1);
  const v2Parts = parseVersion(v2);
  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  for (let i = 0; i < maxLength; i++) {
    const v1Num = v1Parts[i] || 0;
    const v2Num = v2Parts[i] || 0;
    if (v1Num < v2Num) return -1;
    if (v1Num > v2Num) return 1;
  }
  return 0;
}

/**
 * Check if Node.js is from nvm
 * @returns {boolean} True if using nvm
 */
function isUsingNvm() {
  return process.execPath.includes('.nvm');
}

/**
 * Check if Node.js and npm meet minimum version requirements
 * @returns {{ nodeOk: boolean, npmOk: boolean, nodeVersion: string, npmVersion: string, usingNvm: boolean }}
 */
function checkVersions() {
  const result = {
    nodeOk: false,
    npmOk: false,
    nodeVersion: 'unknown',
    npmVersion: 'unknown',
    usingNvm: false,
  };

  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    result.nodeVersion = nodeVersion;
    result.usingNvm = isUsingNvm();
    result.nodeOk = result.usingNvm || compareVersions(nodeVersion, '18.0.0') >= 0;
  } catch (error) {
    result.nodeOk = false;
  }

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    result.npmVersion = npmVersion;
    result.npmOk = compareVersions(npmVersion, '9.0.0') >= 0;
  } catch (error) {
    result.npmOk = false;
  }

  return result;
}

/**
 * Check if Node.js and npm are installed
 * @returns {{ node: boolean, npm: boolean, nodeVersion: string|null, npmVersion: string|null }}
 */
function checkPrerequisites() {
  const result = {
    node: false,
    npm: false,
    nodeVersion: null,
    npmVersion: null,
  };

  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    result.node = true;
    result.nodeVersion = nodeVersion;
  } catch (error) {
    result.node = false;
  }

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    result.npm = true;
    result.npmVersion = npmVersion;
  } catch (error) {
    result.npm = false;
  }

  return result;
}

/**
 * Get installation instructions for Node.js based on the platform
 * @param {string} platform - The platform (linux, darwin, win32)
 * @param {string} linuxDistro - The Linux distribution (if applicable)
 * @returns {string} Installation instructions
 */
function getNodeInstallationInstructions(platform, linuxDistro = null) {
  let instructions = '';

  if (platform === 'linux') {
    instructions = '\n\nInstall Node.js using your distribution\'s package manager:\n\n';

    if (!linuxDistro || linuxDistro.includes('ubuntu') || linuxDistro.includes('debian')) {
      instructions += `  Ubuntu/Debian:
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs

  Or using apt (older versions):
    sudo apt-get update
    sudo apt-get install -y nodejs npm
`;
    } else if (linuxDistro.includes('fedora')) {
      instructions += `  Fedora:
    sudo dnf install -y nodejs npm
`;
    } else if (linuxDistro.includes('arch') || linuxDistro.includes('cachyos')) {
      instructions += `  Arch Linux/CachyOS:
    sudo pacman -S nodejs npm
`;
    } else if (linuxDistro.includes('opensuse') || linuxDistro.includes('suse')) {
      instructions += `  openSUSE:
    sudo zypper install -y nodejs npm
`;
    } else {
      instructions += `  Generic Linux:
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs

  Or use NVM (Node Version Manager):
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    # Restart your terminal, then:
    nvm install --lts
`;
    }

    instructions += `
  After installation, verify with:
    node --version
    npm --version
`;
  } else if (platform === 'darwin') {
    instructions = `

Install Node.js on macOS using one of these methods:

  1. Using Homebrew (recommended):
     brew install node

  2. Using the official installer:
     Download from: https://nodejs.org/
     Choose the "LTS" version for stability

  3. Using NVM (Node Version Manager):
     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
     # Restart your terminal, then:
     nvm install --lts

  After installation, verify with:
    node --version
    npm --version
`;
  } else if (platform === 'win32') {
    instructions = `

Install Node.js on Windows:

  1. Download the official installer:
     Visit: https://nodejs.org/
     Choose the "LTS" version (recommended for most users)
     Run the installer and follow the prompts
     Make sure to check "Add to PATH" during installation

  2. Using Windows Package Manager (winget):
     winget install OpenJS.NodeJS.LTS

  3. Using Chocolatey (if installed):
     choco install nodejs-lts

  After installation, restart your terminal and verify with:
    node --version
    npm --version
`;
  }

  return instructions;
}

/**
 * Detect Linux distribution
 * @returns {string|null} The Linux distribution name or null if not Linux
 */
function detectLinuxDistro() {
  if (process.platform !== 'linux') {
    return null;
  }

  try {
    // Try reading /etc/os-release first
    if (fs.existsSync('/etc/os-release')) {
      const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
      const idMatch = osRelease.match(/^ID=(.+)/m);
      if (idMatch) {
        return idMatch[1].replace(/["']/g, '').toLowerCase();
      }
      const idLikeMatch = osRelease.match(/^ID_LIKE=(.+)/m);
      if (idLikeMatch) {
        return idLikeMatch[1].replace(/["']/g, '').toLowerCase();
      }
    }

    // Fallback to lsb_release
    try {
      const lsbRelease = execSync('lsb_release -i -s', { encoding: 'utf8', stdio: 'pipe' }).trim().toLowerCase();
      return lsbRelease;
    } catch (e) {
      // Ignore
    }

    return 'linux';
  } catch (error) {
    return 'linux';
  }
}

/**
 * Validate and report prerequisite status
 */
function validatePrerequisites() {
  console.log('Checking prerequisites...\n');

  const prereqs = checkPrerequisites();
  const versions = checkVersions();
  const platform = process.platform;
  const linuxDistro = detectLinuxDistro();

  console.log(`Platform: ${platform}${platform === 'linux' && linuxDistro ? ` (${linuxDistro})` : ''}`);
  console.log(`Node.js: ${prereqs.node ? '✓' : '✗'} ${prereqs.nodeVersion || 'NOT FOUND'}`);
  console.log(`npm: ${prereqs.npm ? '✓' : '✗'} ${prereqs.npmVersion || 'NOT FOUND'}\n`);

  if (!prereqs.node || !prereqs.npm) {
    console.error('='.repeat(70));
    console.error('ERROR: Missing required prerequisites!\n');

    if (!prereqs.node) {
      console.error('  - Node.js is not installed');
    }
    if (!prereqs.npm) {
      console.error('  - npm is not installed');
    }

    console.error('\n' + '='.repeat(70));
    console.error(getNodeInstallationInstructions(platform, linuxDistro));
    console.error('='.repeat(70) + '\n');

    console.error('After installing Node.js and npm, please run this script again:');
    console.error('  npm run update-app\n');

    process.exit(1);
  }

  // Check if using nvm
  if (!versions.usingNvm) {
    console.log('='.repeat(70));
    console.log('NOTE: Node.js is not managed by nvm');
    console.log(`  Current: ${versions.nodeVersion}`);
    console.log('='.repeat(70));
    console.log('\nSetting up nvm for better Node.js version management...\n');

    // Check if nvm was already installed before running setup
    const existingNvmPaths = getNvmPaths();
    const nvmWasAlreadyInstalled = existingNvmPaths !== null;
    const nvmScript = existingNvmPaths?.nvmScript || '';
    const nodeVersionWasAlreadyGood = versions.nodeOk;

    // Auto-setup nvm
    const setupSuccess = setupNvmAndNode();
    if (setupSuccess) {
      console.log('\n✓ nvm and Node.js setup complete!');

      // Skip re-exec if Node version was already good (no nvm changes needed)
      // Only try to re-exec if nvm was already installed AND we actually installed new Node
      if (nvmWasAlreadyInstalled && !nodeVersionWasAlreadyGood && nvmScript && fs.existsSync(nvmScript)) {
        try {
          // Install latest LTS and set as default
          execSync(
            `bash -c "unset npm_config_prefix && source ${nvmScript} && nvm install lts/* && nvm alias default lts/*"`,
            { encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] }
          );

          const newNodePath = execSync(
            `bash -c "unset npm_config_prefix && source ${nvmScript} && nvm which default"`,
            { encoding: 'utf8' }
          ).trim();

          if (newNodePath && fs.existsSync(newNodePath)) {
            console.log('Re-running script with new Node.js version...\n');
            console.log(`Using: ${newNodePath}`);

            const { spawnSync } = require('child_process');
            const scriptPath = path.resolve(__filename);

            const result = spawnSync(newNodePath, [scriptPath, '--reexec'], {
              stdio: 'inherit',
              env: { ...process.env }
            });

            process.exit(result.status);
          }
        } catch (e) {
          console.warn('Could not get new Node.js path:', e.message);
        }
      }

      if (!nvmWasAlreadyInstalled) {
        console.log('\n⚠ nvm was just installed');
        console.log('Please restart your terminal and run the update script again.\n');
        process.exit(0);
      } else if (nodeVersionWasAlreadyGood) {
        // Node version was already good, no need to restart
        console.log('\n✓ Proceeding with current Node.js version.\n');
        // Continue with the rest of the update process
      } else {
        console.log('\n⚠ Could not re-exec with new Node.js');
        console.log('Please restart your terminal and run the update script again.\n');
        process.exit(0);
      }
    } else {
      console.log('\n⚠ nvm setup was not successful');
      console.log('Proceeding with system Node.js (may have compatibility issues)...\n');
    }
  } else {
    console.log('✓ Node.js is managed by nvm');

    // Check for and install latest LTS update
    const nvmDir = path.join(os.homedir(), '.nvm');
    const nvmScript = path.join(nvmDir, 'nvm.sh');

    if (fs.existsSync(nvmScript)) {
      try {
        console.log('Checking for Node.js LTS updates...');

        // Get current nvm Node version
        const currentNodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();

        // Install latest LTS and set as default (nvm will skip if already latest)
        const installOutput = execSync(
          `bash -c "source ${nvmScript} && nvm install lts/* 2>&1"`,
          { encoding: 'utf8' }
        );

        // Set as default
        execSync(
          `bash -c "source ${nvmScript} && nvm alias default lts/*"`,
          { encoding: 'utf8' }
        );

        // Get the new version after install
        const newNodePath = execSync(
          `bash -c "source ${nvmScript} && nvm which default"`,
          { encoding: 'utf8' }
        ).trim();

        if (newNodePath && fs.existsSync(newNodePath)) {
          const newNodeVersion = execSync(`${newNodePath} --version`, { encoding: 'utf8' }).trim();

          // Check if version changed
          if (currentNodeVersion !== newNodeVersion && !process.execPath.includes(newNodeVersion)) {
            console.log(`✓ Node.js update available: ${currentNodeVersion} → ${newNodeVersion}`);
            console.log('Re-running script with updated Node.js version...\n');
            console.log(`Using: ${newNodePath}`);

            const { spawnSync } = require('child_process');
            const scriptPath = path.resolve(__filename);

            const result = spawnSync(newNodePath, [scriptPath, '--reexec'], {
              stdio: 'inherit',
              env: { ...process.env }
            });

            process.exit(result.status);
          } else {
            console.log(`✓ Node.js is up to date (${currentNodeVersion})`);
          }
        }
      } catch (e) {
        console.warn('Could not check for Node.js updates:', e.message);
      }
    }

    console.log('✓ All prerequisites met!\n');
  }
}

// Run prerequisite check
validatePrerequisites();

// Skip nvm check if re-executed
if (process.argv.includes('--reexec') || process.env.CANDYCODE_REEXEC === '1') {
  console.log(`✓ Running with Node.js ${process.version}\n`);
}

// =============================================================================
// NVM (Node Version Manager) Setup
// Cross-platform Node.js version management
// =============================================================================

/**
 * Check if nvm is installed (Linux/macOS)
 * @returns {boolean} True if nvm is available
 */
function isNvmInstalled() {
  try {
    // Check both standard locations: ~/.nvm and ~/.config/nvm
    const possibleNvmDirs = [
      path.join(os.homedir(), '.nvm'),
      path.join(os.homedir(), '.config', 'nvm')
    ];
    
    for (const nvmDir of possibleNvmDirs) {
      const nvmScript = path.join(nvmDir, 'nvm.sh');
      if (fs.existsSync(nvmScript)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Get nvm directory and script path
 * @returns {{nvmDir: string, nvmScript: string}|null} nvm directory and script path, or null if not found
 */
function getNvmPaths() {
  try {
    // Check both standard locations: ~/.nvm and ~/.config/nvm
    const possibleNvmDirs = [
      path.join(os.homedir(), '.nvm'),
      path.join(os.homedir(), '.config', 'nvm')
    ];
    
    for (const nvmDir of possibleNvmDirs) {
      const nvmScript = path.join(nvmDir, 'nvm.sh');
      if (fs.existsSync(nvmScript)) {
        return { nvmDir, nvmScript };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if nvm-windows is installed
 * @returns {boolean} True if nvm-windows is available
 */
function isNvmWindowsInstalled() {
  try {
    const nvmHome = process.env.NVM_HOME;
    return !!(nvmHome && fs.existsSync(path.join(nvmHome, 'nvm.exe')));
  } catch (error) {
    return false;
  }
}

/**
 * Get the Node.js version required from package.json
 * @returns {string} Required Node.js version (e.g., '22.12.0')
 */
function getRequiredNodeVersion() {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const engineVersion = packageJson.engines?.node || '>=22.12.0';
    const match = engineVersion.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : '22.12.0';
  } catch (error) {
    return '22.12.0';
  }
}

/**
 * Install nvm on Linux/macOS
 */
function installNvmUnix() {
  console.log('Installing nvm (Node Version Manager)...');

  try {
    const nvmInstallScript = `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | bash`;
    console.log('Running nvm installer...');
    execSync(nvmInstallScript, { stdio: 'inherit', timeout: 120000 });

    const nvmDir = path.join(os.homedir(), '.nvm');
    const nvmScript = path.join(nvmDir, 'nvm.sh');

    if (fs.existsSync(nvmScript)) {
      console.log('✓ nvm installed successfully');
      return true;
    }

    console.error('✗ nvm installation may have failed - script not found');
    return false;
  } catch (error) {
    console.error('✗ Failed to install nvm:', error.message);
    return false;
  }
}

/**
 * Install nvm-windows
 */
function installNvmWindows() {
  console.log('Installing nvm-windows...');

  try {
    console.log('Downloading nvm-windows installer...');

    const nvmWindowsUrl = `https://github.com/coreybutler/nvm-windows/releases/download/${NVM_WINDOWS_VERSION}/nvm-setup.exe`;
    const tempDir = os.tmpdir();
    const installerPath = path.join(tempDir, 'nvm-setup.exe');

    const downloadCommand = `powershell -Command "Invoke-WebRequest -Uri '${nvmWindowsUrl}' -OutFile '${installerPath}'"`;
    execSync(downloadCommand, { stdio: 'pipe', timeout: 120000 });

    console.log('Running nvm-windows installer (silent)...');
    execSync(`"${installerPath}" /SILENT`, { stdio: 'inherit', timeout: 60000 });

    try {
      fs.unlinkSync(installerPath);
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log('✓ nvm-windows installed successfully');
    console.log('NOTE: Please restart your terminal for nvm-windows to take effect');
    return true;
  } catch (error) {
    console.error('✗ Failed to install nvm-windows:', error.message);
    console.log('You can manually install from: https://github.com/coreybutler/nvm-windows/releases');
    return false;
  }
}

/**
 * Install Node.js using nvm (Linux/macOS)
 * @param {string} version - Node.js version to install
 */
function installNodeWithNvmUnix(version) {
  try {
    let nvmPaths = getNvmPaths();
    
    if (!nvmPaths) {
      console.error('nvm not found, attempting to install...');
      if (!installNvmUnix()) {
        return false;
      }
      nvmPaths = getNvmPaths();
    }
    
    if (!nvmPaths) {
      console.error('nvm still not found after installation attempt');
      return false;
    }

    console.log(`Installing Node.js ${version} using nvm...`);

    // Unset npm_config_prefix and use --delete-prefix to handle npm config conflicts
    const installCommand = `bash -c "unset npm_config_prefix NVM_NODEJS_ORG_MIRROR && source ${nvmPaths.nvmScript} && nvm use --delete-prefix ${version} || nvm install ${version} && nvm use --delete-prefix ${version}"`;
    const result = execSync(installCommand, { stdio: ['pipe', 'inherit', 'inherit'], timeout: 300000, encoding: 'utf8' });

    console.log('✓ Node.js ready via nvm');
    return true;
  } catch (error) {
    // Check if it's just a warning but nvm still worked
    if (error.message.includes('already installed') || error.message.includes('default alias')) {
      console.log('✓ Node.js ready via nvm');
      return true;
    }
    console.error('✗ Failed to install Node.js via nvm:', error.message);
    return false;
  }
}

/**
 * Install Node.js using nvm-windows
 * @param {string} version - Node.js version to install
 */
function installNodeWithNvmWindows(version) {
  try {
    if (!isNvmWindowsInstalled()) {
      console.log('nvm-windows not found, attempting to install...');
      if (!installNvmWindows()) {
        return false;
      }
      console.log('Please restart your terminal and run the update script again');
      return false;
    }

    console.log(`Installing Node.js ${version} using nvm-windows...`);

    execSync(`nvm install ${version}`, { stdio: 'inherit', timeout: 300000 });
    execSync(`nvm use ${version}`, { stdio: 'inherit', timeout: 60000 });

    console.log('✓ Node.js installed successfully via nvm-windows');
    return true;
  } catch (error) {
    console.error('✗ Failed to install Node.js via nvm-windows:', error.message);
    return false;
  }
}

/**
 * Setup nvm and Node.js if needed
 * @returns {boolean} True if setup was successful or not needed
 */
function setupNvmAndNode() {
  const platform = process.platform;
  const versions = checkVersions();

  // Get required Node.js version from package.json
  const requiredVersion = getRequiredNodeVersion();

  // If current Node.js version is already good, skip nvm setup
  // This avoids conflicts with user's npm configuration
  if (versions.nodeOk && versions.usingNvm) {
    console.log('✓ Node.js version meets requirements and is managed by nvm');
    return true;
  }
  
  if (versions.nodeOk && !versions.usingNvm) {
    console.log('✓ Node.js version meets requirements (system Node.js)');
    console.log('  Note: Consider using nvm for better version management');
    return true;
  }

  // Only install nvm if Node.js version is insufficient
  console.log('\n' + '='.repeat(70));
  console.log('Node.js version update required');
  console.log(`  Current: ${versions.nodeVersion}`);
  console.log(`  Required: ${requiredVersion}`);
  console.log('='.repeat(70) + '\n');

  if (platform === 'win32') {
    return setupNvmWindows(requiredVersion);
  } else {
    return setupNvmUnix(requiredVersion);
  }
}

/**
 * Setup nvm and Node.js on Linux/macOS
 * @param {string} requiredVersion - Required Node.js version
 */
function setupNvmUnix(requiredVersion) {
  try {
    if (!isNvmInstalled()) {
      console.log('nvm is not installed. Setting up nvm...');

      if (!installNvmUnix()) {
        console.error('Failed to install nvm');
        console.error('Please install Node.js manually from https://nodejs.org/');
        return false;
      }

      console.log('nvm installed. Installing Node.js...');
    } else {
      console.log('nvm is already installed');
    }

    if (!installNodeWithNvmUnix(requiredVersion)) {
      console.error('Failed to install Node.js via nvm');
      return false;
    }

    console.log('\n✓ Node.js setup complete!');
    console.log('NOTE: Please restart your terminal or run: source ~/.nvm/nvm.sh && nvm use default');
    return true;
  } catch (error) {
    console.error('Error setting up nvm:', error.message);
    return false;
  }
}

/**
 * Setup nvm and Node.js on Windows
 * @param {string} requiredVersion - Required Node.js version
 */
function setupNvmWindows(requiredVersion) {
  try {
    if (!isNvmWindowsInstalled()) {
      console.log('nvm-windows is not installed. Setting up nvm-windows...');

      if (!installNvmWindows()) {
        console.error('Failed to install nvm-windows');
        console.error('Please install Node.js manually from https://nodejs.org/');
        return false;
      }

      console.log('\nnvm-windows installed. Please restart your terminal and run the update script again.');
      return false;
    } else {
      console.log('nvm-windows is already installed');
    }

    if (!installNodeWithNvmWindows(requiredVersion)) {
      console.error('Failed to install Node.js via nvm-windows');
      return false;
    }

    console.log('\n✓ Node.js setup complete!');
    console.log('NOTE: Please restart your terminal for nvm-windows changes to take effect');
    return true;
  } catch (error) {
    console.error('Error setting up nvm-windows:', error.message);
    return false;
  }
}

// =============================================================================
// Windows Path Resolution Utilities
// Similar to install-qwen-code.sh approach for cross-platform path handling
// =============================================================================

/**
 * Convert Windows path to Unix-style path (for Git Bash/Cygwin)
 * @param {string} winPath - Windows path to convert
 * @returns {string} Unix-style path
 */
function winToUnixPath(winPath) {
  if (process.platform !== 'win32') return winPath;

  try {
    const result = execSync(`cygpath -u "${winPath}" 2>/dev/null`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return result || winPath;
  } catch (e) {
    let unixPath = winPath;
    unixPath = unixPath.replace(/^C:\\/i, '/c/');
    unixPath = unixPath.replace(/^([A-Z]):\\/i, '/$1/');
    unixPath = unixPath.replace(/\\/g, '/');
    return unixPath;
  }
}

/**
 * Convert Unix-style path to Windows path
 * @param {string} unixPath - Unix path to convert
 * @returns {string} Windows-style path
 */
function unixToWinPath(unixPath) {
  if (process.platform !== 'win32') return unixPath;

  try {
    const result = execSync(`cygpath -w "${unixPath}" 2>/dev/null`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return result || unixPath;
  } catch (e) {
    let winPath = unixPath;
    winPath = winPath.replace(/^\/([A-Z])\//i, '$1:\\');
    winPath = winPath.replace(/\//g, '\\');
    return winPath;
  }
}

/**
 * Execute command via cmd.exe with proper path handling
 * @param {string} command - Command to execute
 * @param {object} options - execSync options
 * @returns {string} Command output
 */
function execCmd(command, options = {}) {
  if (process.platform !== 'win32') {
    return execSync(command, options);
  }

  const cmdCommand = `cmd.exe //c "${command}"`;
  return execSync(cmdCommand, options);
}

/**
 * Get Windows environment variable with path conversion
 * @param {string} varName - Environment variable name
 * @param {boolean} toUnix - Convert to Unix path (default: true)
 * @returns {string|null} Environment variable value
 */
function getWinEnv(varName, toUnix = true) {
  if (process.platform !== 'win32') {
    return process.env[varName] || null;
  }

  const winValue = process.env[varName];
  if (!winValue) return null;

  return toUnix ? winToUnixPath(winValue) : winValue;
}

/**
 * Add path to Windows user PATH using setx
 * @param {string} pathToAdd - Path to add to Windows PATH
 * @returns {boolean} Success status
 */
function addToWindowsPath(pathToAdd) {
  if (process.platform !== 'win32') return false;

  try {
    const winPath = unixToWinPath(pathToAdd);
    const currentPath = process.env.PATH || '';

    if (currentPath.toLowerCase().includes(winPath.toLowerCase())) {
      console.log('Path already in Windows PATH');
      return true;
    }

    console.log(`Adding to Windows user PATH: ${winPath}`);
    execCmd(`setx PATH "${winPath};%PATH%"`);
    console.log('✓ Windows user PATH updated (effective in new terminals)');
    return true;
  } catch (error) {
    console.warn('Failed to update Windows PATH:', error.message);
    return false;
  }
}

// =============================================================================
// Dynamic Installation Directory Detection
// Uses multiple strategies to find the exact CandyCode installation directory
// =============================================================================

/**
 * Get the exact CandyCode installation directory using dynamic detection
 * This avoids hardcoded paths and works across different installation scenarios
 * 
 * @returns {string|null} The installation directory path or null if not found
 */
function getInstallationDirectory() {
  const strategies = [
    // Strategy 1: Use script's own location (most reliable for installed apps)
    () => {
      const scriptDir = path.resolve(__dirname, '..');
      if (isValidCandyCodeRoot(scriptDir)) {
        return scriptDir;
      }
      return null;
    },
    
    // Strategy 2: Check XDG standard locations (Linux)
    () => {
      if (process.platform === 'linux') {
        const xdgDataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
        const xdgLocations = [
          path.join(xdgDataHome, 'candycode'),
          path.join(xdgDataHome, 'CandyCode'),
          path.join(xdgDataHome, 'applications', 'candycode'),
        ];
        for (const loc of xdgLocations) {
          if (isValidCandyCodeRoot(loc)) {
            return loc;
          }
        }
      }
      return null;
    },
    
    // Strategy 3: Check standard application locations
    () => {
      const home = os.homedir();
      const standardLocations = [
        // Linux
        path.join(home, '.local', 'opt', 'CandyCode'),
        path.join(home, '.local', 'lib', 'candycode'),
        path.join(home, '.opt', 'CandyCode'),
        path.join('/opt', 'CandyCode'),
        path.join('/usr', 'local', 'opt', 'CandyCode'),
        path.join('/usr', 'share', 'candycode'),
        // macOS
        path.join(home, 'Applications', 'CandyCode'),
        path.join('/Applications', 'CandyCode.app', 'Contents', 'Resources', 'app'),
        path.join('/Applications', 'CandyCode.app', 'Contents', 'app'),
        // Windows
        path.join(process.env.LOCALAPPDATA || home, 'Programs', 'CandyCode'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'CandyCode'),
      ];
      
      for (const loc of standardLocations) {
        if (isValidCandyCodeRoot(loc)) {
          return loc;
        }
      }
      return null;
    },
    
    // Strategy 4: Check common development locations
    () => {
      const home = os.homedir();
      const devLocations = [
        path.join(home, 'AgenticApp'),
        path.join(home, 'CandyCode'),
        path.join(home, 'Projects', 'CandyCode'),
        path.join(home, 'Development', 'CandyCode'),
        path.join(home, 'Code', 'CandyCode'),
      ];
      
      for (const loc of devLocations) {
        if (isValidCandyCodeRoot(loc)) {
          return loc;
        }
      }
      return null;
    },
    
    // Strategy 5: Use process.argv to find the script location
    () => {
      if (process.argv[1]) {
        const scriptPath = path.resolve(process.argv[1]);
        const scriptDir = path.dirname(scriptPath);
        // Check current directory and parent directories
        const dirsToCheck = [
          scriptDir,
          path.dirname(scriptDir),
          path.dirname(path.dirname(scriptDir)),
        ];
        for (const dir of dirsToCheck) {
          if (isValidCandyCodeRoot(dir)) {
            return dir;
          }
        }
      }
      return null;
    },
    
    // Strategy 6: Search using environment variables
    () => {
      const envVars = ['CANDYCODE_HOME', 'CANDYCODE_ROOT', 'CANDYCODE_DIR'];
      for (const envVar of envVars) {
        const envPath = process.env[envVar];
        if (envPath && isValidCandyCodeRoot(envPath)) {
          return envPath;
        }
      }
      return null;
    },
  ];
  
  // Execute strategies in order until one succeeds
  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result) {
        console.log(`[InstallDir] Found via ${strategy.name || 'anonymous'}: ${result}`);
        return result;
      }
    } catch (error) {
      // Continue to next strategy on error
    }
  }
  
  console.warn('[InstallDir] Could not determine installation directory');
  return null;
}

/**
 * Validate if a directory is a valid CandyCode installation root
 * @param {string} dirPath - Directory path to validate
 * @returns {boolean} True if valid CandyCode root
 */
function isValidCandyCodeRoot(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return false;
    }
    
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return false;
    }
    
    // Check for key CandyCode files
    const requiredFiles = ['package.json'];
    for (const file of requiredFiles) {
      const filePath = path.join(dirPath, file);
      if (!fs.existsSync(filePath)) {
        return false;
      }
    }
    
    // Verify package.json contains candycode
    const packageJsonPath = path.join(dirPath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const isCandyCode = 
      packageJson.name === 'candycode' ||
      packageJson.productName === 'CandyCode' ||
      (packageJson.description && packageJson.description.toLowerCase().includes('candycode'));
    
    return isCandyCode;
  } catch (error) {
    return false;
  }
}

// Determine the OS
const platform = process.platform;

// Get the installation directory dynamically
const INSTALL_DIR = getInstallationDirectory();

if (!INSTALL_DIR) {
  console.error('ERROR: Could not determine CandyCode installation directory.');
  console.error('Please ensure CandyCode is properly installed.');
  process.exit(1);
}

console.log(`[InstallDir] Using installation directory: ${INSTALL_DIR}`);

console.log('Updating CandyCode application...');

try {
  // Backup user settings before updating
  backupUserSettings();
  
  // Install dependencies
  console.log('Installing/updating dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Build the application
  console.log('Building the application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Package the application
  console.log('Packaging the application...');
  if (platform === 'linux') {
    // Try to build AppImage first (should work on most systems)
    try {
      execSync('electron-builder --linux AppImage', { stdio: 'inherit' });
      console.log('AppImage built successfully');
    } catch (error) {
      console.warn('AppImage build failed:', error.message);
    }
    
    // Try to build deb package - Commented out as requested due to timeout/beta feature issues
    /*
    try {
      execSync('electron-builder --linux deb', { stdio: 'inherit' });
      console.log('Debian package built successfully');
    } catch (error) {
      console.warn('Debian package build failed:', error.message);
    }
    */
    
  } else if (platform === 'darwin') {
    execSync('npm run package:mac', { stdio: 'inherit' });
  } else if (platform === 'win32') {
    execSync('npm run package:win', { stdio: 'inherit' });
  }
  
  // Restore user settings after update
  restoreUserSettings();

  // Set up or verify command after update
  setupCommandAfterUpdate();

  // Set up system tray icons for cross-platform tray functionality
  setupSystemTrayIcons();

  console.log('\n==============================================');
  console.log('CandyCode update completed successfully!');
  console.log('Please RESTART the application to see changes.');
  if (platform === 'linux') {
    console.log('The new version is available in the release/ folder.');
  }
  console.log('==============================================\n');
} catch (error) {
  console.error('Update failed:', error.message);
  process.exit(1);
}

function backupUserSettings() {
  console.log('Backing up user settings...');
  
  try {
    // For electron apps, we need to get the user data path
    const appDataPath = path.join(require('os').homedir(), '.config', 'CandyCode');
    
    // Try to get the actual Electron userData path if available
    let userDataPath = appDataPath;
    const possiblePaths = [
      path.join(require('os').homedir(), '.config', 'CandyCode'), // Linux
      path.join(require('os').homedir(), 'Library', 'Application Support', 'CandyCode'), // macOS
      path.join(process.env.APPDATA || require('os').homedir(), 'CandyCode'), // Windows
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        userDataPath = p;
        break;
      }
    }
    
    if (fs.existsSync(userDataPath)) {
      const backupPath = path.join(require('os').homedir(), '.candycode-backup');
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }
      
      // Copy settings and other important user data
      const filesToBackup = [
        'candycode-storage',
        'last-opened-project.json',
        'ollama-active-model.json',
        'Settings',
        'Preferences',
        'config.json'
      ];
      
      for (const file of filesToBackup) {
        const sourcePath = path.join(userDataPath, file);
        const destPath = path.join(backupPath, file);
        
        if (fs.existsSync(sourcePath)) {
          if (fs.lstatSync(sourcePath).isDirectory()) {
            copyDir(sourcePath, destPath);
          } else {
            fs.copyFileSync(sourcePath, destPath);
          }
          console.log(`Backed up: ${file}`);
        }
      }
    }
  } catch (error) {
    console.warn('Could not backup user settings:', error.message);
  }
}

function restoreUserSettings() {
  console.log('Restoring user settings...');

  try {
    // For electron apps, we need to get the user data path
    const appDataPath = path.join(require('os').homedir(), '.config', 'CandyCode');

    // Try to get the actual Electron userData path if available
    let userDataPath = appDataPath;
    const possiblePaths = [
      path.join(require('os').homedir(), '.config', 'CandyCode'), // Linux
      path.join(require('os').homedir(), 'Library', 'Application Support', 'CandyCode'), // macOS
      path.join(process.env.APPDATA || require('os').homedir(), 'CandyCode'), // Windows
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        userDataPath = p;
        break;
      }
    }

    const backupPath = path.join(require('os').homedir(), '.candycode-backup');
    if (fs.existsSync(backupPath)) {
      // Restore settings and other important user data
      const filesToRestore = [
        'candycode-storage',
        'last-opened-project.json',
        'ollama-active-model.json',
        'Settings',
        'Preferences',
        'config.json'
      ];

      for (const file of filesToRestore) {
        const sourcePath = path.join(backupPath, file);
        const destPath = path.join(userDataPath, file);

        if (fs.existsSync(sourcePath)) {
          if (fs.lstatSync(sourcePath).isDirectory()) {
            copyDir(sourcePath, destPath);
          } else {
            // Make sure the destination directory exists
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
              fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(sourcePath, destPath);
          }
          console.log(`Restored: ${file}`);
        }
      }
    }
  } catch (error) {
    console.warn('Could not restore user settings:', error.message);
  }
}

function setupCommandAfterUpdate() {
  console.log('Setting up or verifying CandyCode command after update...');

  switch (platform) {
    case 'linux':
      setupLinuxCommandAfterUpdate();
      break;
    case 'darwin': // macOS
      setupMacOSCommandAfterUpdate();
      break;
    case 'win32': // Windows
      setupWindowsCommandAfterUpdate();
      break;
    default:
      console.log(`Platform ${platform} not supported for command setup`);
  }
}

function setupLinuxCommandAfterUpdate() {
  console.log('Verifying CandyCode command for Linux...');

  try {
    // Create a bin directory in the user's home folder
    const binDir = path.join(os.homedir(), '.local', 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // Create or update the CandyCode command script using dynamic detection
    const commandPath = path.join(binDir, 'CandyCode');
    const scriptContent = `#!/bin/bash
# CandyCode launcher script
# Uses dynamic installation directory detection

# Get the installation directory using multiple strategies
get_install_dir() {
    # Strategy 1: Check environment variables first
    if [ -n "$CANDYCODE_HOME" ]; then
        echo "$CANDYCODE_HOME"
        return 0
    fi
    
    if [ -n "$CANDYCODE_ROOT" ]; then
        echo "$CANDYCODE_ROOT"
        return 0
    fi
    
    if [ -n "$CANDYCODE_DIR" ]; then
        echo "$CANDYCODE_DIR"
        return 0
    fi

    # Strategy 2: Check XDG standard locations (Linux)
    if [ "$(uname)" == "Linux" ]; then
        XDG_DATA_HOME="$HOME/.local/share"
        if [ -d "$XDG_DATA_HOME/candycode" ] && [ -f "$XDG_DATA_HOME/candycode/package.json" ]; then
            echo "$XDG_DATA_HOME/candycode"
            return 0
        fi
    fi

    # Strategy 3: Check standard application locations
    HOME_DIR="$HOME"
    POSSIBLE_ROOTS=(
        # Linux standard locations
        "$HOME_DIR/.local/opt/CandyCode"
        "$HOME_DIR/.local/lib/candycode"
        "$HOME_DIR/.opt/CandyCode"
        "/opt/CandyCode"
        "/usr/local/opt/CandyCode"
        "/usr/share/candycode"
        # macOS locations
        "$HOME_DIR/Applications/CandyCode"
        "/Applications/CandyCode.app/Contents/Resources/app"
        "/Applications/CandyCode.app/Contents/app"
        # Windows locations (for WSL)
        "$HOME_DIR/Programs/CandyCode"
        # Common development locations
        "$HOME_DIR/AgenticApp"
        "$HOME_DIR/CandyCode"
        "$HOME_DIR/Projects/CandyCode"
        "$HOME_DIR/Development/CandyCode"
        "$HOME_DIR/Code/CandyCode"
    )

    for root in "\${POSSIBLE_ROOTS[@]}"; do
        if [ -d "$root" ] && [ -f "$root/package.json" ]; then
            if grep -q '"name": "candycode"\\|"productName": "CandyCode"' "$root/package.json" 2>/dev/null; then
                echo "$root"
                return 0
            fi
        fi
    done

    # Strategy 4: Use script's own location
    SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")" && pwd)"
    PARENT_DIR="$(dirname "$SCRIPT_DIR")"
    if [ -d "$PARENT_DIR" ] && [ -f "$PARENT_DIR/package.json" ]; then
        if grep -q '"name": "candycode"\\|"productName": "CandyCode"' "$PARENT_DIR/package.json" 2>/dev/null; then
            echo "$PARENT_DIR"
            return 0
        fi
    fi

    # Strategy 5: Check current working directory
    if [ -f "$PWD/package.json" ] && grep -q '"name": "candycode"\\|"productName": "CandyCode"' "$PWD/package.json" 2>/dev/null; then
        echo "$PWD"
        return 0
    fi

    return 1
}

# Get the installation directory
INSTALL_DIR="$(get_install_dir)"

if [ -z "$INSTALL_DIR" ]; then
    echo "ERROR: Could not find CandyCode installation directory."
    echo "Please set CANDYCODE_HOME environment variable or ensure CandyCode is properly installed."
    exit 1
fi

cd "$INSTALL_DIR"

# Check if we have a packaged version in release directory
RELEASE_APP=""
if [ -d "$INSTALL_DIR/release" ]; then
    RELEASE_APP="$(find "$INSTALL_DIR/release" -maxdepth 1 -name "CandyCode-*.AppImage" 2>/dev/null | head -n 1)"
fi

if [ -n "$RELEASE_APP" ] && [ -f "$RELEASE_APP" ]; then
    # Use the packaged AppImage
    exec "$RELEASE_APP" "$@"
else
    # Run from project directory
    if command -v electron >/dev/null 2>&1; then
        # Use installed electron
        exec electron . "$@"
    else
        # Use npx to run electron
        exec npx --no-install electron . "$@"
    fi
fi
`;

    fs.writeFileSync(commandPath, scriptContent);
    fs.chmodSync(commandPath, '755'); // Make executable

    // Add ~/.local/bin to PATH if not already present
    addToPathIfNotPresent(binDir);

    console.log('CandyCode command verified/updated at ~/.local/bin/CandyCode');
  } catch (error) {
    console.warn('Could not set up CandyCode command for Linux:', error.message);
  }
}

function setupMacOSCommandAfterUpdate() {
  console.log('Verifying CandyCode command for macOS...');

  try {
    // Create a bin directory in the user's home folder
    const binDir = path.join(os.homedir(), 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // Create or update the CandyCode command script using dynamic detection
    const commandPath = path.join(binDir, 'CandyCode');
    const scriptContent = `#!/bin/bash
# CandyCode launcher script for macOS
# Uses dynamic installation directory detection

# Get the installation directory using multiple strategies
get_install_dir() {
    # Strategy 1: Check environment variables first
    if [ -n "$CANDYCODE_HOME" ]; then
        echo "$CANDYCODE_HOME"
        return 0
    fi
    
    if [ -n "$CANDYCODE_ROOT" ]; then
        echo "$CANDYCODE_ROOT"
        return 0
    fi
    
    if [ -n "$CANDYCODE_DIR" ]; then
        echo "$CANDYCODE_DIR"
        return 0
    fi

    # Strategy 2: Check packaged app in Applications
    if [ -d "/Applications/CandyCode.app" ]; then
        # Check if it's a valid CandyCode app
        if [ -f "/Applications/CandyCode.app/Contents/Resources/app/package.json" ]; then
            echo "/Applications/CandyCode.app/Contents/Resources/app"
            return 0
        elif [ -f "/Applications/CandyCode.app/Contents/app/package.json" ]; then
            echo "/Applications/CandyCode.app/Contents/app"
            return 0
        fi
    fi

    # Strategy 3: Check standard application locations
    HOME_DIR="$HOME"
    POSSIBLE_ROOTS=(
        "$HOME_DIR/Applications/CandyCode"
        "$HOME_DIR/Applications/CandyCode.app/Contents/Resources/app"
        "$HOME_DIR/Applications/CandyCode.app/Contents/app"
        "/opt/CandyCode"
        # Common development locations
        "$HOME_DIR/AgenticApp"
        "$HOME_DIR/CandyCode"
        "$HOME_DIR/Projects/CandyCode"
        "$HOME_DIR/Development/CandyCode"
        "$HOME_DIR/Code/CandyCode"
    )

    for root in "\${POSSIBLE_ROOTS[@]}"; do
        if [ -d "$root" ] && [ -f "$root/package.json" ]; then
            if grep -q '"name": "candycode"\\|"productName": "CandyCode"' "$root/package.json" 2>/dev/null; then
                echo "$root"
                return 0
            fi
        fi
    done

    # Strategy 4: Use script's own location
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    PARENT_DIR="$(dirname "$SCRIPT_DIR")"
    if [ -d "$PARENT_DIR" ] && [ -f "$PARENT_DIR/package.json" ]; then
        if grep -q '"name": "candycode"\\|"productName": "CandyCode"' "$PARENT_DIR/package.json" 2>/dev/null; then
            echo "$PARENT_DIR"
            return 0
        fi
    fi

    # Strategy 5: Check current working directory
    if [ -f "$PWD/package.json" ] && grep -q '"name": "candycode"\\|"productName": "CandyCode"' "$PWD/package.json" 2>/dev/null; then
        echo "$PWD"
        return 0
    fi

    return 1
}

# Get the installation directory
INSTALL_DIR="$(get_install_dir)"

if [ -z "$INSTALL_DIR" ]; then
    echo "ERROR: Could not find CandyCode installation directory."
    echo "Please set CANDYCODE_HOME environment variable or ensure CandyCode is properly installed."
    exit 1
fi

# Check if we have a packaged app in Applications
if [ -d "/Applications/CandyCode.app" ]; then
    # Use the packaged app
    exec open -a "/Applications/CandyCode.app" "$@"
fi

# Run from project directory
cd "$INSTALL_DIR"
if command -v electron >/dev/null 2>&1; then
    # Use installed electron
    exec electron . "$@"
else
    # Use npx to run electron
    exec npx --no-install electron . "$@"
fi
`;

    fs.writeFileSync(commandPath, scriptContent);
    fs.chmodSync(commandPath, '755'); // Make executable

    // Add ~/bin to PATH if not already present
    addToPathIfNotPresent(binDir);

    console.log('CandyCode command verified/updated at ~/bin/CandyCode');
  } catch (error) {
    console.warn('Could not set up CandyCode command for macOS:', error.message);
  }
}

function setupWindowsCommandAfterUpdate() {
  console.log('Verifying CandyCode command for Windows...');

  try {
    // On Windows, we'll create a batch file in a directory that's likely in PATH
    // Or suggest adding the project directory to PATH
    const projectDir = path.join(__dirname, '..');
    const commandPath = path.join(projectDir, 'CandyCode.bat');

    const scriptContent = `@echo off
REM CandyCode launcher script

set PROJECT_DIR=%~dp0

REM Check if we have a packaged version in release directory
for /f "delims=" %%i in ('dir "%PROJECT_DIR%\\release\\CandyCode*.exe" /b 2^>nul') do (
    set RELEASE_APP="%PROJECT_DIR%\\release\\%%i"
)

if defined RELEASE_APP (
    REM Use the packaged executable
    start "" %RELEASE_APP%
) else (
    REM Use npx to run electron from project directory
    cd /d "%PROJECT_DIR%"
    npx --no-install electron . %*
)
`;
    
    fs.writeFileSync(commandPath, scriptContent);
    
    console.log('CandyCode command verified/updated at project directory as CandyCode.bat');
    console.log('Note: You may need to add the project directory to your PATH environment variable to use the command globally.');
  } catch (error) {
    console.warn('Could not set up CandyCode command for Windows:', error.message);
  }
}

function addToPathIfNotPresent(binDir) {
  try {
    // Check if the bin directory is already in PATH
    const currentPath = process.env.PATH || '';
    if (currentPath.includes(binDir)) {
      return; // Already in PATH
    }

    // Add to shell profile files
    const shellProfiles = [
      path.join(require('os').homedir(), '.bashrc'),
      path.join(require('os').homedir(), '.zshrc'),
      path.join(require('os').homedir(), '.profile'),
      path.join(require('os').homedir(), '.bash_profile')
    ];

    const pathExport = `export PATH="$PATH:${binDir}"`;
    
    for (const profile of shellProfiles) {
      if (fs.existsSync(profile)) {
        const content = fs.readFileSync(profile, 'utf8');
        if (!content.includes(binDir)) {
          fs.appendFileSync(profile, `\n${pathExport}\n`);
          console.log(`Added ${binDir} to ${profile}`);
        }
      }
    }
  } catch (error) {
    console.warn('Could not add to PATH:', error.message);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src);

  for (const entry of entries) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// =============================================================================
// System Tray Icon Setup for Updates
// Prepares icons for cross-platform system tray functionality during updates
// =============================================================================

function setupSystemTrayIcons() {
  console.log('Setting up system tray icons...');

  const assetsDir = path.join(__dirname, '..');
  const sourceIcon = path.join(assetsDir, 'assets', 'icon.png');

  if (!fs.existsSync(sourceIcon)) {
    console.warn('[TrayIcons] Source icon not found at:', sourceIcon);
    return;
  }

  switch (platform) {
    case 'linux':
      setupLinuxTrayIcons(sourceIcon, assetsDir);
      break;
    case 'darwin':
      setupMacOSTrayIcons(sourceIcon, assetsDir);
      break;
    case 'win32':
      setupWindowsTrayIcons(sourceIcon, assetsDir);
      break;
    default:
      console.log(`[TrayIcons] Platform ${platform} not supported for tray icon setup`);
  }

  console.log('System tray icons setup completed.');
}

function setupLinuxTrayIcons(sourceIcon, assetsDir) {
  try {
    // For Linux, we need PNG icons in various sizes for the system tray
    const trayIconSizes = [16, 22, 24, 32, 48];
    
    // Create tray icon directory
    const trayIconDir = path.join(assetsDir, 'assets', 'tray');
    if (!fs.existsSync(trayIconDir)) {
      fs.mkdirSync(trayIconDir, { recursive: true });
    }

    // Try to use ImageMagick if available
    let usedImageMagick = false;
    try {
      execSync('which magick', { stdio: 'pipe' });
      usedImageMagick = true;
      
      for (const size of trayIconSizes) {
        const destPath = path.join(trayIconDir, `icon-${size}.png`);
        execSync(`magick "${sourceIcon}" -resize ${size}x${size} "${destPath}"`, { stdio: 'pipe' });
      }
      console.log('[TrayIcons] Linux tray icons created using ImageMagick');
    } catch (e) {
      // ImageMagick not available, copy original icon as fallback
      console.log('[TrayIcons] ImageMagick not available, using fallback method');
      const destPath = path.join(trayIconDir, 'icon-24.png');
      fs.copyFileSync(sourceIcon, destPath);
      console.log('[TrayIcons] Copied original icon as fallback');
    }

    // Also ensure the main icon.png is available for tray use
    const mainTrayIcon = path.join(trayIconDir, 'icon.png');
    if (!fs.existsSync(mainTrayIcon)) {
      fs.copyFileSync(sourceIcon, mainTrayIcon);
    }
  } catch (error) {
    console.warn('[TrayIcons] Could not set up Linux tray icons:', error.message);
  }
}

function setupMacOSTrayIcons(sourceIcon, assetsDir) {
  try {
    // For macOS, we need a template PNG (black on transparent) for the tray
    // The template image should be 18x18 or 22x22 for Retina displays
    const trayIconDir = path.join(assetsDir, 'assets', 'tray');
    if (!fs.existsSync(trayIconDir)) {
      fs.mkdirSync(trayIconDir, { recursive: true });
    }

    // Create template icon for tray (smaller size for menu bar)
    try {
      execSync('which magick', { stdio: 'pipe' });
      
      // Create standard and Retina versions
      const sizes = [18, 22]; // 18pt and 22pt for Retina
      for (const size of sizes) {
        const destPath = path.join(trayIconDir, `iconTemplate@${size === 22 ? '2x' : '1x'}.png`);
        // Convert to grayscale and resize for tray
        execSync(`magick "${sourceIcon}" -resize ${size}x${size} -colorspace Gray -alpha on "${destPath}"`, { stdio: 'pipe' });
      }
      console.log('[TrayIcons] macOS tray icons created using ImageMagick');
    } catch (e) {
      // ImageMagick not available, copy original icon as fallback
      console.log('[TrayIcons] ImageMagick not available, using fallback method');
      const destPath = path.join(trayIconDir, 'iconTemplate.png');
      fs.copyFileSync(sourceIcon, destPath);
      console.log('[TrayIcons] Copied original icon as fallback');
    }

    // Also ensure the main icon.png is available
    const mainIcon = path.join(trayIconDir, 'icon.png');
    if (!fs.existsSync(mainIcon)) {
      fs.copyFileSync(sourceIcon, mainIcon);
    }
  } catch (error) {
    console.warn('[TrayIcons] Could not set up macOS tray icons:', error.message);
  }
}

function setupWindowsTrayIcons(sourceIcon, assetsDir) {
  try {
    // For Windows, we need an ICO file with multiple sizes
    const trayIconDir = path.join(assetsDir, 'assets', 'tray');
    if (!fs.existsSync(trayIconDir)) {
      fs.mkdirSync(trayIconDir, { recursive: true });
    }

    // Create ICO file for tray
    try {
      execSync('which magick', { stdio: 'pipe' });
      
      const icoPath = path.join(trayIconDir, 'icon.ico');
      execSync(`magick "${sourceIcon}" -define icon:auto-resize=16,24,32,48 "${icoPath}"`, { stdio: 'pipe' });
      console.log('[TrayIcons] Windows tray icon (ICO) created using ImageMagick');
    } catch (e) {
      // ImageMagick not available, copy original icon as fallback
      console.log('[TrayIcons] ImageMagick not available, using fallback method');
      const destPath = path.join(trayIconDir, 'icon.png');
      fs.copyFileSync(sourceIcon, destPath);
      console.log('[TrayIcons] Copied original icon as fallback');
    }

    // Also ensure the main icon.png is available
    const mainIcon = path.join(trayIconDir, 'icon.png');
    if (!fs.existsSync(mainIcon)) {
      fs.copyFileSync(sourceIcon, mainIcon);
    }
  } catch (error) {
    console.warn('[TrayIcons] Could not set up Windows tray icons:', error.message);
  }
}

// Create or update Linux desktop entry for "Open With" support
function setupLinuxDesktopEntry() {
  if (process.platform !== 'linux') return;

  console.log('[Update] Setting up Linux desktop entry...');

  try {
    const desktopDir = path.join(os.homedir(), '.local/share/applications');
    if (!fs.existsSync(desktopDir)) {
      fs.mkdirSync(desktopDir, { recursive: true });
    }

    // Find the AppImage
    const packagedAppPath = path.join(__dirname, '..', 'release', 'CandyCode-*.AppImage');
    const releaseApps = glob.sync(packagedAppPath);
    const execPath = releaseApps.length > 0 ? `"${releaseApps[0]}"` : 'CandyCode';

    const desktopEntry = `[Desktop Entry]
Name=CandyCode
Comment=A futuristic AI-powered code editor and workspace with AI integration
Exec=${execPath} %F
Icon=candycode
Terminal=false
Type=Application
Categories=Development;IDE;TextEditor;
StartupNotify=true
StartupWMClass=CandyCode
MimeType=text/plain;text/x-c;text/x-c++;text/x-csrc;text/x-chdr;text/x-c++src;text/x-c++hdr;text/x-java;text/x-python;text/x-python3;application/javascript;application/json;text/html;text/css;text/x-typescript;text/x-tsx;application/x-shellscript;text/x-makefile;application/x-yaml;text/markdown;
`;

    const desktopFilePath = path.join(desktopDir, 'candycode.desktop');
    fs.writeFileSync(desktopFilePath, desktopEntry);
    execSync(`chmod +x "${desktopFilePath}"`);

    // Update desktop database
    try {
      execSync('update-desktop-database ~/.local/share/applications', { stdio: 'pipe' });
    } catch (e) {
      // Ignore errors
    }

    console.log('[Update] Linux desktop entry created/updated.');
  } catch (error) {
    console.warn('[Update] Could not set up desktop entry:', error.message);
  }
}

// Call desktop entry setup after tray icons
setupLinuxDesktopEntry();