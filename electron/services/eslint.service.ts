/**
 * ESLint Service - Electron Main Process
 * Runs ESLint on files and returns diagnostics
 */
import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ESLintDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  ruleId: string | null;
  source: string;
}

export interface ESLintResult {
  filePath: string;
  diagnostics: ESLintDiagnostic[];
  error?: string;
}

export class ESLintService {
  private eslint: any = null;
  private mainWindow: BrowserWindow | null = null;
  private enabled: boolean = true;
  private configPath: string | null = null;

  constructor() {
    this.initializeESLint();
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async initializeESLint() {
    try {
      // Dynamically import ESLint
      const { ESLint } = await import('eslint');
      
      this.eslint = new ESLint({
        overrideConfigFile: this.configPath || undefined,
        fix: false,
        errorOnUnmatchedPattern: false,
      });
      
      console.log('[ESLint] ESLint initialized successfully');
    } catch (error: any) {
      console.warn('[ESLint] Failed to initialize ESLint:', error.message);
      console.warn('[ESLint] ESLint diagnostics will not be available');
      this.eslint = null;
    }
  }

  async lintFile(filePath: string, content: string): Promise<ESLintResult> {
    if (!this.enabled || !this.eslint) {
      return { filePath, diagnostics: [] };
    }

    try {
      // Only lint JavaScript/TypeScript files
      const ext = path.extname(filePath).toLowerCase();
      if (!['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
        return { filePath, diagnostics: [] };
      }

      // Use ESLint to lint the content
      const results = await this.eslint.lintText(content, { filePath });
      
      if (!results || results.length === 0) {
        return { filePath, diagnostics: [] };
      }

      const result = results[0];
      const diagnostics: ESLintDiagnostic[] = result.messages.map((msg: any) => ({
        severity: this.getSeverity(msg.severity),
        message: msg.message,
        line: msg.line,
        column: msg.column,
        endLine: msg.endLine || msg.line,
        endColumn: msg.endColumn || msg.column,
        ruleId: msg.ruleId || null,
        source: msg.source || '',
      }));

      return { filePath, diagnostics };
    } catch (error: any) {
      console.error('[ESLint] Error linting file:', error.message);
      return { 
        filePath, 
        diagnostics: [],
        error: error.message 
      };
    }
  }

  private getSeverity(eslintSeverity: number): 'error' | 'warning' | 'info' {
    switch (eslintSeverity) {
      case 2: return 'error';
      case 1: return 'warning';
      default: return 'info';
    }
  }

  async lintFiles(files: Array<{ path: string; content: string }>): Promise<ESLintResult[]> {
    if (!this.enabled || !this.eslint) {
      return files.map(f => ({ filePath: f.path, diagnostics: [] }));
    }

    const results = await Promise.all(
      files.map(file => this.lintFile(file.path, file.content))
    );

    return results;
  }

  async reloadConfig() {
    await this.initializeESLint();
  }
}

export const eslintService = new ESLintService();
