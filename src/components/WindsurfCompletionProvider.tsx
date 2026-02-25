import * as monaco from 'monaco-editor';
import { windsurfService } from '../services/windsurf.service';
import { useStore } from '../store';

export class WindsurfCompletionProvider implements monaco.languages.CompletionItemProvider {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private disposables: monaco.IDisposable[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastRequestTime = 0;

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for cursor position changes to trigger inline suggestions
    this.disposables.push(
      this.editor.onDidChangeCursorPosition((_e) => {
        this.triggerInlineSuggestions();
      })
    );

    // Listen for text changes
    this.disposables.push(
      this.editor.onDidChangeModelContent((_e) => {
        this.triggerCompletions();
      })
    );
  }

  private triggerCompletions() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.provideCompletions();
    }, 300); // Debounce for 300ms
  }

  private triggerInlineSuggestions() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.provideInlineSuggestions();
    }, 200); // Faster debounce for inline suggestions
  }

  private async provideCompletions() {
    const { aiProvider, windsurfApiKey, windsurfUseBYOK, windsurfBYOKApiKey, windsurfBYOKProvider } = useStore.getState();
    
    // Only provide completions if Windsurf is selected
    if (aiProvider !== 'windsurf') {
      return;
    }

    // Check if we have proper API configuration
    if (!windsurfUseBYOK && !windsurfApiKey) {
      return;
    }
    if (windsurfUseBYOK && !windsurfBYOKApiKey) {
      return;
    }

    const model = this.editor.getModel();
    if (!model) return;

    const position = this.editor.getPosition();
    if (!position) return;

    const now = Date.now();
    if (now - this.lastRequestTime < 1000) return; // Rate limiting
    this.lastRequestTime = now;

    try {
      const completions = await windsurfService.getCompletions({
        prefix: model.getValue().substring(0, model.getOffsetAt(position)),
        suffix: model.getValue().substring(model.getOffsetAt(position)),
        language: model.getLanguageId(),
        useBYOK: windsurfUseBYOK,
        byokProvider: windsurfBYOKProvider as any,
        byokApiKey: windsurfBYOKApiKey
      });

      // Convert Windsurf completions to Monaco suggestions
      const suggestions = completions.map(comp => ({
        label: comp.text,
        kind: monaco.languages.CompletionItemKind.Text,
        insertText: comp.text,
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        detail: 'Windsurf Tab',
        documentation: comp.text
      }));

      // Trigger completion widget if we have suggestions
      if (suggestions.length > 0) {
        this.editor.trigger('windsurf', 'editor.action.triggerSuggest', {});
      }

    } catch (error) {
      console.error('Windsurf completion error:', error);
    }
  }

  private async provideInlineSuggestions() {
    const { aiProvider, windsurfApiKey, windsurfUseBYOK, windsurfBYOKApiKey, windsurfBYOKProvider } = useStore.getState();
    
    // Only provide inline suggestions if Windsurf is selected
    if (aiProvider !== 'windsurf') {
      return;
    }

    // Check if we have proper API configuration
    if (!windsurfUseBYOK && !windsurfApiKey) {
      return;
    }
    if (windsurfUseBYOK && !windsurfBYOKApiKey) {
      return;
    }

    const model = this.editor.getModel();
    if (!model) return;

    const position = this.editor.getPosition();
    if (!position) return;

    try {
      // Get context for FIM (Fill In The Middle)
      const text = model.getValue();
      const offset = model.getOffsetAt(position);
      const prefix = text.substring(0, offset);
      const suffix = text.substring(offset);

      const suggestions = await windsurfService.getInlineSuggestions({
        prefix: prefix,
        suffix: suffix,
        language: model.getLanguageId(),
        useBYOK: windsurfUseBYOK,
        byokProvider: windsurfBYOKProvider as any,
        byokApiKey: windsurfBYOKApiKey
      });

      // Apply inline suggestions as ghost text
      for (const suggestion of suggestions) {
        if (suggestion.type === 'insertion' && suggestion.text) {
          // Create a decoration for ghost text
          const decorations = this.editor.createDecorationsCollection([
            {
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              options: {
                after: {
                  content: suggestion.text,
                  inlineClassName: 'windsurf-ghost-text'
                },
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
              }
            }
          ]);

          // Remove ghost text after a delay or on user action
          setTimeout(() => {
            decorations.clear();
          }, 5000);
        }
      }

    } catch (error) {
      console.error('Windsurf inline suggestion error:', error);
    }
  }

  // Monaco completion provider interface
  async provideCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.CompletionContext,
    _token: monaco.CancellationToken
  ): Promise<monaco.languages.CompletionList> {
    const { aiProvider, windsurfApiKey, windsurfUseBYOK, windsurfBYOKApiKey, windsurfBYOKProvider } = useStore.getState();
    
    // Only provide completions if Windsurf is selected
    if (aiProvider !== 'windsurf') {
      return { suggestions: [] };
    }

    // Check if we have proper API configuration
    if (!windsurfUseBYOK && !windsurfApiKey) {
      return { suggestions: [] };
    }
    if (windsurfUseBYOK && !windsurfBYOKApiKey) {
      return { suggestions: [] };
    }

    try {
      const completions = await windsurfService.getCompletions({
        prefix: model.getValue().substring(0, model.getOffsetAt(position)),
        suffix: model.getValue().substring(model.getOffsetAt(position)),
        language: model.getLanguageId(),
        useBYOK: windsurfUseBYOK,
        byokProvider: windsurfBYOKProvider as any,
        byokApiKey: windsurfBYOKApiKey
      });

      const suggestions = completions.map(comp => ({
        label: comp.text,
        kind: monaco.languages.CompletionItemKind.Text,
        insertText: comp.text,
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        detail: 'Windsurf Tab',
        documentation: comp.text,
        sortText: '0' // Prioritize Windsurf suggestions
      }));

      return { suggestions };

    } catch (error) {
      console.error('Windsurf completion error:', error);
      return { suggestions: [] };
    }
  }

  dispose() {
    this.disposables.forEach(d => d.dispose());
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

// CSS for ghost text (should be added to the main CSS file)
export const windsurfStyles = `
.windsurf-ghost-text {
  color: #888;
  opacity: 0.6;
  font-style: italic;
}
`;

export function registerWindsurfProvider(editor: monaco.editor.IStandaloneCodeEditor): WindsurfCompletionProvider {
  const provider = new WindsurfCompletionProvider(editor);
  
  // Register the completion provider
  const disposable = monaco.languages.registerCompletionItemProvider(
    { pattern: '**' }, // All files
    provider
  );

  // Return a combined disposable for cleanup
  return {
    dispose: () => {
      provider.dispose();
      disposable.dispose();
    }
  } as WindsurfCompletionProvider;
}
