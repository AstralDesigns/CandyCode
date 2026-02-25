# ESLint Integration for CandyCode

## Overview

CandyCode now includes **native ESLint integration** that provides real-time linting diagnostics directly in the Monaco editor.

## Features

✅ **Real-time ESLint diagnostics** - Errors and warnings appear as you type
✅ **Monaco marker integration** - ESLint issues show in Problems panel
✅ **Debounced linting** - Runs 500ms after you stop typing (no performance impact)
✅ **Auto-detects JS/TS files** - Only lints `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
✅ **Uses your ESLint config** - Respects `.eslintrc`, `.eslintrc.js`, `.eslintrc.json`, etc.

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CandyCode (Electron)                     │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │ Monaco Editor │  │ ESLint IPC    │  │ Main Process    │ │
│  │ + Markers     │◄─┤ Handlers      │◄─┤ ESLint Service  │ │
│  └───────────────┘  └───────────────┘  └─────────────────┘ │
│         │                                      │            │
│         └──────────────────────────────────────┘            │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ ESLint (npm)    │
                    │ + Your Config   │
                    └─────────────────┘
```

### Flow

1. **User types in editor** → `onDidChangeModelContent` event fires
2. **Debounced (500ms)** → Prevents excessive linting
3. **IPC call to main process** → `eslint:lint-file`
4. **ESLint Service runs** → Uses your `.eslintrc` config
5. **Returns diagnostics** → Errors, warnings, info
6. **Monaco markers set** → Shows in editor with squiggles

## Installation

ESLint is already included in CandyCode's `package.json`:

```json
{
  "dependencies": {
    "eslint": "^8.57.0"
  },
  "devDependencies": {
    "@types/eslint": "^9.6.1"
  }
}
```

**During install** (`npm run install-app`):
- ✅ ESLint is installed automatically
- ✅ `@types/eslint` is installed for TypeScript support
- ✅ ESLint service is initialized

## Configuration

### Using Your Existing ESLint Config

ESLint automatically detects your configuration:

- `.eslintrc` (any format: `.js`, `.json`, `.yaml`)
- `eslint.config.js` (new flat config)
- `package.json` → `eslintConfig` field

**No additional setup required!** Just place your `.eslintrc` in your project root.

### Example `.eslintrc.js`

```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react', '@typescript-eslint'],
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'warn',
  },
};
```

## Usage

### Automatic Linting

ESLint runs automatically when:
- ✅ You open a JavaScript/TypeScript file
- ✅ You type in the editor (debounced by 500ms)
- ✅ You save a file

### Manual ESLint Actions

Coming soon:
- ⏳ `eslint:reload-config` - Reload ESLint configuration
- ⏳ `eslint:fix-all` - Auto-fix all fixable issues
- ⏳ `eslint:toggle` - Enable/disable ESLint

### Viewing ESLint Errors

ESLint errors appear as:
1. **Red/yellow squiggles** in the editor
2. **Problems panel** entries (View → Problems)
3. **Hover tooltips** showing the error message

**Error severity:**
- 🔴 **Error** (severity 2) - Red squiggles
- 🟡 **Warning** (severity 1) - Yellow squiggles
- 🔵 **Info** (severity 0) - Blue squiggles

## Files Linted

ESLint only lints these file types:
- `.js` - JavaScript
- `.jsx` - React JSX
- `.ts` - TypeScript
- `.tsx` - React TSX
- `.mjs` - ES Modules
- `.cjs` - CommonJS Modules

Other file types are ignored.

## Performance

**Debouncing:** ESLint runs 500ms after you stop typing
- No lag while typing
- No excessive CPU usage
- Only lints when you pause

**File size:** Large files (>1000 lines) may take 1-2 seconds
- Normal files (<500 lines): <500ms
- Small files (<100 lines): <100ms

## Troubleshooting

### ESLint Not Running

**Check:**
1. Open DevTools (Shift+F12)
2. Look for `[ESLint]` messages in console
3. Check if ESLint initialized successfully

**Common issues:**
- ❌ No `.eslintrc` file found → Create one
- ❌ ESLint not installed → Run `npm install`
- ❌ Wrong file type → Only JS/TS files are linted

### ESLint Errors Not Showing

**Check:**
1. Is the file a JS/TS file? (`.js`, `.ts`, `.jsx`, `.tsx`)
2. Does your `.eslintrc` have rules enabled?
3. Are there any ESLint configuration errors?

**Debug:**
```javascript
// In DevTools console
window.electronAPI.eslint.isEnabled()  // Should return true
```

### ESLint Configuration Errors

**Error:** `Failed to initialize ESLint`

**Causes:**
- Invalid `.eslintrc` syntax
- Missing ESLint plugins
- Parser not found

**Fix:**
1. Check `.eslintrc` syntax
2. Install missing plugins: `npm install eslint-plugin-react`
3. Install missing parsers: `npm install @typescript-eslint/parser`

## API Reference

### Main Process (Electron)

```typescript
// electron/services/eslint.service.ts

class ESLintService {
  // Lint a single file
  async lintFile(filePath: string, content: string): Promise<ESLintResult>
  
  // Lint multiple files
  async lintFiles(files: Array<{path, content}>): Promise<ESLintResult[]>
  
  // Enable/disable ESLint
  setEnabled(enabled: boolean): void
  
  // Check if enabled
  isEnabled(): boolean
  
  // Reload configuration
  async reloadConfig(): Promise<void>
}
```

### Renderer Process (React)

```typescript
// Available via window.electronAPI.eslint

window.electronAPI.eslint.lintFile(filePath, content)
window.electronAPI.eslint.lintFiles(files)
window.electronAPI.eslint.setEnabled(enabled)
window.electronAPI.eslint.isEnabled()
window.electronAPI.eslint.reloadConfig()
```

### IPC Handlers

```typescript
// electron/main.ts

ipcMain.handle('eslint:lint-file', async (_, filePath, content) => {...})
ipcMain.handle('eslint:lint-files', async (_, files) => {...})
ipcMain.handle('eslint:set-enabled', async (_, enabled) => {...})
ipcMain.handle('eslint:is-enabled', async () => {...})
ipcMain.handle('eslint:reload-config', async () => {...})
```

## Future Enhancements

Planned features:
- [ ] Settings toggle for ESLint (enable/disable)
- [ ] Auto-fix on save
- [ ] ESLint output panel
- [ ] Custom ESLint config path
- [ ] ESLint rule documentation on hover
- [ ] Quick fixes for common issues

## License

ESLint is open-source under the MIT License.

## References

- [ESLint Documentation](https://eslint.org/docs/)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)
- [Monaco Marker API](https://microsoft.github.io/monaco-editor/api/modules/monaco.editor.html#setModelMarkers)
