import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import ChatPanel from './components/ChatPanel';
import ThemeProvider from './components/ThemeProvider';
import Settings from './components/Settings';
import UnsavedChangesDialog from './components/UnsavedChangesDialog';

function App() {
  const {
    theme,
    showSettings,
    sidebarVisible,
    chatVisible,
    sidebarWidth,
    chatWidth,
    setSidebarWidth,
    setChatWidth,
    panes,
    saveFile
  } = useStore();
  const isResizing = useRef(false);
  const resizeType = useRef<'sidebar' | 'chat' | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  // Check for unsaved changes
  const hasUnsavedChanges = panes.some(p => p.isUnsaved);

  // Handle close request from header Exit button or Ctrl+Q (closes current window only)
  useEffect(() => {
    const handleRequestClose = () => {
      if (hasUnsavedChanges) {
        setShowCloseDialog(true);
      } else {
        window.electronAPI?.app?.closeCurrentWindow();
      }
    };

    window.addEventListener('app:request-close-current', handleRequestClose as EventListener);
    return () => {
      window.removeEventListener('app:request-close-current', handleRequestClose as EventListener);
    };
  }, [hasUnsavedChanges]);

  // Handle "Open With" file requests from OS (Linux, macOS, Windows)
  useEffect(() => {
    if (window.electronAPI?.app?.onOpenFiles) {
      const dispose = window.electronAPI.app.onOpenFiles((filePaths: string[]) => {
        console.log('[App] Received files to open:', filePaths);
        // Open each file in a new pane
        filePaths.forEach(filePath => {
          useStore.getState().openFileByPath(filePath);
        });
      });
      return dispose;
    }
  }, []);

  // Handle dialog actions (for current window close)
  const handleCloseWithoutSaving = () => {
    setShowCloseDialog(false);
    window.electronAPI?.app?.closeCurrentWindow();
  };

  const handleCancelClose = () => {
    setShowCloseDialog(false);
  };

  const handleSaveBeforeClose = async () => {
    // Save all unsaved files in current window
    const unsavedPanes = panes.filter(p => p.isUnsaved);
    for (const pane of unsavedPanes) {
      await saveFile(pane.id);
    }
    setShowCloseDialog(false);
    // After saving, close current window only
    window.electronAPI?.app?.closeCurrentWindow();
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark' || theme === 'alpha' || theme === 'custom');
  }, [theme]);

  // System theme detection and sync (GTK/Qt on Linux, native on Mac/Windows)
  useEffect(() => {
    // Get initial system theme from Electron nativeTheme
    const initSystemTheme = async () => {
      try {
        const systemTheme = await window.electronAPI?.system?.getTheme();
        if (systemTheme) {
          console.log('[App] Initial system theme:', systemTheme.isDark ? 'dark' : 'light');
        }
      } catch (error) {
        console.log('[App] Could not get system theme:', error);
      }
    };
    initSystemTheme();
    
    // Listen for system theme changes via Electron nativeTheme
    if (window.electronAPI?.system?.onThemeChange) {
      const dispose = window.electronAPI.system.onThemeChange((theme: { isDark: boolean }) => {
        console.log('[App] System theme changed to:', theme.isDark ? 'dark' : 'light');
        // Only auto-switch if user hasn't explicitly set a custom theme
        const currentTheme = useStore.getState().theme;
        // Auto-switch for 'standard' or 'alpha' themes (default themes)
        if (currentTheme === 'alpha' || currentTheme === 'standard') {
          const newTheme = theme.isDark ? 'dark' : 'light';
          useStore.getState().setTheme(newTheme as any);
          console.log('[App] Auto-switched theme to:', newTheme);
        }
      });
      return dispose;
    }
    
    // Fallback to browser media query if Electron API not available
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      console.log('[App] System theme changed (media query) to:', e.matches ? 'dark' : 'light');
      const currentTheme = useStore.getState().theme;
      if (currentTheme === 'alpha' || currentTheme === 'standard') {
        const newTheme = e.matches ? 'dark' : 'light';
        useStore.getState().setTheme(newTheme as any);
        console.log('[App] Auto-switched theme to:', newTheme);
      }
    };
    
    console.log('[App] System prefers dark mode (media query):', mediaQuery.matches);
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  // Signal to main process that app is fully ready (for "Open With" file handling)
  useEffect(() => {
    const signalReady = async () => {
      console.log('[App] Signaling ready to main process');
      try {
        await window.electronAPI?.app?.ready();
        console.log('[App] Main process acknowledged ready signal');
      } catch (error) {
        console.error('[App] Failed to signal ready:', error);
      }
    };
    
    // Signal ready after a short delay to ensure everything is initialized
    const timer = setTimeout(signalReady, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Handle window resize to adjust panel sizes if they exceed new window bounds
  useEffect(() => {
    const handleResize = () => {
      console.log('[Resize Debug] Window resize detected:', JSON.stringify({
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        sidebarWidth: sidebarWidth,
        chatWidth: chatWidth,
        sidebarVisible: sidebarVisible,
        chatVisible: chatVisible
      }, null, 2));
      
      // Check if current panel widths exceed the new window width limitations
      // When both panels are visible, they shouldn't exceed half the window width each
      const minSidebarWidth = 200; // Same as the minimum in calculateMinWidth
      const minChatWidth = 250;    // Same as the minimum in calculateMinWidth
      const maxAllowedSidebarWidth = chatVisible ? Math.max(window.innerWidth / 2, minSidebarWidth) : Math.max(window.innerWidth * 0.95, minSidebarWidth);
      const maxAllowedChatWidth = sidebarVisible ? Math.max(window.innerWidth / 2, minChatWidth) : Math.max(window.innerWidth * 0.95, minChatWidth);

      console.log('[Resize Debug] Calculated max allowed widths:', JSON.stringify({
        maxAllowedSidebarWidth,
        maxAllowedChatWidth
      }, null, 2));

      if (sidebarWidth > maxAllowedSidebarWidth) {
        console.log('[Resize Debug] Sidebar too wide, resizing from', sidebarWidth, 'to', maxAllowedSidebarWidth);
        setSidebarWidth(maxAllowedSidebarWidth);
      }

      if (chatWidth > maxAllowedChatWidth) {
        console.log('[Resize Debug] Chat panel too wide, resizing from', chatWidth, 'to', maxAllowedChatWidth);
        setChatWidth(maxAllowedChatWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    // Call once on mount to handle initial sizing
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarWidth, chatWidth, setSidebarWidth, setChatWidth, sidebarVisible, chatVisible]);

  // Handle Escape key to close panels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sidebarVisible) {
          useStore.getState().toggleSidebar();
        }
        if (chatVisible) {
          useStore.getState().toggleChat();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarVisible, chatVisible]);

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
      // Ctrl+Q or Cmd+Q to quit current window (with unsaved changes check)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        console.log('[App] Ctrl+Q pressed, closing current window');
        // Trigger the close dialog if there are unsaved changes
        if (hasUnsavedChanges) {
          window.dispatchEvent(new CustomEvent('app:request-close-current'));
        } else {
          // No unsaved changes, close current window only
          window.electronAPI?.app?.closeCurrentWindow();
        }
      }
      // Ctrl+F or Cmd+F - Find (let Monaco handle it, but ensure editor is focused)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // Don't prevent default - let Monaco handle it
        // But dispatch event to focus the editor
        window.dispatchEvent(new CustomEvent('canvas:focus-editor'));
      }
      // Ctrl+H or Cmd+H - Replace (let Monaco handle it)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        // Don't prevent default - let Monaco handle it
        // But dispatch event to focus the editor
        window.dispatchEvent(new CustomEvent('canvas:focus-editor'));
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

    // Calculate dynamic minimum width based on window size
    const calculateMinWidth = (panelType: 'sidebar' | 'chat') => {
      // Base minimum width
      let baseMinWidth = panelType === 'sidebar' ? 200 : 250;

      // Scale minimum width based on window width to ensure usability
      const minWindowWidthForFullSize = 800; // Minimum window width for full panel sizes
      if (window.innerWidth < minWindowWidthForFullSize) {
        // Scale down the minimum width proportionally for smaller windows
        const scaleRatio = Math.max(0.5, window.innerWidth / minWindowWidthForFullSize); // Don't scale below 50%
        baseMinWidth = Math.max(panelType === 'sidebar' ? 150 : 200, Math.floor(baseMinWidth * scaleRatio)); // Higher minimums: 150px for sidebar, 200px for chat
      }

      return baseMinWidth;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !resizeType.current) return;

      const deltaX = resizeType.current === 'sidebar'
        ? e.clientX - startX.current
        : startX.current - e.clientX; // Reverse for chat panel

      console.log('[Resize Debug] Mouse move during resize:', JSON.stringify({
        resizeType: resizeType.current,
        clientX: e.clientX,
        startX: startX.current,
        deltaX,
        startWidth: startWidth.current,
        windowWidth: window.innerWidth,
        sidebarVisible,
        chatVisible
      }, null, 2));

      // Calculate the new width considering the space taken by other panel
      let newWidth = startWidth.current + deltaX;
      
      // Apply minimum and maximum constraints
      const minWidth = calculateMinWidth(resizeType.current);
      // Allow panels to go almost to full window width
      const maxWidth = window.innerWidth * 0.98; // Allow up to 98% of window width

      console.log('[Resize Debug] Initial width calculation:', JSON.stringify({
        startWidth: startWidth.current,
        deltaX,
        calculatedNewWidth: newWidth,
        minWidth,
        maxWidth
      }, null, 2));
      
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      
      // Additional constraint: ensure panels don't overlap or extend beyond window
      if (resizeType.current === 'sidebar') {
        // When resizing sidebar, ensure there's enough room for chat panel if visible
        if (chatVisible) {
          const minSpaceForChat = calculateMinWidth('chat');
          const maxSidebarWidth = window.innerWidth - minSpaceForChat - 10; // Reduced buffer to 10px
          console.log('[Resize Debug] Sidebar resize with chat visible:', JSON.stringify({
            minSpaceForChat,
            maxSidebarWidth,
            currentNewWidth: newWidth
          }, null, 2));
          newWidth = Math.min(newWidth, maxSidebarWidth);
        }
      } else {
        // When resizing chat panel, ensure there's enough room for sidebar if visible
        if (sidebarVisible) {
          const minSpaceForSidebar = calculateMinWidth('sidebar');
          const maxChatWidth = window.innerWidth - minSpaceForSidebar - 10; // Reduced buffer to 10px
          console.log('[Resize Debug] Chat resize with sidebar visible:', JSON.stringify({
            minSpaceForSidebar,
            maxChatWidth,
            currentNewWidth: newWidth
          }, null, 2));
          newWidth = Math.min(newWidth, maxChatWidth);
        }
      }

      console.log('[Resize Debug] Final width after constraints:', JSON.stringify({
        resizeType: resizeType.current,
        finalWidth: newWidth
      }, null, 2));

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
          <main className="app-main h-full w-full flex-1 relative z-0">
            <Canvas />
          </main>

          {/* Floating sidebar panel */}
          <aside
            className={`sidebar-panel ${sidebarVisible ? 'sidebar-visible' : ''}`}
            style={{ width: `${sidebarWidth}px` }}
          >
            <div
              className="absolute top-0 bottom-0 right-0 w-1 cursor-col-resize z-[100] hover:bg-accent/50 active:bg-accent transition-colors"
              onMouseDown={(e) => startResize(e, 'sidebar')}
            />
            <Sidebar />
          </aside>

          {/* Floating chat panel */}
          <aside
            className={`chat-panel ${chatVisible ? 'chat-visible' : ''}`}
            style={{ width: `${chatWidth}px` }}
          >
            {/*
                Increased z-index to 100 to ensure it's above panel content.
                Increased width to 6px (w-1.5) and adjusted left position to -3px for better grab area.
            */}
            <div
              className="absolute top-0 bottom-0 -left-[3px] w-1.5 cursor-col-resize z-[100] hover:bg-accent/50 active:bg-accent transition-colors"
              onMouseDown={(e) => startResize(e, 'chat')}
            />
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

        {/* Unsaved changes warning dialog */}
        <UnsavedChangesDialog
          isOpen={showCloseDialog}
          onClose={handleCancelClose}
          onConfirmClose={handleCloseWithoutSaving}
          onSave={handleSaveBeforeClose}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
