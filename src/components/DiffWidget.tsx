import { useEffect, useRef, useState } from 'react';
import { Check, X, ChevronDown, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import loader from '@monaco-editor/loader';
import { useStore } from '../store';

interface DiffWidgetProps {
  filePath: string;
  original: string;
  modified: string;
  status?: 'pending' | 'accepted' | 'rejected';
  onAccept?: () => void;
  onReject?: () => void;
  onOpenFile?: () => void;
}

export default function DiffWidget({ 
  filePath, 
  original, 
  modified, 
  status = 'pending',
  onAccept,
  onReject,
  onOpenFile 
}: DiffWidgetProps) {
  const { theme } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [addedLines, setAddedLines] = useState(0);
  const [removedLines, setRemovedLines] = useState(0);
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<any>(null);
  const originalModelRef = useRef<any>(null);
  const modifiedModelRef = useRef<any>(null);
  
  const fileName = filePath.split('/').pop() || filePath;

  // Detect language from file extension
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'md': 'markdown',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sh': 'shell',
      'bash': 'shell',
      'yaml': 'yaml',
      'yml': 'yaml',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
    };
    return langMap[ext] || 'plaintext';
  };

  // Calculate changes
  useEffect(() => {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    
    // Simple line count difference for summary
    setAddedLines(Math.max(0, modifiedLines.length - originalLines.length));
    setRemovedLines(Math.max(0, originalLines.length - modifiedLines.length));
  }, [original, modified]);

  useEffect(() => {
    if (isExpanded && diffContainerRef.current) {
      loader.init().then((monaco) => {
        if (!diffContainerRef.current) return;

        // Clean up previous models
        if (originalModelRef.current) originalModelRef.current.dispose();
        if (modifiedModelRef.current) modifiedModelRef.current.dispose();

        const language = getLanguage(filePath);
        originalModelRef.current = monaco.editor.createModel(original, language);
        modifiedModelRef.current = monaco.editor.createModel(modified, language);

        if (diffEditorRef.current) {
          diffEditorRef.current.dispose();
        }

        // Get background color for Monaco editor
        const bgColor = getBackgroundColor();
        
        // Use inline diff view (renderSideBySide: false) which shows +/- indicators
        diffEditorRef.current = monaco.editor.createDiffEditor(diffContainerRef.current, {
          theme: theme === 'light' ? 'vs' : 'vs-dark',
          readOnly: true,
          renderSideBySide: false, // Inline mode shows +/- indicators, no side-by-side line numbers
          originalEditable: false,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          lineNumbers: 'off', // Remove line numbers - use +/- indicators only
          renderIndicators: true, // Show +/- indicators on the left
          diffWordWrap: 'off',
        });
        
        // Update Monaco editor background color to match theme
        if (diffEditorRef.current) {
          const editor = diffEditorRef.current.getModifiedEditor();
          const originalEditor = diffEditorRef.current.getOriginalEditor();
          
          // Set background color via editor options
          editor.updateOptions({
            // Monaco will use the container's background, but we can also set it explicitly
          });
          
          // Apply background color to the editor container elements
          const editorContainer = diffContainerRef.current;
          if (editorContainer) {
            const monacoElements = editorContainer.querySelectorAll('.monaco-editor, .monaco-diff-editor');
            monacoElements.forEach((el: any) => {
              if (el.style) {
                el.style.backgroundColor = bgColor;
              }
            });
          }
        }

        diffEditorRef.current.setModel({
          original: originalModelRef.current,
          modified: modifiedModelRef.current,
        });
      });
    }

    return () => {
      if (diffEditorRef.current) {
        diffEditorRef.current.dispose();
        diffEditorRef.current = null;
      }
    };
  }, [isExpanded, original, modified, filePath, theme]);

  // Get background color from CSS variables
  const getBackgroundColor = () => {
    if (typeof window === 'undefined') return '#0f172a';
    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--settings-bg')
      .trim() || '#0f172a';
    return bgColor;
  };

  return (
    <div className={`rounded-lg overflow-hidden border transition-all duration-200 backdrop-blur-sm ${
      status === 'accepted' ? 'border-green-500/30' : 
      status === 'rejected' ? 'border-rose-500/30' : 
      'border-border'
    }`}
    style={{ backgroundColor: getBackgroundColor() }}
    >
      <div 
        className={`px-3 py-2 flex items-center justify-between cursor-pointer group ${
          status === 'accepted' ? 'bg-green-500/5' : 
          status === 'rejected' ? 'bg-rose-500/5' : 
          'bg-white/5'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText size={14} className={
            status === 'accepted' ? 'text-green-400' : 
            status === 'rejected' ? 'text-rose-400' : 
            'text-accent'
          } />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-foreground truncate">
              {fileName}
            </span>
            <span className="text-[10px] text-muted truncate">
              {filePath} {status !== 'pending' && `(${status})`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {status === 'pending' && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={(e) => { e.stopPropagation(); onReject?.(); }}
                className="p-1 rounded-md hover:bg-rose-500/20 text-muted hover:text-rose-400 transition-all"
                title="Reject"
              >
                <X size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAccept?.(); }}
                className="p-1 rounded-md hover:bg-green-500/20 text-muted hover:text-green-400 transition-all"
                title="Accept"
              >
                <Check size={14} />
              </button>
            </div>
          )}
          
          <div className="w-px h-4 bg-border mx-1" />
          
          <button
            onClick={(e) => { e.stopPropagation(); onOpenFile?.(); }}
            className="p-1.5 rounded-md hover:bg-white/10 text-muted hover:text-foreground transition-all"
            title="Open file"
          >
            <ExternalLink size={14} />
          </button>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-md hover:bg-white/10 text-muted hover:text-foreground transition-all"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div 
          ref={diffContainerRef} 
          className="h-[300px] w-full"
          style={{ backgroundColor: getBackgroundColor() }}
        />
      )}
      
      {!isExpanded && status === 'pending' && (
        <div 
          className="px-3 py-1.5 text-[10px] text-muted hover:text-foreground cursor-pointer transition-colors"
          onClick={() => setIsExpanded(true)}
        >
          Click to view {addedLines + removedLines} changes...
        </div>
      )}
    </div>
  );
}
