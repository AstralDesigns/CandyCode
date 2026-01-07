import { useEffect, useRef } from 'react';
import { useStore } from './store';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import ChatPanel from './components/ChatPanel';
import ThemeProvider from './components/ThemeProvider';
import Settings from './components/Settings';

function App() {
  const { 
    theme, 
    showSettings, 
    sidebarVisible, 
    chatVisible, 
    sidebarWidth, 
    chatWidth,
    setSidebarWidth,
    setChatWidth
  } = useStore();
  const isResizing = useRef(false);
  const resizeType = useRef<'sidebar' | 'chat' | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark' || theme === 'alpha' || theme === 'custom');
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N to create new file
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        useStore.getState().createNewFile();
      }
      // Ctrl+S or Cmd+S to save file
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const { panes, activePaneId, saveFile } = useStore.getState();
        const activePane = panes.find((p) => p.id === activePaneId);
        if (activePane && activePane.isUnsaved) {
          saveFile(activePane.id);
        }
      }
      // Ctrl+O or Cmd+O to open file
      else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        if (window.electronAPI?.showOpenDialog) {
          window.electronAPI.showOpenDialog({
            properties: ['openFile'],
            filters: [
              { name: 'All Files', extensions: ['*'] },
              { name: 'Code Files', extensions: ['ts', 'tsx', 'js', 'jsx', 'py'] },
              { name: 'Markdown', extensions: ['md'] },
            ],
          }).then((result: any) => {
            if (!result.canceled && result.filePaths?.length > 0) {
              useStore.getState().openFileByPath(result.filePaths[0]);
            }
          });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startResize = (e: React.MouseEvent, type: 'sidebar' | 'chat') => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeType.current = type;
    startX.current = e.clientX;
    startWidth.current = type === 'sidebar' ? sidebarWidth : chatWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !resizeType.current) return;

      const deltaX = resizeType.current === 'sidebar' 
        ? e.clientX - startX.current 
        : startX.current - e.clientX; // Reverse for chat panel

      const newWidth = Math.max(
        resizeType.current === 'sidebar' ? 192 : 256, // min-width
        Math.min(
          window.innerWidth * 0.5, // max-width (50vw)
          startWidth.current + deltaX
        )
      );

      if (resizeType.current === 'sidebar') {
        setSidebarWidth(newWidth);
      } else {
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      resizeType.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <ThemeProvider>
      <div className="h-screen w-full font-sans flex flex-col bg-background text-foreground transition-colors duration-300">
        <Header />
        
        <div className="relative flex-1 flex overflow-hidden">
          {/* Main canvas area - Tab-based canvas */}
          <main className="app-main h-full w-full flex-1">
            <Canvas />
          </main>

          {/* Floating sidebar panel */}
          <aside 
            className={`sidebar-panel ${sidebarVisible ? 'sidebar-visible' : ''}`}
            style={{ width: `${sidebarWidth}px` }}
          >
            <div 
              className="resize-handle resize-handle-right"
              onMouseDown={(e) => startResize(e, 'sidebar')}
            ></div>
            <Sidebar />
          </aside>

          {/* Floating chat panel */}
          <aside 
            className={`chat-panel ${chatVisible ? 'chat-visible' : ''}`}
            style={{ width: `${chatWidth}px` }}
          >
            <div 
              className="resize-handle resize-handle-left"
              onMouseDown={(e) => startResize(e, 'chat')}
            ></div>
            <ChatPanel />
          </aside>

          {/* Backdrop for overlay mode */}
          {(sidebarVisible || chatVisible) && (
            <div
              className="backdrop backdrop-visible"
              onClick={() => {
                if (sidebarVisible) useStore.getState().toggleSidebar();
                if (chatVisible) useStore.getState().toggleChat();
              }}
            />
          )}
        </div>
        
        {showSettings && <Settings />}
      </div>
    </ThemeProvider>
  );
}

export default App;
