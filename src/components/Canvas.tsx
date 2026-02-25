import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store';
import { FilePane } from '../models/file-pane.model';
import EditorPanel from './EditorPanel';
import PDFCanvas from './PDFCanvas';
import OfficeCanvas from './OfficeCanvas';
import MediaGallery from './MediaGallery';

export default function Canvas() {
  const { panes, activePaneId, setActivePane, closePane, updatePaneContent, theme } = useStore();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previousActivePaneId = useRef<string | null>(null);

  const activePane = panes.find((p) => p.id === activePaneId);

  const handleTabClick = (pane: FilePane) => {
    setActivePane(pane.id);
  };

  const handleTabClose = (e: React.MouseEvent, pane: FilePane) => {
    e.stopPropagation();
    closePane(pane.id);
  };

  // Drag and drop for tab reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = draggingIndex;

    if (dragIndex !== null && dragIndex !== dropIndex && dragIndex < panes.length && dropIndex < panes.length) {
      const newPanes = [...panes];
      const [draggedPane] = newPanes.splice(dragIndex, 1);
      newPanes.splice(dropIndex, 0, draggedPane);

      // Update panes order in store
      useStore.setState({ panes: newPanes });

      // Keep the same active pane
      if (activePaneId) {
        setActivePane(activePaneId);
      }
    }

    setDraggingIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  // Mouse wheel scrolling for tabs
  const handleWheel = (e: React.WheelEvent) => {
    if (tabContainerRef.current) {
      e.preventDefault();
      const scrollAmount = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      tabContainerRef.current.scrollLeft += scrollAmount;
    }
  };

  // Focus editor when active pane changes
  useEffect(() => {
    if (activePaneId && activePaneId !== previousActivePaneId.current) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        // Dispatch custom event to notify editor to focus
        window.dispatchEvent(new CustomEvent('canvas:pane-changed', { 
          detail: { paneId: activePaneId } 
        }));
      }, 50);
      
      previousActivePaneId.current = activePaneId;
    }
    
    return () => {
      // Cleanup
    };
  }, [activePaneId]);

  // Handle canvas click to focus editor
  const handleCanvasClick = () => {
    if (activePaneId) {
      window.dispatchEvent(new CustomEvent('canvas:focus-editor'));
    }
  };

  return (
    <div 
      ref={canvasRef}
      className="h-full w-full flex flex-col bg-background"
      onClick={handleCanvasClick}
    >
      {/* Tab bar - floating style */}
      <div className="flex-shrink-0 z-20 px-2 py-1">
        <div
          ref={tabContainerRef}
          className="flex items-center overflow-x-auto overflow-y-hidden scrollbar-hide flex-nowrap gap-1"
          role="tablist"
          onWheel={handleWheel}
        >
          {panes.map((pane, index) => (
            <button
              key={pane.id}
              role="tab"
              aria-selected={pane.id === activePaneId}
              onClick={() => handleTabClick(pane)}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              data-tooltip={pane.id.startsWith('untitled-') ? pane.name : pane.id}
              data-tooltip-position="bottom"
              className={`
                flex items-center pl-2 pr-1.5 py-0.5 text-[11px] font-medium rounded-md
                transition-all flex-shrink-0 cursor-pointer
                backdrop-blur-sm border
                ${pane.id === activePaneId 
                  ? 'bg-white/10 text-foreground shadow-sm' 
                  : 'bg-white/5 text-muted hover:bg-white/10'
                }
                ${theme === 'light' 
                  ? pane.id === activePaneId 
                    ? 'bg-slate-300/80 border-slate-400/50' 
                    : 'bg-slate-200/50 border-slate-300/50'
                  : pane.id === activePaneId
                    ? 'border-white/20'
                    : 'border-white/5'
                }
                ${draggingIndex === index ? 'opacity-50' : ''}
              `}
            >
              <div
                className={`w-1 h-1 rounded-full mr-1.5 flex-shrink-0 ${
                  pane.isUnsaved
                    ? 'bg-accent'
                    : pane.id === activePaneId
                    ? 'bg-muted'
                    : ''
                }`}
                data-tooltip={pane.isUnsaved ? 'Unsaved changes' : 'Current tab'}
              />
              <span className="truncate max-w-40">{pane.name}</span>
              <span
                onClick={(e) => handleTabClose(e, pane)}
                className="ml-1.5 p-0.5 rounded hover:bg-white/10 flex-shrink-0 cursor-pointer"
                onMouseDown={(e) => e.stopPropagation()}
                //data-tooltip="Close"
              >
                <X className="h-2.5 w-2.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 relative">
        {panes.map(pane => (
          <div
            key={pane.id}
            className="h-full w-full absolute top-0 left-0"
            style={{
              display: pane.id === activePaneId ? 'block' : 'none',
            }}
          >
            {pane.type === 'code' || pane.type === 'markdown' ? (
              <EditorPanel
                filePath={pane.id.startsWith('untitled-') ? null : pane.id}
                content={pane.content}
                onChange={(content) => updatePaneContent(pane.id, content)}
                language={pane.language}
              />
            ) : pane.type === 'pdf' ? (
              <PDFCanvas filePath={pane.id} />
            ) : pane.type === 'word' || pane.type === 'excel' || 
                pane.type === 'powerpoint' || pane.type === 'onenote' ? (
              <OfficeCanvas
                filePath={pane.id}
                documentType={pane.type}
              />
            ) : pane.type === 'image-gallery' ? (
              <MediaGallery
                mediaItems={pane.data || []}
                mediaType="image"
              />
            ) : pane.type === 'video-gallery' ? (
              <MediaGallery
                mediaItems={pane.data || []}
                mediaType="video"
              />
            ) : (
              <div className="p-4">Unsupported file type for {pane.name}</div>
            )}
          </div>
        ))}

        {!activePane && (
          <div className="flex flex-col items-center justify-center h-full text-muted text-center p-8">
            {/* App icon as empty state */}
            <div className="mb-6 flex flex-col items-center">
              <img
                src="./icon.png"
                alt="CandyCode"
                className="h-24 w-24 object-contain mb-4 opacity-100"
                onError={(e) => {
                  // Fallback to SVG if icon.png is not found
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const svgFallback = document.createElement('div');
                  svgFallback.innerHTML = `
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-20 w-20 mb-6 opacity-20"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4l2 2h4a2 2 0 012 2v12a4 4 0 01-4 4H7z"
                      />
                    </svg>
                  `;
                  target.parentNode?.insertBefore(svgFallback, target.nextSibling);
                }}
              />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Canvas is empty</h3>
            <p className="text-muted mb-8">Open a file from the explorer or create a new one to get started.</p>
            
            <div className="w-full max-w-md space-y-3">
              <h4 className="text-sm font-semibold text-muted mb-4">Keyboard Shortcuts</h4>

              <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-muted">Create New File</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-white/10 border border-white/10 rounded">Ctrl+N</kbd>
              </div>

              <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-muted">Open File</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-white/10 border border-white/10 rounded">Ctrl+O</kbd>
              </div>

              <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-muted">Save File</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-white/10 border border-white/10 rounded">Ctrl+S</kbd>
              </div>

              <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-muted">New Window</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-white/10 border border-white/10 rounded">Shift</kbd>
                  <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-white/10 border border-white/10 rounded">Ctrl</kbd>
                  <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-white/10 border border-white/10 rounded">N</kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
