import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
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
  const { theme, customThemes, activeCustomThemeId, activeStandardThemeId, saveFile, refreshOpenFiles } = useStore();

  // Update editor content when prop changes
  useEffect(() => {
    if (content !== editorContent) {
      setEditorContent(content);
    }
  }, [content]);

  // Handle window focus to check for external file changes
  useEffect(() => {
    const handleFocus = () => {
      // Refresh open files when app regains focus
      refreshOpenFiles();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshOpenFiles]);

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || '';
    setEditorContent(newContent);
    onChange(newContent);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Track editor selection for paste detection in chat
    const disposable = editor.onDidChangeCursorSelection(() => {
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
        // Clear selection
        window.dispatchEvent(new CustomEvent('editor-selection-change', {
          detail: null
        }));
      }
    });

    // Add Ctrl+S (Command+S on Mac) save command
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const activePaneId = useStore.getState().activePaneId;
      if (activePaneId) {
        saveFile(activePaneId);
      }
    });

    // Define themes
    defineMonacoThemes(monaco);
    applyTheme(monaco);

    // Enhanced autocompletion for multiple languages
    const languages = ['typescript', 'javascript', 'python', 'java', 'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'shell', 'bash', 'powershell'];
    
    // Common snippets for all languages
    const commonSnippets = [
      {
        label: 'if',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'if (${1:condition}) {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'If statement',
      },
      {
        label: 'for',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'for (${1:let i = 0}; ${2:i < length}; ${3:i++}) {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'For loop',
      },
      {
        label: 'function',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'function ${1:name}(${2:params}) {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Function declaration',
      },
      {
        label: 'try-catch',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'try {\n\t$1\n} catch (${2:error}) {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Try-catch block',
      },
    ];
    
    // TypeScript/JavaScript specific snippets
    const tsJsSnippets = [
      {
        label: 'arrow',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'const ${1:name} = (${2:params}) => {\n\t$0\n};',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Arrow function',
      },
      {
        label: 'async',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'async function ${1:name}(${2:params}) {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Async function',
      },
      {
        label: 'class',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t$3\n\t}\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Class declaration',
      },
      {
        label: 'interface',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'interface ${1:Name} {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Interface declaration',
      },
      {
        label: 'export',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'export ${1|const,function,class,interface,type|} ${2:name} = $0;',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Export statement',
      },
    ];
    
    // Python specific snippets
    const pythonSnippets = [
      {
        label: 'def',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'def ${1:name}(${2:params}):\n\t$0',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Function definition',
      },
      {
        label: 'class',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'class ${1:Name}:\n\tdef __init__(self${2:, params}):\n\t\t$3\n\t$0',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Class definition',
      },
      {
        label: 'if __name__',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'if __name__ == "__main__":\n\t$0',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Main guard',
      },
    ];
    
    languages.forEach(lang => {
      const suggestions: any[] = [...commonSnippets];
      
      // Add language-specific snippets
      if (lang === 'typescript' || lang === 'javascript') {
        suggestions.push(...tsJsSnippets);
      } else if (lang === 'python') {
        suggestions.push(...pythonSnippets);
      }
      
      // Add common keywords as suggestions
      const keywords = lang === 'typescript' || lang === 'javascript' 
        ? ['const', 'let', 'var', 'function', 'async', 'await', 'return', 'import', 'export', 'interface', 'type', 'class', 'extends', 'implements']
        : lang === 'python'
        ? ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as']
        : [];
      
      keywords.forEach(keyword => {
        suggestions.push({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          documentation: `${keyword} keyword`,
        });
      });
      
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          
          // Filter suggestions based on current word
          const filteredSuggestions = suggestions
            .filter(s => !word.word || s.label.toLowerCase().startsWith(word.word.toLowerCase()))
            .map(s => ({
              ...s,
              range,
            }));
          
          return {
            suggestions: filteredSuggestions,
          };
        },
        triggerCharacters: ['.', '(', '[', '{', ' ', ':', '<', '"', "'", '@', '#'],
      });
    });

    // Enhanced hover provider for better tooltips
    monaco.languages.registerHoverProvider(languages, {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        if (word) {
          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            ),
            contents: [
              { value: `**${word.word}**` },
            ],
          };
        }
        return null;
      },
    });

    // Bracket matching colors
    editor.updateOptions({
      matchBrackets: 'always',
      colorDecorators: true,
    });

    // Word highlighting
    editor.onDidChangeCursorSelection(() => {
      const position = editor.getPosition();
      if (position) {
        const word = editor.getModel()?.getWordAtPosition(position);
        if (word) {
          editor.deltaDecorations([], [
            {
              range: new monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn
              ),
              options: {
                className: 'word-highlight',
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              },
            },
          ]);
        }
      }
    });
  };

  const defineMonacoThemes = (monaco: any) => {
    // Alpha Theme (Deep Slate)
    monaco.editor.defineTheme('alpha-theme', {
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
      colors: {
        'editor.background': '#0f172a',
        'editor.foreground': '#f8fafc',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#94a3b8',
        'editor.selectionBackground': '#334155',
        'editor.lineHighlightBackground': '#1e293b',
        'editorCursor.foreground': '#0ea5e9',
      }
    });

    // Dark Theme (Pure Black)
    monaco.editor.defineTheme('alpha-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#ffffff',
        'editorLineNumber.foreground': '#3f3f46',
        'editorLineNumber.activeForeground': '#71717a',
        'editor.selectionBackground': '#27272a',
        'editor.lineHighlightBackground': '#09090b',
        'editorCursor.foreground': '#ffffff',
      }
    });

    // Light Theme
    monaco.editor.defineTheme('alpha-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000' },
        { token: 'keyword', foreground: '0000ff' },
        { token: 'string', foreground: 'a31515' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#0f172a',
        'editorLineNumber.foreground': '#94a3b8',
        'editor.lineHighlightBackground': '#f1f5f9',
        'editor.selectionBackground': '#e2e8f0',
      }
    });

    // Custom Theme
    if (theme === 'custom' && activeCustomThemeId) {
      const customTheme = customThemes.find(t => t.id === activeCustomThemeId);
      if (customTheme) {
        monaco.editor.defineTheme('alpha-custom', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': customTheme.colors.bgPrimary,
            'editor.foreground': customTheme.colors.textPrimary,
            'editorLineNumber.foreground': customTheme.colors.textSecondary,
            'editor.lineHighlightBackground': customTheme.colors.bgSecondary,
            'editorCursor.foreground': customTheme.colors.accentColor,
          }
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
      monaco.editor.defineTheme(`theme-${id}`, {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': colors.bg,
          'editor.foreground': colors.fg,
          'editorLineNumber.foreground': colors.line,
          'editorCursor.foreground': colors.accent,
          'editor.lineHighlightBackground': colors.line + '55',
        }
      });
    });
  };

  const applyTheme = (monaco: any) => {
    if (theme === 'light') {
      monaco.editor.setTheme('alpha-light');
    } else if (theme === 'dark') {
      monaco.editor.setTheme('alpha-dark');
    } else if (theme === 'custom') {
      monaco.editor.setTheme('alpha-custom');
    } else if (theme === 'standard' && activeStandardThemeId) {
      monaco.editor.setTheme(`theme-${activeStandardThemeId}`);
    } else {
      monaco.editor.setTheme('alpha-theme');
    }
  };

  useEffect(() => {
    const monaco = (window as any).monaco;
    if (monaco) {
      defineMonacoThemes(monaco);
      applyTheme(monaco);
    }
  }, [theme, activeCustomThemeId, activeStandardThemeId, customThemes]);

  const getLanguage = (path: string | null) => {
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

  return (
    <div className="flex-1 flex flex-col bg-background relative" style={{ height: '100%' }}>
      <div className="flex-1 relative w-full h-full">
        <Editor
          height="100%"
          width="100%"
          loading={<div className="flex items-center justify-center h-full text-muted">Loading editor...</div>}
          language={language || getLanguage(filePath)}
          value={editorContent}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
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
          }}
        />
      </div>
    </div>
  );
}
