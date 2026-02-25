#!/usr/bin/env node

/**
 * Generate SVG version of the app icon
 * Uses ImageMagick to convert PNG to SVG
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
const pngPath = path.join(assetsDir, 'icon.png');
const svgPath = path.join(assetsDir, 'icon.svg');

console.log('[IconGen] Generating SVG icon from PNG...');

// Check if PNG exists
if (!fs.existsSync(pngPath)) {
  console.error('ERROR: icon.png not found in assets directory');
  process.exit(1);
}

try {
  // Use ImageMagick to convert PNG to SVG
  execSync(`magick "${pngPath}" "${svgPath}"`, { stdio: 'pipe' });
  
  // Verify SVG was created
  if (fs.existsSync(svgPath)) {
    const stats = fs.statSync(svgPath);
    console.log(`✓ SVG icon created: ${svgPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
  } else {
    console.error('ERROR: Failed to create SVG icon');
    process.exit(1);
  }
} catch (error) {
  console.error('ERROR: ImageMagick conversion failed:', error.message);
  console.log('\nAlternative: Create SVG manually or use PNG directly');
  process.exit(1);
}

console.log('[IconGen] Done!');
