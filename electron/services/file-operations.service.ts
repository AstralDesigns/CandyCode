/**
 * File operations service - Native Node.js file operations
 * Ported from Python python_tools.py
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';
import { webSearchService, WebSearchResult } from './web-search.service';

const execAsync = promisify(exec);

export interface FileResult {
  file_path?: string;
  content?: string;
  modified?: string; // Alias for content in diff context
  status?: string;
  isNewFile?: boolean;
  originalContent?: string;
  error?: string;
  line_count?: number;
  start_line?: number;
  end_line?: number;
  directory_path?: string;
  files?: Array<{
    name: string;
    path: string;
    type: 'file' | 'folder';
    size?: number;
  }>;
  search_term?: string;
  matches?: Array<{
    file: string;
    line: number;
    content: string;
  }>;
  title?: string;
  steps?: Array<{
    id: string;
    description: string;
    status: string;
    order: number;
  }>;
  message?: string;
  summary?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  needsPassword?: boolean;
  needsElevation?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith('~') 
    ? path.resolve(os.homedir(), filePath.slice(1))
    : path.resolve(filePath);
}

export async function readFile(args: { file_path?: string; path?: string; start_line?: number; end_line?: number }): Promise<FileResult> {
  try {
    const filePath = args.file_path || args.path;
    if (!filePath) return { error: 'No path provided' };
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
  } catch (error: any) {
    return { error: error.message || String(error), file_path: args.file_path || args.path };
  }
}

export async function peekFile(args: { file_path?: string; path?: string; preview_lines?: number }): Promise<FileResult> {
  try {
    const filePath = args.file_path || args.path;
    if (!filePath) return { error: 'No path provided' };
    const resolvedPath = resolvePath(filePath);
    const stats = await fs.stat(resolvedPath).catch(() => null);
    if (!stats) return { error: `File not found: ${filePath}` };
    
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
  } catch (error: any) {
    return { error: error.message || String(error) };
  }
}

export async function writeFile(
  args: { file_path?: string; path?: string; content: string; finalize?: boolean; mode?: string },
  mainWindow?: any
): Promise<FileResult> {
  try {
    const filePath = args.file_path || args.path;
    if (!filePath) return { error: 'No path provided' };
    const resolvedPath = resolvePath(filePath);
    
    let originalContent = '';
    let isNewFile = true;
    
    try {
      const stats = await fs.stat(resolvedPath);
      if (stats.isFile()) {
        isNewFile = false;
        originalContent = await fs.readFile(resolvedPath, 'utf-8');
      }
    } catch {
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
  } catch (error: any) {
    return { error: error.message || String(error), file_path: args.file_path || args.path };
  }
}

export async function listFiles(args: { directory_path: string }): Promise<FileResult> {
  try {
    const resolvedPath = resolvePath(args.directory_path);
    const stats = await fs.stat(resolvedPath).catch(() => null);
    if (!stats) return { error: `Directory not found: ${args.directory_path}` };
    
    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const files = [];
    
    for (const entry of entries) {
      const itemPath = path.join(resolvedPath, entry.name);
      const itemStats = await fs.stat(itemPath).catch(() => null);
      files.push({
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? 'folder' as const : 'file' as const,
        size: itemStats?.isFile() ? itemStats.size : undefined,
      });
    }
    
    return { directory_path: args.directory_path, files };
  } catch (error: any) {
    return { error: error.message || String(error) };
  }
}

export async function grepLines(args: { file_path?: string; path?: string; start_line: number; end_line: number }): Promise<FileResult> {
  return readFile(args);
}

export async function searchCode(args: { search_term?: string; pattern?: string; searchPath?: string }): Promise<FileResult> {
  try {
    const searchTerm = args.search_term || args.pattern;
    if (!searchTerm) return { error: 'No search term provided' };
    const basePath = args.searchPath || process.cwd();
    const files = await glob('**/*.{js,ts,jsx,tsx,py,md,json,html,css,scss}', {
      cwd: basePath,
      ignore: ['node_modules/**', 'dist/**', '.git/**'],
    });
    
    const matches: Array<{ file: string; line: number; content: string }> = [];
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
      } catch {}
    }
    return { search_term: searchTerm, matches };
  } catch (error: any) {
    return { error: error.message || String(error) };
  }
}

export function createPlan(args: { title: string; steps: any[] }): FileResult {
  try {
    const validatedSteps = args.steps.map((step, index) => ({
      id: step.id || `step_${index + 1}`,
      description: step.description || String(step),
      status: step.status || 'pending',
      order: step.order ?? index + 1,
    }));
    return { title: args.title, steps: validatedSteps };
  } catch (error: any) {
    return { error: error.message || String(error) };
  }
}

export function taskComplete(args: { summary: string }): FileResult {
  return { summary: args.summary, status: 'completed' };
}

export async function executeCommand(args: { command: string; needs_elevation?: boolean }): Promise<FileResult> {
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
  } catch (error: any) {
    return {
      command: args.command,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exit_code: error.code || 1,
      status: 'completed',
    };
  }
}

export async function runTests(args: { framework?: string }): Promise<FileResult> {
  let command = 'npm test';
  if (args.framework === 'pytest') command = 'pytest';
  else if (args.framework === 'cargo') command = 'cargo test';
  else if (args.framework === 'go') command = 'go test ./...';
  return executeCommand({ command });
}

export async function searchWeb(args: { query: string; max_results?: number }): Promise<WebSearchResult> {
  try {
    const maxResults = Math.min(args.max_results || 5, 10);
    return await webSearchService.search(args.query, maxResults);
  } catch (error: any) {
    return { query: args.query, results: [], error: error.message || 'Web search failed' };
  }
}
