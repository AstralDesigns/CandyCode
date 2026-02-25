import { useEffect, useRef, useState, useMemo } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useStore } from '../store';

interface EditorPanelProps {
  filePath: string | null;
  content: string;
  onChange: (content: string) => void;
  language?: string;
}

export default function EditorPanel({ filePath, content, onChange, language }: EditorPanelProps) {
  const [editorContent, setEditorContent] = useState(content);
  const editorRef = useRef<any>(null);
  const monaco = useMonaco();
  const { theme, customThemes, activeCustomThemeId, activeStandardThemeId, saveFile, refreshOpenFiles } = useStore();
  // Generate a stable ID for untitled files to ensure they get a consistent model path
  const [uniqueId] = useState(() => Math.random().toString(36).substr(2, 9));

  // Calculate current theme string
  const currentTheme = useMemo(() => {
    if (theme === 'light') return 'alpha-light';
    if (theme === 'dark') return 'alpha-dark';
    if (theme === 'custom') return 'alpha-custom';
    if (theme === 'standard' && activeStandardThemeId) return `theme-${activeStandardThemeId}`;
    return 'alpha-theme';
  }, [theme, activeStandardThemeId]);

  // Update editor content when prop changes
  useEffect(() => {
    if (content !== editorContent) {
      setEditorContent(content);
    }
  }, [content]);

  // Handle window focus to check for external file changes
  useEffect(() => {
    const handleFocus = () => {
      refreshOpenFiles();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshOpenFiles]);

  // Listen for global command palette trigger
  useEffect(() => {
    const handleTriggerPalette = () => {
      if (editorRef.current) {
        editorRef.current.focus();
        editorRef.current.trigger('anyString', 'editor.action.quickCommand', {});
      }
    };

    window.addEventListener('trigger-command-palette', handleTriggerPalette);
    return () => window.removeEventListener('trigger-command-palette', handleTriggerPalette);
  }, []);

  // Determine the correct language ID
  const getLanguageId = (path: string | null, lang?: string) => {
    if (lang) return lang;
    if (!path) return 'plaintext';
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      json: 'json',
      md: 'markdown',
      html: 'html',
      css: 'css',
      scss: 'scss',
      yaml: 'yaml',
      yml: 'yaml',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const currentLanguage = getLanguageId(filePath, language);

  // Construct a model path with the correct extension to ensure Monaco uses the correct language service
  const modelPath = useMemo(() => {
    // Helper to get extension from language
    const getExtension = (lang: string) => {
      switch (lang) {
        case 'typescript': return 'tsx'; // Use tsx to support both TS and JSX
        case 'javascript': return 'jsx';
        case 'python': return 'py';
        case 'markdown': return 'md';
        case 'json': return 'json';
        case 'html': return 'html';
        case 'css': return 'css';
        default: return 'txt';
      }
    };

    const ext = getExtension(currentLanguage);
    
    if (filePath) {
      // If filePath already has an extension, use it, otherwise append one
      if (filePath.split('/').pop()?.includes('.')) {
        return filePath;
      }
      return `${filePath}.${ext}`;
    }
    
    // For untitled/memory files
    return `inmemory://untitled-${uniqueId}.${ext}`;
  }, [filePath, currentLanguage, uniqueId]);

  const defineMonacoThemes = (monacoInstance: any) => {
    // Helper to get CSS variable values
    const getCommonThemeRules = (baseColors: any) => {
      return {
        'editor.background': baseColors.bg,
        'editor.foreground': baseColors.fg,
        'editorLineNumber.foreground': baseColors.line,
        'editorLineNumber.activeForeground': baseColors.accent,
        'editor.selectionBackground': baseColors.selection,
        'editor.lineHighlightBackground': baseColors.lineHighlight,
        'editorCursor.foreground': baseColors.accent,
        'quickInput.background': baseColors.widgetBg,
        'quickInput.foreground': baseColors.fg,
        'editorSuggestWidget.background': baseColors.widgetBg,
        'editorSuggestWidget.border': baseColors.border,
        'editorSuggestWidget.selectedBackground': baseColors.accent + '33',
        'input.background': baseColors.inputBg,
        'input.foreground': baseColors.fg,
        'input.border': baseColors.border,
      };
    };

    // Alpha Theme (Deep Slate)
    monacoInstance.editor.defineTheme('alpha-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
      ],
      colors: getCommonThemeRules({
        bg: '#0f172a',
        fg: '#f8fafc',
        line: '#475569',
        accent: '#0ea5e9',
        selection: '#334155',
        lineHighlight: '#1e293b',
        border: '#1e293b',
        widgetBg: '#0f172a',
        inputBg: '#0f172a'
      })
    });

    // Dark Theme (Pure Black)
    monacoInstance.editor.defineTheme('alpha-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: getCommonThemeRules({
        bg: '#000000',
        fg: '#ffffff',
        line: '#3f3f46',
        accent: '#ffffff',
        selection: '#27272a',
        lineHighlight: '#09090b',
        border: '#27272a',
        widgetBg: '#09090b',
        inputBg: '#18181b'
      })
    });

    // Light Theme
    monacoInstance.editor.defineTheme('alpha-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000' },
        { token: 'keyword', foreground: '0000ff' },
        { token: 'string', foreground: 'a31515' },
      ],
      colors: getCommonThemeRules({
        bg: '#ffffff',
        fg: '#0f172a',
        line: '#94a3b8',
        accent: '#2563eb',
        selection: '#e2e8f0',
        lineHighlight: '#f1f5f9',
        border: '#cbd5e1',
        widgetBg: '#ffffff',
        inputBg: '#ffffff'
      })
    });

    // Custom Theme
    if (theme === 'custom' && activeCustomThemeId) {
      const customTheme = customThemes.find(t => t.id === activeCustomThemeId);
      if (customTheme) {
        monacoInstance.editor.defineTheme('alpha-custom', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: getCommonThemeRules({
            bg: customTheme.colors.bgPrimary,
            fg: customTheme.colors.textPrimary,
            line: customTheme.colors.textSecondary,
            accent: customTheme.colors.accentColor,
            selection: customTheme.colors.bgSecondary,
            lineHighlight: customTheme.colors.bgSecondary,
            border: customTheme.colors.borderColor,
            widgetBg: customTheme.colors.settingsBg,
            inputBg: customTheme.colors.inputBg
          })
        });
      }
    }

    // Standard Themes
    const standardThemes = {
      'catppuccin-mocha': { bg: '#1e1e2e', fg: '#cdd6f4', accent: '#cba6f7', line: '#313244' },
      'gruvbox': { bg: '#282828', fg: '#ebdbb2', accent: '#fabd2f', line: '#3c3836' },
      'tokyo-night': { bg: '#1a1b26', fg: '#a9b1d6', accent: '#7aa2f7', line: '#24283b' },
      'dracula': { bg: '#282a36', fg: '#f8f8f2', accent: '#bd93f9', line: '#44475a' },
      'solarized-dark': { bg: '#002b36', fg: '#839496', accent: '#268bd2', line: '#073642' },
      'monokai': { bg: '#272822', fg: '#f8f8f2', accent: '#f92672', line: '#3e3d32' },
      'rose-pine': { bg: '#191724', fg: '#e0def4', accent: '#ebbcba', line: '#26233a' },
      'graphite': { bg: '#2c2c2c', fg: '#e0e0e0', accent: '#666666', line: '#383838' },
      'crimson': { bg: '#1a0a0a', fg: '#ffd6d6', accent: '#ff4d4d', line: '#3d1414' },
      'greenify': { bg: '#0a1a0a', fg: '#d6ffd6', accent: '#4dff4d', line: '#143d14' },
    };

    Object.entries(standardThemes).forEach(([id, colors]) => {
      monacoInstance.editor.defineTheme(`theme-${id}`, {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: getCommonThemeRules({
          bg: colors.bg,
          fg: colors.fg,
          line: colors.line,
          accent: colors.accent,
          selection: colors.line,
          lineHighlight: colors.line + '55',
          border: colors.line,
          widgetBg: colors.bg,
          inputBg: colors.line + '22'
        })
      });
    });
  };

  const applyTheme = (monacoInstance: any) => {
    monacoInstance.editor.setTheme(currentTheme);
  };

  const handleBeforeMount = (monacoInstance: any) => {
    defineMonacoThemes(monacoInstance);
  };

  // Configure Monaco languages when monaco instance is available
  useEffect(() => {
    if (monaco) {
      // Cast to any to avoid type errors with monaco.languages.typescript properties
      const ts = monaco.languages.typescript as any;

      const diagnosticsOptions = {
        noSemanticValidation: true,
        noSyntaxValidation: false,
      };

      const compilerOptions = {
        target: ts.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        module: ts.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: ts.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        checkJs: false, 
        strict: false,
        typeRoots: ['node_modules/@types'],
      };

      // Configure TypeScript
      ts.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
      ts.typescriptDefaults.setCompilerOptions(compilerOptions);
      // Eagerly sync models
      ts.typescriptDefaults.setEagerModelSync(true);

      // Configure JavaScript
      ts.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
      ts.javascriptDefaults.setCompilerOptions(compilerOptions);
      ts.javascriptDefaults.setEagerModelSync(true);

      // Define themes and apply (reactive updates)
      defineMonacoThemes(monaco);
      applyTheme(monaco);
      
      // Register snippets
      registerSnippets(monaco);
    }
  }, [monaco, theme, activeCustomThemeId, activeStandardThemeId, customThemes]);

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || '';
    setEditorContent(newContent);
    onChange(newContent);
  };

  const handleEditorDidMount = (editor: any, _monaco: any) => {
    editorRef.current = editor;
    editor.focus();

    // ESLint integration - run linting on file changes
    let eslintDebounceTimer: NodeJS.Timeout | null = null;
    
    const runESLint = async (content: string) => {
      if (!filePath || !window.electronAPI?.eslint) return;
      
      // Only lint JavaScript/TypeScript files
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (!['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext || '')) return;

      if (eslintDebounceTimer) clearTimeout(eslintDebounceTimer);
      
      eslintDebounceTimer = setTimeout(async () => {
        try {
          const result = await window.electronAPI.eslint.lintFile(filePath, content);
          
          if (result.diagnostics && result.diagnostics.length > 0) {
            const markers = result.diagnostics.map(diag => ({
              severity: diag.severity === 'error' ? _monaco.MarkerSeverity.Error :
                        diag.severity === 'warning' ? _monaco.MarkerSeverity.Warning :
                        _monaco.MarkerSeverity.Info,
              startLineNumber: diag.line,
              startColumn: diag.column,
              endLineNumber: diag.endLine,
              endColumn: diag.endColumn,
              message: diag.message + (diag.ruleId ? ` (${diag.ruleId})` : ''),
              source: 'eslint',
            }));
            
            _monaco.editor.setModelMarkers(editor.getModel(), 'eslint', markers);
          } else {
            _monaco.editor.setModelMarkers(editor.getModel(), 'eslint', []);
          }
        } catch (error: any) {
          console.error('[EditorPanel] ESLint error:', error);
        }
      }, 500); // Debounce ESLint runs by 500ms
    };

    // Run ESLint on content changes
    editor.onDidChangeModelContent(() => {
      runESLint(editor.getValue());
    });

    // Initial ESLint run
    runESLint(editor.getValue());

    // Track editor selection for paste detection in chat
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty() && filePath) {
        window.dispatchEvent(new CustomEvent('editor-selection-change', {
          detail: {
            filePath,
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('editor-selection-change', {
          detail: null
        }));
      }
    });

    // Add Ctrl+S (Command+S on Mac) save command
    editor.addCommand(_monaco.KeyMod.CtrlCmd | _monaco.KeyCode.KeyS, () => {
      const activePaneId = useStore.getState().activePaneId;
      if (activePaneId) {
        saveFile(activePaneId);
      }
    });

    // Word highlighting
    editor.onDidChangeCursorSelection(() => {
      const position = editor.getPosition();
      if (position) {
        const word = editor.getModel()?.getWordAtPosition(position);
        if (word) {
          editor.deltaDecorations([], [
            {
              range: new _monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn
              ),
              options: {
                className: 'word-highlight',
                stickiness: _monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              },
            },
          ]);
        }
      }
    });
  };

  const registerSnippets = (monacoInstance: any) => {
    const languages = ['typescript', 'javascript', 'python', 'java', 'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'shell', 'bash', 'powershell'];
    
    // Common snippets
    const commonSnippets = [
      {
        label: 'if',
        kind: monacoInstance.languages.CompletionItemKind.Snippet,
        insertText: 'if (${1:condition}) {\n\t$0\n}',
        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'If statement',
      },
      {
        label: 'for',
        kind: monacoInstance.languages.CompletionItemKind.Snippet,
        insertText: 'for (${1:let i = 0}; ${2:i < length}; ${3:i++}) {\n\t$0\n}',
        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'For loop',
      },
      {
        label: 'function',
        kind: monacoInstance.languages.CompletionItemKind.Snippet,
        insertText: 'function ${1:name}(${2:params}) {\n\t$0\n}',
        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Function declaration',
      },
      {
        label: 'try-catch',
        kind: monacoInstance.languages.CompletionItemKind.Snippet,
        insertText: 'try {\n\t$1\n} catch (${2:error}) {\n\t$0\n}',
        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Try-catch block',
      },
    ];
    
    // TS/JS Snippets
    const tsJsSnippets = [
      {
        label: 'arrow',
        kind: monacoInstance.languages.CompletionItemKind.Snippet,
        insertText: 'const ${1:name} = (${2:params}) => {\n\t$0\n};',
        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Arrow function',
      },
      {
        label: 'console.log',
        kind: monacoInstance.languages.CompletionItemKind.Snippet,
        insertText: 'console.log($1);',
        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Log to console',
      }
    ];

    languages.forEach(lang => {
      // Clear previous providers if necessary (Monaco doesn't have a clear way to unregister, but we rely on React lifecycle)
      monacoInstance.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          
          let suggestions: any[] = [...commonSnippets];
          if (lang === 'typescript' || lang === 'javascript') {
            suggestions = [...suggestions, ...tsJsSnippets];
          }

          return {
            suggestions: suggestions.map(s => ({ ...s, range })),
          };
        }
      });
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-background relative" style={{ height: '100%' }}>
      {/* Command Palette Bar - Below tabs, above editor */}
      <div className="h-7 border-b flex items-center justify-center px-2 shrink-0 z-10"
        style={{ 
          backgroundColor: 'var(--header-bg)', 
          borderColor: 'var(--border-color)',
          backdropFilter: 'blur(4px)'
        }}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (editorRef.current) {
              editorRef.current.focus();
              setTimeout(() => {
                editorRef.current.trigger('anyString', 'editor.action.quickCommand', {});
              }, 10);
            }
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-xs text-muted transition-colors w-64 justify-between group cursor-pointer select-none"
        >
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
            <span>Command Palette...</span>
          </div>
          <span className="opacity-0 group-hover:opacity-50 text-[10px]">F1</span>
        </button>
      </div>

      <div className="flex-1 relative w-full h-full">
        <Editor
          height="100%"
          width="100%"
          path={modelPath}
          theme={currentTheme}
          beforeMount={handleBeforeMount}
          loading={<div className="flex items-center justify-center h-full text-muted">Loading editor...</div>}
          language={currentLanguage}
          value={editorContent}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { 
              enabled: true,
              maxColumn: 120,
              renderCharacters: true,
              showSlider: 'always'
            },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            cursorStyle: 'line',
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true,
            },
            parameterHints: {
              enabled: true,
              cycle: true,
            },
            formatOnPaste: true,
            formatOnType: true,
            codeLens: false,
            folding: true,
            foldingStrategy: 'auto',
            showFoldingControls: 'always',
            matchBrackets: 'always',
            bracketPairColorization: {
              enabled: true,
            },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            wordBasedSuggestions: 'matchingDocuments',
            suggestSelection: 'first',
            acceptSuggestionOnCommitCharacter: true,
            acceptSuggestionOnEnter: 'on',
            snippetSuggestions: 'top',
            tabCompletion: 'on',
            quickSuggestionsDelay: 100,
            padding: {
              top: 16,
              bottom: 16,
            },
            renderLineHighlight: 'all',
            renderWhitespace: 'selection',
            smoothScrolling: true,
          }}
        />
      </div>
      {/* Monaco Widget Theming - Matches active theme */}
      <style>{`
        /* Find/Replace Widget */
        .monaco-editor .find-widget {
          background: var(--bg-secondary) !important;
          border: 1px solid var(--border-color) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        }
        .monaco-editor .find-widget input {
          background: var(--input-bg) !important;
          color: var(--text-primary) !important;
          border: 1px solid var(--input-border) !important;
        }
        .monaco-editor .find-widget .button {
          color: var(--text-secondary) !important;
        }
        .monaco-editor .find-widget .button:hover {
          color: var(--accent-color) !important;
        }
        .monaco-editor .find-widget .monaco-findInput .input {
          color: var(--text-primary) !important;
        }
        .monaco-editor .find-widget .monaco-findInput .controls {
          background: var(--bg-secondary) !important;
        }
        
        /* Suggest Widget (Autocomplete) */
        .monaco-editor .suggest-widget {
          background: var(--bg-secondary) !important;
          border: 1px solid var(--border-color) !important;
        }
        .monaco-editor .suggest-widget .monaco-list .monaco-list-row {
          color: var(--text-primary) !important;
        }
        .monaco-editor .suggest-widget .monaco-list .monaco-list-row.focused {
          background: var(--accent-color) !important;
          color: #ffffff !important;
        }
        .monaco-editor .suggest-widget .monaco-list .monaco-list-row .label-name {
          color: var(--text-primary) !important;
        }
        .monaco-editor .suggest-widget .monaco-list .monaco-list-row .type-label {
          color: var(--text-secondary) !important;
        }
        
        /* Parameter Hints Widget */
        .monaco-editor .parameter-hints-widget {
          background: var(--bg-secondary) !important;
          border: 1px solid var(--border-color) !important;
          color: var(--text-primary) !important;
        }
        .monaco-editor .parameter-hints-widget .signature {
          color: var(--text-primary) !important;
        }
        .monaco-editor .parameter-hints-widget .parameter {
          color: var(--accent-color) !important;
        }
        .monaco-editor .parameter-hints-widget .documentation {
          color: var(--text-secondary) !important;
        }
        
        /* Quick Input Widget (Command Palette) */
        .quick-input-widget {
          background: var(--bg-secondary) !important;
          border: 1px solid var(--border-color) !important;
        }
        .quick-input-widget .quick-input-box input {
          background: var(--input-bg) !important;
          color: var(--text-primary) !important;
          border: 1px solid var(--input-border) !important;
        }
        .quick-input-widget .monaco-list .monaco-list-row {
          color: var(--text-primary) !important;
        }
        .quick-input-widget .monaco-list .monaco-list-row.focused {
          background: var(--accent-gradient) !important;
          color: #ffffff !important;
        }
        .quick-input-widget .monaco-list .monaco-list-row .quick-input-item-label {
          color: var(--text-primary) !important;
        }
        .quick-input-widget .monaco-list .monaco-list-row .quick-input-item-description {
          color: var(--text-secondary) !important;
        }
        
        /* Hover Widget */
        .monaco-editor .editor-hover-widget {
          background: var(--bg-secondary) !important;
          border: 1px solid var(--border-color) !important;
          color: var(--text-primary) !important;
        }
        .monaco-editor .editor-hover-widget .markdown-hover {
          color: var(--text-primary) !important;
        }
        
        /* Context Menu - Monaco Menu System */
        .monaco-menu, .monaco-menu .monaco-scrollable-element {
          background: var(--bg-secondary) !important;
          border: 1px solid var(--border-color) !important;
        }
        .monaco-menu .monaco-action-bar .action-label {
          color: var(--text-primary) !important;
        }
        .monaco-menu .monaco-action-bar .action-item.focused .action-label {
          background: var(--accent-color) !important;
          color: #ffffff !important;
        }
        .monaco-menu .monaco-action-bar .action-item.disabled .action-label {
          color: var(--text-secondary) !important;
          opacity: 0.5;
        }
        .monaco-menu .monaco-menu-separator {
          background: var(--border-color) !important;
        }
        
        /* Native Editor Context Menu (right-click/shift+F10 menu) */
        .monaco-editor .context-view,
        .monaco-editor .context-view .monaco-scrollable-element,
        .monaco-editor .context-view.monaco-menu-container,
        .monaco-editor .context-view.monaco-menu-container .monaco-scrollable-element {
          background-color: var(--bg-secondary) !important;
          border: 1px solid var(--border-color) !important;
        }
        .monaco-editor .context-view .action-label,
        .monaco-editor .context-view.monaco-menu-container .action-label {
          color: var(--text-primary) !important;
        }
        .monaco-editor .context-view .action-item.focused .action-label,
        .monaco-editor .context-view.monaco-menu-container .action-item.focused .action-label {
          background-color: var(--accent-color) !important;
          color: #ffffff !important;
        }
        .monaco-editor .context-view .monaco-menu-separator,
        .monaco-editor .context-view.monaco-menu-container .monaco-menu-separator {
          background-color: var(--border-color) !important;
        }
        .monaco-editor .context-view .action-label.disabled,
        .monaco-editor .context-view.monaco-menu-container .action-label.disabled {
          color: var(--text-secondary) !important;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
