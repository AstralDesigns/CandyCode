import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CanvasService } from '../../services/canvas.service';
import { FilePane } from '../../models/file-pane.model';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { FileSystemItem } from '../../models/file-system-item.model';
import { MediaGalleryComponent } from '../media-gallery/media-gallery.component';
import { MediaLightboxComponent } from '../media-lightbox/media-lightbox.component';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MarkdownPipe,
    MediaGalleryComponent,
    MediaLightboxComponent,
    MonacoEditorComponent,
  ],
  templateUrl: './canvas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent {
  canvasService = inject(CanvasService);

  panes = this.canvasService.panes;
  activePane = this.canvasService.activePane;

  // State for the lightbox
  lightboxPlaylist = signal<FileSystemItem[] | null>(null);
  lightboxStartIndex = signal(0);

  selectPane(pane: FilePane): void {
    this.canvasService.setActivePane(pane.id);
  }

  closePane(event: MouseEvent, pane: FilePane): void {
    event.stopPropagation(); // prevent selectPane from firing
    this.canvasService.closePane(pane.id);
  }

  onContentChange(newContent: string): void {
    this.canvasService.updateActivePaneContent(newContent);
  }

  openLightbox(selectedItem: FileSystemItem): void {
    const pane = this.activePane();
    if (pane && (pane.type === 'image-gallery' || pane.type === 'video-gallery')) {
      const playlist = pane.data as FileSystemItem[];
      const startIndex = playlist.findIndex(item => item.path === selectedItem.path);

      this.lightboxPlaylist.set(playlist);
      this.lightboxStartIndex.set(startIndex >= 0 ? startIndex : 0);
    }
  }

  closeLightbox(): void {
    this.lightboxPlaylist.set(null);
  }
}
