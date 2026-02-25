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
exports.eslintService = exports.ESLintService = void 0;
const path = __importStar(require("path"));
class ESLintService {
    eslint = null;
    mainWindow = null;
    enabled = true;
    configPath = null;
    constructor() {
        this.initializeESLint();
    }
    setMainWindow(window) {
        this.mainWindow = window;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    isEnabled() {
        return this.enabled;
    }
    async initializeESLint() {
        try {
            // Dynamically import ESLint
            const { ESLint } = await Promise.resolve().then(() => __importStar(require('eslint')));
            this.eslint = new ESLint({
                overrideConfigFile: this.configPath || undefined,
                fix: false,
                errorOnUnmatchedPattern: false,
            });
            console.log('[ESLint] ESLint initialized successfully');
        }
        catch (error) {
            console.warn('[ESLint] Failed to initialize ESLint:', error.message);
            console.warn('[ESLint] ESLint diagnostics will not be available');
            this.eslint = null;
        }
    }
    async lintFile(filePath, content) {
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
            const diagnostics = result.messages.map((msg) => ({
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
        }
        catch (error) {
            console.error('[ESLint] Error linting file:', error.message);
            return {
                filePath,
                diagnostics: [],
                error: error.message
            };
        }
    }
    getSeverity(eslintSeverity) {
        switch (eslintSeverity) {
            case 2: return 'error';
            case 1: return 'warning';
            default: return 'info';
        }
    }
    async lintFiles(files) {
        if (!this.enabled || !this.eslint) {
            return files.map(f => ({ filePath: f.path, diagnostics: [] }));
        }
        const results = await Promise.all(files.map(file => this.lintFile(file.path, file.content)));
        return results;
    }
    async reloadConfig() {
        await this.initializeESLint();
    }
}
exports.ESLintService = ESLintService;
exports.eslintService = new ESLintService();
//# sourceMappingURL=eslint.service.js.map