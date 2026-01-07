import { useState, useEffect, useRef } from 'react';
import { FileSystemItem } from '../models/file-pane.model';
import { X, ImageIcon } from 'lucide-react';
import { useThumbnailService } from '../services/thumbnail.service';
import { useStore } from '../store';

interface MediaGalleryProps {
  mediaItems: FileSystemItem[];
  mediaType: 'image' | 'video';
}

export default function MediaGallery({ mediaItems, mediaType }: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);
  const thumbnailService = useThumbnailService();
  const { addContextImage, contextImages } = useStore();
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const itemsToPreload = mediaItems.map(item => ({ path: item.path, name: item.name }));
    thumbnailService.preloadThumbnails(itemsToPreload);
  }, [mediaItems, thumbnailService]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (lightboxIndex === null) return;
    if (direction === 'prev') {
      const newIndex = lightboxIndex > 0 ? lightboxIndex - 1 : mediaItems.length - 1;
      setLightboxIndex(newIndex);
      if (newIndex > 0) {
        thumbnailService.loadThumbnail(mediaItems[newIndex - 1].path, mediaItems[newIndex - 1].name);
      }
    } else {
      const newIndex = lightboxIndex < mediaItems.length - 1 ? lightboxIndex + 1 : 0;
      setLightboxIndex(newIndex);
      if (newIndex < mediaItems.length - 1) {
        thumbnailService.loadThumbnail(mediaItems[newIndex + 1].path, mediaItems[newIndex + 1].name);
      }
    }
  };

  const handleSwipeStart = (clientX: number, clientY: number) => {
    setSwipeStartX(clientX);
    setSwipeStartY(clientY);
  };

  const handleSwipeEnd = (clientX: number, clientY: number) => {
    if (swipeStartX === null || swipeStartY === null) return;
    
    const deltaX = clientX - swipeStartX;
    const deltaY = clientY - swipeStartY;
    const threshold = 50;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > threshold) {
        navigateLightbox(deltaX > 0 ? 'prev' : 'next');
      }
    } else {
      if (Math.abs(deltaY) > threshold) {
        navigateLightbox(deltaY > 0 ? 'prev' : 'next');
      }
    }
    
    setSwipeStartX(null);
    setSwipeStartY(null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleSwipeStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length > 0) {
      handleSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleSwipeStart(e.clientX, e.clientY);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (swipeStartX !== null) {
      handleSwipeEnd(e.clientX, e.clientY);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (lightboxIndex === null || wheelTimeoutRef.current) return;

    if (Math.abs(e.deltaY) > 20) {
      navigateLightbox(e.deltaY < 0 ? 'prev' : 'next');
      wheelTimeoutRef.current = setTimeout(() => {
        wheelTimeoutRef.current = null;
      }, 300);
    }
  };

  const isInContext = (path: string): boolean => {
    return contextImages.some(img => img.path === path);
  };

  const toggleContext = async (e: React.MouseEvent, item: FileSystemItem) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (mediaType !== 'image') return;
    
    const { removeContextImage } = useStore.getState();
    const index = contextImages.findIndex(img => img.path === item.path);

    if (index !== -1) {
      removeContextImage(index);
    } else if (window.electronAPI?.readFile) {
      try {
        const result = await window.electronAPI.readFile(item.path);
        if (result.content && !result.error) {
          addContextImage({ path: item.path, data: result.content });
        }
      } catch (error) {
        console.error('Failed to add image to context:', error);
      }
    }
  };

  const currentItem = lightboxIndex !== null ? mediaItems[lightboxIndex] : null;

  return (
    <div className="w-full h-full bg-background overflow-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
        {mediaItems.map((item, index) => {
          const inContext = mediaType === 'image' ? isInContext(item.path) : false;
          return (
            <div
              key={item.path}
              className="relative aspect-square rounded-xl cursor-pointer hover:opacity-95 transition-all duration-200 group bg-secondary/30"
              onClick={() => openLightbox(index)}
              style={{ border: '1px solid var(--border-color)' }}
            >
              {mediaType === 'image' ? (
                <img
                  src={`file://${item.path}`}
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23334155"/><text x="50" y="50" text-anchor="middle" fill="%2394a3b8" font-size="12">Image</text></svg>';
                  }}
                />
              ) : (
                <video
                  src={`file://${item.path}`}
                  className="absolute inset-0 w-full h-full object-cover rounded-xl"
                  preload="metadata"
                  muted
                />
              )}

              <div className="absolute inset-0 flex flex-col justify-between z-20">
                {mediaType === 'image' && (
                  <div className="flex justify-end p-2">
                    <div
                      onClick={(e) => toggleContext(e, item)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 shadow-xl ${
                        inContext 
                          ? 'bg-accent text-white scale-100 opacity-100 ring-2 ring-white/20' 
                          : 'bg-black/50 text-white/70 hover:bg-black/70 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 group-hover:scale-100'
                      }`}
                      data-tooltip={inContext ? 'Remove from context' : 'Add to context'}
                      data-tooltip-position="left"
                    >
                      <ImageIcon className={`h-4.5 w-4.5 ${inContext ? 'animate-pulse' : ''}`} />
                    </div>
                  </div>
                )}
                
                <div className="bg-background/60 backdrop-blur-md text-foreground text-[10px] p-2 truncate border-t border-border/10 rounded-b-xl">
                  {item.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lightboxIndex !== null && currentItem && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <button 
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-[60]"
            onClick={closeLightbox}
          >
            <X className="w-8 h-8" />
          </button>

          {mediaItems.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); navigateLightbox('prev'); }}
                className="absolute left-4 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 z-[60] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigateLightbox('next'); }}
                className="absolute right-4 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 z-[60] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}
          
          <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
            {mediaType === 'image' ? (
              <img
                src={`file://${currentItem.path}`}
                alt={currentItem.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <video
                src={`file://${currentItem.path}`}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/80 text-sm bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
            {`${lightboxIndex + 1} / ${mediaItems.length} — ${currentItem.name}`}
          </div>
        </div>
      )}
    </div>
  );
}
