const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Determine the OS
const platform = process.platform;

console.log('Uninstalling CandyCode application...');

try {
  // Remove app icons based on the platform
  removeAppIcons();

  // Additional cleanup can be added here
  console.log('CandyCode uninstallation completed successfully!');
} catch (error) {
  console.error('Uninstallation failed:', error.message);
  process.exit(1);
}

function removeAppIcons() {
  console.log('Removing app icons...');

  switch (platform) {
    case 'linux':
      removeLinuxIcons();
      break;
    case 'darwin': // macOS
      removeMacOSIcons();
      break;
    case 'win32': // Windows
      removeWindowsIcons();
      break;
    default:
      console.log(`Platform ${platform} not supported for icon removal`);
  }
  
  // Clean up temporary public icon if it was created during install
  cleanupPublicIcon();
}

function cleanupPublicIcon() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const publicIconPath = path.join(__dirname, '..', 'public', 'icon.png');
    const assetsIconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    
    // Only remove public/icon.png if it's different from assets/icon.png (to avoid deleting the original)
    // Actually, we shouldn't remove the public icon as it's part of the project
    console.log('Note: Keeping public/icon.png as it is part of the project assets');
  } catch (error) {
    console.warn('Could not clean up public icon:', error.message);
  }
}

function removeLinuxIcons() {
  try {
    // Remove icon from system directories
    const iconDestinations = [
      path.join(process.env.HOME, '.local/share/icons/hicolor/256x256/apps/candycode.png'),
      '/usr/local/share/icons/hicolor/256x256/apps/candycode.png',
      '/usr/share/icons/hicolor/256x256/apps/candycode.png'
    ];

    for (const iconPath of iconDestinations) {
      if (fs.existsSync(iconPath)) {
        execSync(`rm -f "${iconPath}"`, { stdio: 'pipe' });
        console.log(`Icon removed from ${iconPath}`);
      }
    }

    // Remove desktop entry
    const desktopFilePath = path.join(process.env.HOME, '.local/share/applications/candycode.desktop');
    if (fs.existsSync(desktopFilePath)) {
      fs.unlinkSync(desktopFilePath);
      console.log('Desktop entry removed.');

      // Update desktop database
      try {
        execSync('update-desktop-database ~/.local/share/applications', { stdio: 'pipe' });
      } catch (e) {
        // This command might not be available on all systems, so we ignore errors
      }
    }

    console.log('Linux app icons and desktop entry removed.');
  } catch (error) {
    console.warn('Could not remove Linux icons:', error.message);
  }
}

function removeMacOSIcons() {
  try {
    // On macOS, the app is typically removed from Applications folder
    console.log('macOS icon removal - please manually remove CandyCode from Applications folder.');
  } catch (error) {
    console.warn('Could not remove macOS icons:', error.message);
  }
}

function removeWindowsIcons() {
  try {
    // On Windows, the app is typically removed from Programs and Features
    console.log('Windows icon removal - please use Add/Remove Programs to uninstall CandyCode.');
  } catch (error) {
    console.warn('Could not remove Windows icons:', error.message);
  }
}