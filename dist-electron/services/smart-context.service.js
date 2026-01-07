"use strict";
/**
 * Smart Context Service
 * Compressed context builder using hierarchical summarization.
 * Ported from CLI tinker.py SmartContext class
 */
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
exports.SmartContext = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class SmartContext {
    projectDir;
    compressionMode;
    maxContextFiles;
    tokenBudget;
    constructor(projectDir, compressionMode = 'smart', maxContextFiles = 100, tokenBudget = 1000000) {
        this.projectDir = projectDir;
        this.compressionMode = compressionMode;
        this.maxContextFiles = maxContextFiles;
        this.tokenBudget = tokenBudget;
    }
    estimateTokens(text) {
        return Math.floor(text.length / 4);
    }
    shouldIgnore(filePath) {
        const ignore = [
            '.git', 'node_modules', '__pycache__', '.venv', 'venv',
            'dist', 'build', 'target', '.next', 'coverage', '.idea',
            '.cache', '.pytest_cache', 'eggs', '*.egg-info', '.tox',
            'htmlcov', '.mypy_cache', '.ruff_cache', 'bower_components',
            'dist-electron', '.vscode', '.cursor'
        ];
        const relativePath = path.relative(this.projectDir, filePath);
        return ignore.some(pattern => relativePath.includes(pattern));
    }
    getRelevantFiles() {
        const extensions = [
            '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.go',
            '.rs', '.rb', '.php', '.sh', '.md', '.json', '.yaml', '.toml',
            '.html', '.css', '.dart', '.kt', '.swift', '.c', '.h', '.sql',
            '.vue', '.svelte', '.astro', '.prisma', '.graphql', '.proto'
        ];
        const files = [];
        const walkDir = async (dir) => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (this.shouldIgnore(fullPath))
                        continue;
                    if (entry.isDirectory()) {
                        await walkDir(fullPath);
                    }
                    else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (extensions.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            }
            catch (error) {
                // Ignore permission errors
            }
        };
        // Note: This is synchronous for now, but in practice we'd want async
        // For now, we'll use a simpler approach
        return files;
    }
    importance(filePath) {
        const name = path.basename(filePath).toLowerCase();
        // Entry points - highest priority
        if (['main.py', 'app.py', 'index.js', 'index.ts', 'main.rs', 'main.go', 'mod.rs'].includes(name))
            return 100;
        // Config files - very important
        if (['package.json', 'cargo.toml', 'pyproject.toml', 'go.mod', 'tsconfig.json'].includes(name))
            return 95;
        if (['next.config.js', 'vite.config.ts', 'webpack.config.js', 'tailwind.config.js'].includes(name))
            return 90;
        if (name.includes('readme'))
            return 85;
        if (name.includes('config') || name.includes('settings'))
            return 75;
        if (['.env.example', 'docker-compose.yml', 'dockerfile'].includes(name))
            return 70;
        // Schema/types
        if (name.includes('schema') || name.includes('types') || name.includes('interface'))
            return 65;
        if (name.includes('model') || name.includes('entity'))
            return 60;
        // Routes/API
        if (name.includes('route') || name.includes('api') || name.includes('handler'))
            return 55;
        // Components
        if (name.includes('component'))
            return 50;
        // Utils/helpers
        if (name.includes('util') || name.includes('helper') || name.includes('lib'))
            return 45;
        // Tests - lower priority
        if (name.includes('test') || name.includes('spec'))
            return 20;
        return 40;
    }
    extractCodeSignatures(content, fileExt) {
        const lines = content.split('\n');
        const signatures = [];
        let inDocstring = false;
        let docstringDelim = null;
        for (const line of lines) {
            const stripped = line.trim();
            // Track docstrings (Python)
            if (stripped.includes('"""') || stripped.includes("'''")) {
                const delim = stripped.includes('"""') ? '"""' : "'''";
                if (inDocstring) {
                    if (delim === docstringDelim) {
                        inDocstring = false;
                        continue;
                    }
                }
                else {
                    if (stripped.split(delim).length >= 3) {
                        signatures.push(line);
                        continue;
                    }
                    inDocstring = true;
                    docstringDelim = delim;
                    signatures.push(line);
                    continue;
                }
            }
            if (inDocstring) {
                if (signatures.length < 500) {
                    signatures.push(line);
                }
                continue;
            }
            // Python signatures
            if (fileExt === '.py') {
                if (stripped.startsWith('def ') || stripped.startsWith('async def ') || stripped.startsWith('class ')) {
                    signatures.push(line);
                }
                else if (stripped.startsWith('import ') || stripped.startsWith('from ')) {
                    signatures.push(line);
                }
                else if (stripped.startsWith('@')) {
                    signatures.push(line);
                }
                else if (stripped.startsWith('#') && (stripped.includes('TODO') || stripped.includes('FIXME') || stripped.includes('NOTE'))) {
                    if (stripped.length > 5) {
                        signatures.push(line);
                    }
                }
            }
            // JavaScript/TypeScript signatures
            else if (['.js', '.ts', '.jsx', '.tsx'].includes(fileExt)) {
                if (stripped.startsWith('import ') || stripped.startsWith('export ') ||
                    stripped.startsWith('function ') || stripped.startsWith('async function ') ||
                    stripped.startsWith('const ') || stripped.startsWith('let ') || stripped.startsWith('var ') ||
                    stripped.startsWith('class ') || stripped.startsWith('interface ') || stripped.startsWith('type ') ||
                    stripped.startsWith('//') || stripped.startsWith('/*')) {
                    if (stripped.startsWith('const ') || stripped.startsWith('let ') || stripped.startsWith('var ')) {
                        if (stripped.includes('=>') || stripped.includes('function') || !stripped.includes('=')) {
                            signatures.push(line);
                        }
                        else if (['Component', 'Hook', 'Context', 'Provider', 'Router'].some(x => stripped.includes(x))) {
                            signatures.push(line);
                        }
                    }
                    else {
                        signatures.push(line);
                    }
                }
            }
            // Go signatures
            else if (fileExt === '.go') {
                if (stripped.startsWith('package ') || stripped.startsWith('import ') ||
                    stripped.startsWith('func ') || stripped.startsWith('type ') ||
                    stripped.startsWith('const ') || stripped.startsWith('var ') ||
                    stripped.startsWith('//') || stripped.startsWith('/*')) {
                    signatures.push(line);
                }
            }
            // Rust signatures
            else if (fileExt === '.rs') {
                if (stripped.startsWith('use ') || stripped.startsWith('mod ') ||
                    stripped.startsWith('pub ') || stripped.startsWith('fn ') ||
                    stripped.startsWith('async fn ') || stripped.startsWith('struct ') ||
                    stripped.startsWith('enum ') || stripped.startsWith('impl ') ||
                    stripped.startsWith('trait ') || stripped.startsWith('//') || stripped.startsWith('//!')) {
                    signatures.push(line);
                }
            }
            // Config files - include more content
            else if (['.json', '.yaml', '.toml', '.yml'].includes(fileExt)) {
                if (signatures.length < 50) {
                    signatures.push(line);
                }
            }
        }
        return signatures.join('\n');
    }
    async getFileSummary(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const chars = content.length;
            // For small files, include full content
            if (chars < 500) {
                return {
                    path: path.relative(this.projectDir, filePath),
                    lines: lines.length,
                    chars,
                    content_type: 'full',
                    content
                };
            }
            // For larger files, extract signatures
            const ext = path.extname(filePath);
            const signatures = this.extractCodeSignatures(content, ext);
            const sigLines = signatures.split('\n').length;
            return {
                path: path.relative(this.projectDir, filePath),
                lines: lines.length,
                chars,
                content_type: 'signatures',
                signatures,
                compression_ratio: `${sigLines}/${lines.length} lines (${Math.floor(100 * sigLines / Math.max(1, lines.length))}%)`
            };
        }
        catch (error) {
            return {
                path: path.relative(this.projectDir, filePath),
                lines: 0,
                chars: 0,
                content_type: 'signatures',
                error: error.message || String(error)
            };
        }
    }
    async buildProjectTree() {
        const treeLines = [];
        const addDir = async (dirPath, prefix = '', isLast = true) => {
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                const items = entries.filter(e => !this.shouldIgnore(path.join(dirPath, e.name)));
                const sorted = items.sort((a, b) => {
                    if (a.isDirectory() && !b.isDirectory())
                        return 1;
                    if (!a.isDirectory() && b.isDirectory())
                        return -1;
                    return a.name.localeCompare(b.name);
                });
                const dirs = sorted.filter(e => e.isDirectory());
                const files = sorted.filter(e => e.isFile());
                // Show files first
                for (let i = 0; i < files.length; i++) {
                    const isLastItem = i === files.length - 1 && dirs.length === 0;
                    const connector = isLastItem ? '└── ' : '├── ';
                    treeLines.push(`${prefix}${connector}${files[i].name}`);
                }
                // Then directories
                for (let i = 0; i < dirs.length; i++) {
                    const isLastDir = i === dirs.length - 1;
                    const connector = isLastDir ? '└── ' : '├── ';
                    treeLines.push(`${prefix}${connector}${dirs[i].name}/`);
                    const extension = isLastDir ? '    ' : '│   ';
                    await addDir(path.join(dirPath, dirs[i].name), prefix + extension, isLastDir);
                }
            }
            catch {
                // Ignore errors
            }
        };
        const projectName = path.basename(this.projectDir);
        treeLines.push(`${projectName}/`);
        await addDir(this.projectDir);
        return treeLines.slice(0, 200).join('\n');
    }
    async buildContext() {
        if (this.compressionMode === 'full') {
            return this.buildFullContext();
        }
        else if (this.compressionMode === 'minimal') {
            return this.buildMinimalContext();
        }
        else {
            return this.buildSmartContext();
        }
    }
    async buildFullContext() {
        // For full context, we'd read all files - but this is expensive
        // For now, return a message indicating full context mode
        return `Project: ${path.basename(this.projectDir)}\nContext Mode: Full (all file contents)\n\nNote: Full context mode reads all files. Use smart or minimal for better performance.`;
    }
    async buildMinimalContext() {
        const tree = await this.buildProjectTree();
        return `# Project: ${path.basename(this.projectDir)}

## Structure
\`\`\`
${tree}
\`\`\`

## Instructions
This is a minimal context view. Use \`read_file\` to examine any file you need.
Use \`search_code\` to find specific patterns across the codebase.`;
    }
    async buildSmartContext() {
        // Get all relevant files
        const allFiles = [];
        const walkDir = async (dir) => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (this.shouldIgnore(fullPath))
                        continue;
                    if (entry.isDirectory()) {
                        await walkDir(fullPath);
                    }
                    else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        const relevantExts = [
                            '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.go',
                            '.rs', '.rb', '.php', '.sh', '.md', '.json', '.yaml', '.toml',
                            '.html', '.css', '.dart', '.kt', '.swift', '.c', '.h', '.sql',
                            '.vue', '.svelte', '.astro', '.prisma', '.graphql', '.proto'
                        ];
                        if (relevantExts.includes(ext)) {
                            allFiles.push(fullPath);
                        }
                    }
                }
            }
            catch {
                // Ignore errors
            }
        };
        await walkDir(this.projectDir);
        // Sort by importance
        allFiles.sort((a, b) => this.importance(b) - this.importance(a));
        const files = allFiles.slice(0, this.maxContextFiles);
        // Build project tree
        const tree = await this.buildProjectTree();
        // Get config files (full content)
        const configFiles = ['package.json', 'tsconfig.json', 'pyproject.toml', 'cargo.toml', 'go.mod', 'requirements.txt', 'next.config.js', 'vite.config.ts'];
        const configSection = [];
        for (const filePath of files) {
            const fileName = path.basename(filePath).toLowerCase();
            if (configFiles.includes(fileName)) {
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    if (content.length < 5000) {
                        const rel = path.relative(this.projectDir, filePath);
                        configSection.push(`\n### ${rel}\n\`\`\`\n${content}\n\`\`\``);
                    }
                }
                catch {
                    // Ignore errors
                }
            }
        }
        // Get code signatures for other files
        const codeSection = [];
        let tokensUsed = this.estimateTokens(tree + configSection.join(''));
        const remainingBudget = this.tokenBudget - tokensUsed - 2000;
        for (const filePath of files) {
            const fileName = path.basename(filePath).toLowerCase();
            if (configFiles.includes(fileName))
                continue;
            const summary = await this.getFileSummary(filePath);
            if (summary.content_type === 'full' && summary.content) {
                const entry = `\n### ${summary.path} (${summary.lines} lines) [FULL]\n\`\`\`\n${summary.content}\n\`\`\``;
                const entryTokens = this.estimateTokens(entry);
                if (tokensUsed + entryTokens > remainingBudget) {
                    codeSection.push(`\n... and ${files.length - codeSection.length} more files. Use read_file to examine them.`);
                    break;
                }
                codeSection.push(entry);
                tokensUsed += entryTokens;
            }
            else if (summary.signatures) {
                const entry = `\n### ${summary.path} (${summary.compression_ratio})\n\`\`\`\n${summary.signatures}\n\`\`\``;
                const entryTokens = this.estimateTokens(entry);
                if (tokensUsed + entryTokens > remainingBudget) {
                    codeSection.push(`\n... and ${files.length - codeSection.length} more files. Use read_file to examine them.`);
                    break;
                }
                codeSection.push(entry);
                tokensUsed += entryTokens;
            }
            else {
                codeSection.push(`\n### ${summary.path} (${summary.lines || '?'} lines) - Use read_file for content`);
            }
        }
        const totalTokens = this.estimateTokens(tree + configSection.join('') + codeSection.join(''));
        return `# Project: ${path.basename(this.projectDir)}
## Context Mode: Smart Compressed (~${totalTokens.toLocaleString()} tokens)

**IMPORTANT**: This is a compressed view showing code signatures and structure.
- Use \`read_file(path)\` to get full file contents when needed
- Use \`search_code(pattern)\` to find specific code patterns
- Config files are shown in full below

## Project Structure
\`\`\`
${tree}
\`\`\`

## Configuration Files
${configSection.length > 0 ? configSection.join('') : 'No standard config files found.'}

## Code Signatures (functions, classes, exports)
${codeSection.join('')}`;
    }
}
exports.SmartContext = SmartContext;
//# sourceMappingURL=smart-context.service.js.map