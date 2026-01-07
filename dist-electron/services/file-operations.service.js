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
exports.readFile = readFile;
exports.peekFile = peekFile;
exports.writeFile = writeFile;
exports.listFiles = listFiles;
exports.grepLines = grepLines;
exports.searchCode = searchCode;
exports.createPlan = createPlan;
exports.taskComplete = taskComplete;
exports.executeCommand = executeCommand;
exports.runTests = runTests;
exports.searchWeb = searchWeb;
/**
 * File operations service - Native Node.js file operations
 * Ported from Python python_tools.py
 */
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const glob_1 = require("glob");
const child_process_1 = require("child_process");
const util_1 = require("util");
const web_search_service_1 = require("./web-search.service");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
function resolvePath(filePath) {
    return filePath.startsWith('~')
        ? path.resolve(os.homedir(), filePath.slice(1))
        : path.resolve(filePath);
}
async function readFile(args) {
    try {
        const filePath = args.file_path || args.path;
        if (!filePath)
            return { error: 'No path provided' };
        const resolvedPath = resolvePath(filePath);
        if (!(await fs.stat(resolvedPath).catch(() => null))) {
            return { error: `File not found: ${filePath}`, file_path: filePath };
        }
        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory()) {
            return { error: `Path is a directory: ${filePath}`, file_path: filePath };
        }
        const content = await fs.readFile(resolvedPath, 'utf-8');
        const lines = content.split('\n');
        if (args.start_line || args.end_line) {
            const start = Math.max(1, args.start_line || 1);
            const end = Math.min(lines.length, args.end_line || lines.length);
            const selectedContent = lines.slice(start - 1, end).join('\n');
            return {
                file_path: filePath,
                content: selectedContent,
                line_count: lines.length,
                start_line: start,
                end_line: end
            };
        }
        return {
            file_path: filePath,
            content,
            line_count: lines.length,
        };
    }
    catch (error) {
        return { error: error.message || String(error), file_path: args.file_path || args.path };
    }
}
async function peekFile(args) {
    try {
        const filePath = args.file_path || args.path;
        if (!filePath)
            return { error: 'No path provided' };
        const resolvedPath = resolvePath(filePath);
        const stats = await fs.stat(resolvedPath).catch(() => null);
        if (!stats)
            return { error: `File not found: ${filePath}` };
        const content = await fs.readFile(resolvedPath, 'utf-8');
        const lines = content.split('\n');
        const previewCount = args.preview_lines || 50;
        if (lines.length <= previewCount * 2) {
            return { file_path: filePath, content, line_count: lines.length };
        }
        const firstLines = lines.slice(0, previewCount).join('\n');
        const lastLines = lines.slice(-previewCount).join('\n');
        const summary = `File: ${path.basename(resolvedPath)}\nLines: ${lines.length}\n\n--- First ${previewCount} lines ---\n${firstLines}\n...\n--- Last ${previewCount} lines ---\n${lastLines}`;
        return { file_path: filePath, content: summary, line_count: lines.length };
    }
    catch (error) {
        return { error: error.message || String(error) };
    }
}
async function writeFile(args, mainWindow) {
    try {
        const filePath = args.file_path || args.path;
        if (!filePath)
            return { error: 'No path provided' };
        const resolvedPath = resolvePath(filePath);
        let originalContent = '';
        let isNewFile = true;
        try {
            const stats = await fs.stat(resolvedPath);
            if (stats.isFile()) {
                isNewFile = false;
                originalContent = await fs.readFile(resolvedPath, 'utf-8');
            }
        }
        catch {
            isNewFile = true;
        }
        // For chunked writes, we need to track accumulated content
        // This will be handled by the AI backend service
        // Create pending diff instead of writing immediately
        // Send IPC message to renderer to add pending diff
        if (mainWindow) {
            mainWindow.webContents.send('file-operation:pending-diff', {
                filePath,
                original: originalContent,
                modified: args.content,
                isNewFile
            });
        }
        // Return pending status with full content for diff widget
        return {
            file_path: filePath,
            status: 'pending',
            isNewFile,
            originalContent: originalContent,
            content: args.content, // Full content for diff widget
            modified: args.content, // Also include as modified for clarity
        };
    }
    catch (error) {
        return { error: error.message || String(error), file_path: args.file_path || args.path };
    }
}
async function listFiles(args) {
    try {
        const resolvedPath = resolvePath(args.directory_path);
        const stats = await fs.stat(resolvedPath).catch(() => null);
        if (!stats)
            return { error: `Directory not found: ${args.directory_path}` };
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            const itemPath = path.join(resolvedPath, entry.name);
            const itemStats = await fs.stat(itemPath).catch(() => null);
            files.push({
                name: entry.name,
                path: itemPath,
                type: entry.isDirectory() ? 'folder' : 'file',
                size: itemStats?.isFile() ? itemStats.size : undefined,
            });
        }
        return { directory_path: args.directory_path, files };
    }
    catch (error) {
        return { error: error.message || String(error) };
    }
}
async function grepLines(args) {
    return readFile(args);
}
async function searchCode(args) {
    try {
        const searchTerm = args.search_term || args.pattern;
        if (!searchTerm)
            return { error: 'No search term provided' };
        const basePath = args.searchPath || process.cwd();
        const files = await (0, glob_1.glob)('**/*.{js,ts,jsx,tsx,py,md,json,html,css,scss}', {
            cwd: basePath,
            ignore: ['node_modules/**', 'dist/**', '.git/**'],
        });
        const matches = [];
        for (const file of files.slice(0, 100)) {
            const filePath = path.join(basePath, file);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (line.includes(searchTerm)) {
                        matches.push({ file, line: index + 1, content: line.trim() });
                    }
                });
            }
            catch { }
        }
        return { search_term: searchTerm, matches };
    }
    catch (error) {
        return { error: error.message || String(error) };
    }
}
function createPlan(args) {
    try {
        const validatedSteps = args.steps.map((step, index) => ({
            id: step.id || `step_${index + 1}`,
            description: step.description || String(step),
            status: step.status || 'pending',
            order: step.order ?? index + 1,
        }));
        return { title: args.title, steps: validatedSteps };
    }
    catch (error) {
        return { error: error.message || String(error) };
    }
}
function taskComplete(args) {
    return { summary: args.summary, status: 'completed' };
}
async function executeCommand(args) {
    try {
        const cmd = args.command.toLowerCase();
        const elevatedPatterns = ['sudo', 'rm -rf /', 'chmod 777', 'chown'];
        const isDangerous = elevatedPatterns.some(p => cmd.includes(p)) || args.needs_elevation;
        if (isDangerous) {
            return {
                command: args.command,
                status: 'pending',
                needsPassword: cmd.includes('sudo'),
                needsElevation: true,
            };
        }
        const { stdout, stderr } = await execAsync(args.command, {
            timeout: 300000,
            maxBuffer: 10 * 1024 * 1024,
        });
        return { command: args.command, stdout, stderr, exit_code: 0, status: 'completed' };
    }
    catch (error) {
        return {
            command: args.command,
            stdout: error.stdout || '',
            stderr: error.stderr || '',
            exit_code: error.code || 1,
            status: 'completed',
        };
    }
}
async function runTests(args) {
    let command = 'npm test';
    if (args.framework === 'pytest')
        command = 'pytest';
    else if (args.framework === 'cargo')
        command = 'cargo test';
    else if (args.framework === 'go')
        command = 'go test ./...';
    return executeCommand({ command });
}
async function searchWeb(args) {
    try {
        const maxResults = Math.min(args.max_results || 5, 10);
        return await web_search_service_1.webSearchService.search(args.query, maxResults);
    }
    catch (error) {
        return { query: args.query, results: [], error: error.message || 'Web search failed' };
    }
}
//# sourceMappingURL=file-operations.service.js.map