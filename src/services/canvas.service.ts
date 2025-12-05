import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { FilePane } from '../models/file-pane.model';
import { FileSystemService } from './file-system.service';

@Injectable({
  providedIn: 'root',
})
export class CanvasService {
  private readonly WORKSPACE_STATE_KEY = 'agentic-studio-workspace-v1';
  private fileSystemService = inject(FileSystemService);
  panes = signal<FilePane[]>([]);
  activePaneId = signal<string | null>(null);
  private untitledCounter = signal(0);

  activePane = computed(() => {
    const panes = this.panes();
    const activeId = this.activePaneId();
    if (!activeId) return null;
    return panes.find(p => p.id === activeId) ?? null;
  });

  hasOpenPanes = computed(() => this.panes().length > 0);

  constructor() {
    this.loadState();
    
    // Auto-save workspace state whenever it changes
    effect(() => {
      const panes = this.panes();
      const activePaneId = this.activePaneId();
      if (panes.length > 0) {
        const state = {
          panes,
          activePaneId,
        };
        try {
          localStorage.setItem(this.WORKSPACE_STATE_KEY, JSON.stringify(state));
        } catch (e) {
          console.error('Failed to save workspace state:', e);
        }
      } else {
        // Clear storage if there are no panes left
        localStorage.removeItem(this.WORKSPACE_STATE_KEY);
      }
    });
  }

  private loadState(): void {
    try {
      const savedState = localStorage.getItem(this.WORKSPACE_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state.panes && state.activePaneId) {
          this.panes.set(state.panes);
          this.activePaneId.set(state.activePaneId);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load workspace state:', e);
      localStorage.removeItem(this.WORKSPACE_STATE_KEY);
    }
    
    // If no saved state, open the welcome message
    this.openWelcomePane();
  }

  private openWelcomePane(): void {
    this.openFile({
      id: 'welcome',
      name: 'Welcome.md',
      type: 'welcome',
      content: `
# Welcome to Agentic Studio

This is an interactive canvas where you can view and edit files.

- Use the **Explorer** on the left to browse and open files.
- Clicking an image or video will now open a **full gallery** for that folder.
- Chat with the **AI Agent** to generate code, write documents, or perform tasks.
- The agent can open files here for you to review.

Try asking the agent: *"Open the main app component for me."*
        `,
      isUnsaved: false,
    });
  }

  openFile(pane: FilePane): void {
    // If the file is a media file, open a gallery instead
    if (pane.type === 'image' || pane.type === 'video') {
      const playlist = this.fileSystemService.getMediaPlaylist(pane.id);
      if (playlist.length > 0) {
        const directoryPath = pane.id.substring(0, pane.id.lastIndexOf('/')) || '/';
        const galleryType = pane.type === 'image' ? 'image-gallery' : 'video-gallery';
        const galleryId = `gallery:${galleryType}:${directoryPath}`;
        const galleryName = pane.type === 'image' ? 'Image Gallery' : 'Video Gallery';
        
        const existingGallery = this.panes().find(p => p.id === galleryId);
        if (existingGallery) {
          this.setActivePane(galleryId);
        } else {
          const galleryPane: FilePane = {
            id: galleryId,
            name: galleryName,
            type: galleryType,
            content: '', // Not used directly
            data: playlist,
          };
          this.panes.update(panes => [...panes, galleryPane]);
          this.setActivePane(galleryId);
        }
        return; // Stop further processing
      }
    }
    
    // Default behavior for non-media files or media files with no playlist
    const existing = this.panes().find(p => p.id === pane.id);
    if (!existing) {
      this.panes.update(panes => [...panes, pane]);
    }
    this.setActivePane(pane.id);
  }

  createNewFile(type: 'markdown' | 'code'): void {
    this.untitledCounter.update(c => c + 1);
    const newCount = this.untitledCounter();
    const extension = type === 'markdown' ? 'md' : 'ts';
    const name = `Untitled-${newCount}.${extension}`;
    const newPane: FilePane = {
      id: `untitled-${Date.now()}`,
      name: name,
      type: type,
      content: '',
      isUnsaved: true,
      language: type === 'code' ? 'typescript' : undefined,
    };
    this.openFile(newPane);
  }

  updateActivePaneContent(newContent: string): void {
    const activeId = this.activePaneId();
    if (!activeId) return;

    this.panes.update(panes => {
      return panes.map(p =>
        p.id === activeId
          ? { ...p, content: newContent, isUnsaved: true }
          : p
      );
    });
  }

  setActivePane(id: string): void {
    this.activePaneId.set(id);
  }

  closePane(id: string): void {
    this.panes.update(panes => {
      const index = panes.findIndex(p => p.id === id);
      if (index === -1) return panes;

      const newPanes = panes.filter(p => p.id !== id);

      if (this.activePaneId() === id) {
        if (newPanes.length > 0) {
          const newIndex = Math.max(0, index - 1);
          this.activePaneId.set(newPanes[newIndex].id);
        } else {
          this.activePaneId.set(null);
        }
      }
      return newPanes;
    });
  }

  // Mock fetching file content
  async fetchFileContent(path: string): Promise<FilePane> {
    // In a real desktop app, this would use native file system APIs.
    const MOCK_FILES: Record<string, Omit<FilePane, 'id' | 'name'>> = {
      'src/app.component.ts': {
        type: 'code',
        language: 'typescript',
        content: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { WorkspaceComponent } from './components/workspace/workspace.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidebarComponent, WorkspaceComponent],
})
export class AppComponent {}`,
      },
      'src/app.component.html': {
        type: 'code',
        language: 'html',
        content: `<div class="flex h-screen w-full font-sans">
  <app-sidebar></app-sidebar>
  <app-workspace></app-workspace>
</div>`,
      },
      'package.json': {
        type: 'code',
        language: 'json',
        content: `{
  "name": "agentic-studio",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@angular/common": "^18.0.0",
    "@angular/core": "^18.0.0",
    "@google/genai": "^0.2.1"
  }
}`,
      },
      'README.md': {
        type: 'markdown',
        content: `# Project README

This is the main README file for the project. It contains important information about setting up and running the application.`,
      },
      'assets/logo.png': {
        type: 'image',
        content: 'https://picsum.photos/seed/agentic-logo/800/600',
      },
      'assets/wallpaper.jpg': {
        type: 'image',
        content: 'https://picsum.photos/seed/wallpaper/800/600',
      },
       'assets/field.jpeg': {
        type: 'image',
        content: 'https://picsum.photos/seed/field/800/600',
      },
      'assets/sample.gif': {
        type: 'image',
        content: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3N5M3VmaTZuZmZuaXNsc3M5b2p2a2pjaTUxZHM2M3g2cnZodDQyZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiVyE/giphy.gif',
      },
      'assets/demo.mp4': {
        type: 'video',
        content:
          'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
      },
       'assets/nature.mp4': {
        type: 'video',
        content:
          'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
      },
    };

    if (path in MOCK_FILES) {
      const file = MOCK_FILES[path];
      return {
        id: path,
        name: path.split('/').pop() || path,
        isUnsaved: false,
        ...file,
      };
    }

    return {
      id: path,
      name: path.split('/').pop() || path,
      type: 'code',
      language: 'plaintext',
      content: `// Mock file not found: ${path}`,
      isUnsaved: false,
    };
  }
}