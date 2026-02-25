import { Menu, MessageSquare, Settings, Command, ChevronDown, FilePlus, FolderOpen, Save, LogOut, SquareSplitHorizontal } from 'lucide-react';
import { useStore } from '../store';
import { useEffect, useState, useRef } from 'react';

export default function Header() {
  const { toggleSidebar, toggleChat, setShowSettings, panes, saveFile, createNewFile } = useStore();
  const [iconUrl, setIconUrl] = useState<string>('/icon.png');
  const [iconError, setIconError] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check for unsaved changes
  const hasUnsavedChanges = panes.some(p => p.isUnsaved);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  useEffect(() => {
    // Try to load icon from Electron API, but default to Vite public directory
    const loadIcon = async () => {
      if (window.electronAPI?.getAppAssetPath) {
        try {
          const result = await window.electronAPI.getAppAssetPath('icon.png');
          console.log('[Header] Got icon path:', result.url);
          // Test if the file URL works by creating an Image object
          const testImg = new Image();
          testImg.onload = () => {
            console.log('[Header] file:// URL works, using:', result.url);
            setIconUrl(result.url);
            setIconError(false);
          };
          testImg.onerror = (err) => {
            console.warn('[Header] file:// URL failed, using /icon.png instead:', err);
            setIconUrl('/icon.png');
            setIconError(false);
          };
          testImg.src = result.url;
        } catch (error) {
          console.error('[Header] getAppAssetPath failed:', error);
          setIconUrl('/icon.png');
        }
      }
    };

    loadIcon();
  }, []);

  const handleCommandPalette = () => {
    // Dispatch event to trigger command palette in editor
    window.dispatchEvent(new CustomEvent('trigger-command-palette'));
  };

  const handleNewFile = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    console.log('[Header] Creating new file');
    createNewFile();
    // Close dropdown after a short delay to ensure action completes
    setTimeout(() => setShowDropdown(false), 100);
  };

  const handleOpenFile = async () => {
    if (window.electronAPI?.showOpenDialog) {
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Code Files', extensions: ['ts', 'tsx', 'js', 'jsx', 'py'] },
          { name: 'Markdown', extensions: ['md'] },
        ],
      });
      if (!result.canceled && result.filePaths?.length > 0) {
        useStore.getState().openFileByPath(result.filePaths[0]);
      }
    }
    setShowDropdown(false);
  };

  const handleSaveFile = async () => {
    const { activePaneId } = useStore.getState();
    if (activePaneId) {
      await saveFile(activePaneId);
    }
    setShowDropdown(false);
  };

  const handleExit = () => {
    // Exit only the current window (not all windows like tray exit)
    if (hasUnsavedChanges) {
      // Dispatch event to show close dialog for current window
      window.dispatchEvent(new CustomEvent('app:request-close-current'));
    } else {
      // No unsaved changes, close current window only
      window.electronAPI?.app?.closeCurrentWindow();
    }
    setShowDropdown(false);
  };

  const handleNewWindow = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    console.log('[Header] Creating new window');
    try {
      await window.electronAPI?.app?.newWindow();
      console.log('[Header] New window created');
    } catch (error) {
      console.error('[Header] Failed to create new window:', error);
    }
    // Close dropdown after a short delay
    setTimeout(() => setShowDropdown(false), 100);
  };

  return (
    <header
      className="h-7 backdrop-blur-sm border-b flex items-center justify-between px-2 shrink-0 z-30 transition-colors"
      style={{ backgroundColor: 'var(--header-bg)', borderColor: 'var(--border-color)' }}
    >
      {/* Left side - File menu and sidebar toggle (no logo) */}
      <div className="flex items-center gap-1.5">
        {/* File menu dropdown toggle */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            data-tooltip="File Menu"
            data-tooltip-position="bottom"
            data-tooltip-align="left"
            className={`p-1 rounded hover:bg-white/10 transition-colors text-muted hover:text-foreground ${showDropdown ? 'bg-white/10' : ''}`}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown menu */}
          {showDropdown && (
            <div
              className="absolute top-full left-0 mt-1 min-w-[200px] py-1 rounded-lg shadow-xl border backdrop-blur-md z-50"
              style={{
                backgroundColor: 'var(--bg-primary, rgba(15, 23, 42, 0.98))',
                borderColor: 'var(--border-color, rgba(255, 255, 255, 0.1))',
              }}
            >
              {/* New File */}
              <button
                onClick={handleNewFile}
                className="w-full px-4 py-1.5 flex items-center gap-3 text-xs hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-primary, #f8fafc)' }}
              >
                <FilePlus className="h-3.5 w-3.5" style={{ color: 'var(--accent-color, #0ea5e9)' }} />
                <span> File</span>
                <span className="ml-auto text-[10px] opacity-50">Ctrl+N</span>
              </button>

              {/* Open File */}
              <button
                onClick={handleOpenFile}
                className="w-full px-4 py-1.5 flex items-center gap-3 text-xs hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-primary, #f8fafc)' }}
              >
                <FolderOpen className="h-3.5 w-3.5" style={{ color: 'var(--accent-color, #0ea5e9)' }} />
                <span>Open File...</span>
                <span className="ml-auto text-[10px] opacity-50">Ctrl+O</span>
              </button>

              {/* Save */}
              <button
                onClick={handleSaveFile}
                className="w-full px-4 py-1.5 flex items-center gap-3 text-xs hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-primary, #f8fafc)' }}
              >
                <Save className="h-3.5 w-3.5" style={{ color: hasUnsavedChanges ? '#22c55e' : 'var(--text-muted, #94a3b8)' }} />
                <span>Save</span>
                <span className="ml-auto text-[10px] opacity-50">Ctrl+S</span>
              </button>

              {/* New Window */}
              <button
                onClick={handleNewWindow}
                className="w-full px-4 py-1.5 flex items-center gap-3 text-xs hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-primary, #f8fafc)' }}
              >
                <SquareSplitHorizontal className="h-3.5 w-3.5" style={{ color: 'var(--accent-color, #0ea5e9)' }} />
                <span> Window</span>
                <span className="ml-auto text-[10px] opacity-50">Shift+Ctrl+N</span>
              </button>

              {/* Divider */}
              <div className="my-1 border-t" style={{ borderColor: 'var(--border-color, rgba(255, 255, 255, 0.1))' }} />

              {/* Exit */}
              <button
                onClick={handleExit}
                className="w-full px-4 py-1.5 flex items-center gap-3 text-xs hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-primary, #f8fafc)' }}
              >
                <LogOut className="h-3.5 w-3.5" style={{ color: '#ef4444' }} />
                <span>Exit</span>
                <span className="ml-auto text-[10px] opacity-50">Ctrl+Q</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          data-tooltip="Toggle Explorer"
          data-tooltip-position="bottom"
          data-tooltip-align="left"
          className="p-1 rounded hover:bg-white/10 transition-colors text-muted hover:text-foreground"
        >
          <Menu className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Centered App Icon - Full color, original size */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
        <img
          src={iconUrl}
          alt="CandyCode"
          className="h-5 w-5 object-contain"
          onError={(e) => {
            console.error('[Header] Centered icon failed to load:', iconUrl);
            setIconError(true);
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230ea5e9"/><text x="50" y="55" text-anchor="middle" fill="white" font-size="12" font-family="sans-serif">CC</text></svg>';
          }}
        />
      </div>

      <div className="flex items-center gap-1.5 nav-icons">
        <button
          onClick={toggleChat}
          data-tooltip="Toggle Chat"
          data-tooltip-position="bottom"
          className="p-1 rounded hover:bg-white/10 transition-colors text-muted hover:text-foreground"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          data-tooltip="Settings"
          data-tooltip-position="bottom"
          data-tooltip-align="right"
          className="p-1 rounded hover:bg-white/10 transition-colors text-muted hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
