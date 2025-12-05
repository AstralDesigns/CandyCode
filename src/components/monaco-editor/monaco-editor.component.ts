import {
  Component,
  ElementRef,
  ViewChild,
  input,
  output,
  effect,
  OnDestroy,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';

declare const monaco: any;

@Component({
  selector: 'app-monaco-editor',
  standalone: true,
  templateUrl: './monaco-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonacoEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;
  
  content = input.required<string>();
  language = input.required<string>();

  contentChange = output<string>();

  private editor: any;
  private isUpdatingFromInput = false;

  constructor() {
    // Effect to handle external content changes (e.g., from state restoration)
    effect(() => {
      const newContent = this.content();
      if (this.editor && this.editor.getValue() !== newContent) {
        this.isUpdatingFromInput = true;
        // Preserve cursor position
        const position = this.editor.getPosition();
        this.editor.setValue(newContent);
        if (position) {
          this.editor.setPosition(position);
        }
        this.isUpdatingFromInput = false;
      }
    });
  }

  ngAfterViewInit(): void {
    if ((window as any).monaco) {
      this.initMonaco();
    } else {
      // Monaco is loaded via a script tag, so we need to wait for it.
      (window as any).require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }});
      (window as any).require(['vs/editor/editor.main'], () => {
        this.initMonaco();
      });
    }
  }

  initMonaco(): void {
    this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
      value: this.content(),
      language: this.language(),
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      wordWrap: 'on',
      wrappingIndent: 'indent',
      padding: {
        top: 16,
        bottom: 16,
      },
      lineNumbersMinChars: 3,
    });

    this.editor.onDidChangeModelContent(() => {
      if (!this.isUpdatingFromInput) {
        this.contentChange.emit(this.editor.getValue());
      }
    });
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.dispose();
    }
  }
}
