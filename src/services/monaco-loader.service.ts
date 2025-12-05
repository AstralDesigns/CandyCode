import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MonacoLoaderService {
  private monacoReady: Promise<void>;
  private resolveMonacoReady!: () => void;

  constructor() {
    this.monacoReady = new Promise<void>((resolve) => {
      this.resolveMonacoReady = resolve;
    });

    // If monaco is already loaded, resolve immediately
    if (typeof (window as any).monaco === 'object') {
      this.resolveMonacoReady();
      return;
    }
    
    // Check if the loader script is present and start loading
    if ((window as any).require) {
      this.loadMonaco();
    } else {
        console.error("Monaco loader script not found in index.html. Please ensure it's included.");
    }
  }
  
  private loadMonaco(): void {
      // Configure the AMD loader
      (window as any).require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
      
      // Load the main editor module
      (window as any).require(['vs/editor/editor.main'], () => {
        this.resolveMonacoReady();
      });
  }

  public ensureMonacoIsLoaded(): Promise<void> {
    return this.monacoReady;
  }
}
