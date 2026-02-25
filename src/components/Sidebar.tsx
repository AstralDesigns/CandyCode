import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Folder, 
  File, 
  FolderOpen, 
  Home, 
  FolderTree,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Video,
  FileText,
  Code as CodeIcon,
  X,
  Plus,
  Trash,
  Copy,
  ExternalLink,
  Type,
  Search,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../store';
import { useFileSystem, FileSystemItem } from '../services/file-system.service';
import ContextMenu from './ContextMenu';
import Dropdown from './ui/Dropdown';

export default function Sidebar() {
  const [mode, setMode] = useState<'files' | 'project'>('files');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [projectSearchResults, setProjectSearchResults] = useState<FileSystemItem[]>([]);
  const [isSearchingProject, setIsSearchingProject] = useState(false);
  
  const [renameDialog, setRenameDialog] = useState<{ item: FileSystemItem | null; newName: string }>({ item: null, newName: '' });
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderChildren, setFolderChildren] = useState<Map<string, FileSystemItem[]>>(new Map());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  
  // Use selectors for store to minimize re-renders
  const openFileByPath = useStore(state => state.openFileByPath);
  const pendingDiffs = useStore(state => state.pendingDiffs);
  const acceptedDiffs = useStore(state => state.acceptedDiffs);
  const addContextFile = useStore(state => state.addContextFile);
  const addContextImage = useStore(state => state.addContextImage);
  
  // Use selectors for file system to minimize re-renders
  const showDotfiles = useFileSystem(state => state.showDotfiles);
  const refreshDirectory = useFileSystem(state => state.refreshDirectory);
  const directoryContent = useFileSystem(state => state.directoryContent);
  const navigateTo = useFileSystem(state => state.navigateTo);
  const goHome = useFileSystem(state => state.goHome);
  const navigateBack = useFileSystem(state => state.navigateBack);
  const navigateForward = useFileSystem(state => state.navigateForward);
  const navigateUp = useFileSystem(state => state.navigateUp);
  const canNavigateBack = useFileSystem(state => state.canNavigateBack);
  const canNavigateForward = useFileSystem(state => state.canNavigateForward);
  const toggleDotfiles = useFileSystem(state => state.toggleDotfiles);
  const getBreadcrumbs = useFileSystem(state => state.getBreadcrumbs);

  // Use refs to avoid dependency loops in loadFolderChildren and invalidateFoldersForFiles
  const folderChildrenRef = useRef(folderChildren);
  const loadingFoldersRef = useRef(loadingFolders);
  folderChildrenRef.current = folderChildren;
  loadingFoldersRef.current = loadingFolders;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProjectLoadingRef = useRef(false); // Prevent race conditions

  // Helper to normalize paths for comparison
  const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');

  // Handle project search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!projectSearchTerm.trim() || !projectRoot) {
      setProjectSearchResults([]);
      setIsSearchingProject(false);
      return;
    }

    setIsSearchingProject(true);
    
    searchTimeoutRef.current = setTimeout(async () => {
      if (window.electronAPI?.findFiles) {
        try {
          const results = await window.electronAPI.findFiles(projectRoot, projectSearchTerm);
          // Only update if the query hasn't changed (though cleanup usually handles this, tracking IDs is safer)
          setProjectSearchResults(results);
        } catch (error) {
          console.error('Project search error:', error);
          setProjectSearchResults([]);
        } finally {
          setIsSearchingProject(false);
        }
      } else {
        setIsSearchingProject(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [projectSearchTerm, projectRoot]);

  // Load children for a folder (on-demand)
  const loadFolderChildren = useCallback(async (folderPath: string, force = false) => {
    const normalizedPath = normalizePath(folderPath);
    
    if (!force && (folderChildrenRef.current.has(normalizedPath) || loadingFoldersRef.current.has(normalizedPath))) {
      return; // Already loaded or loading
    }

    if (!window.electronAPI) {
      return;
    }

    setLoadingFolders((prev) => new Set(prev).add(normalizedPath));

    try {
      let resolvedPath = normalizedPath;
      if (normalizedPath === '~' || normalizedPath.startsWith('~/')) {
        if (window.electronAPI.getSystemInfo) {
          const info = await window.electronAPI.getSystemInfo();
          resolvedPath = normalizedPath.replace(/^~/, info.homeDir || '~');
        }
      }

      const result = await window.electronAPI.readDirectory(resolvedPath);
      if ('error' in result) {
        console.error(`Error loading folder ${normalizedPath}:`, result.error);
        setFolderChildren((prev) => new Map(prev).set(normalizedPath, []));
      } else {
        // Filter dotfiles based on showDotfiles setting
        const filtered = showDotfiles
          ? result
          : result.filter((item: FileSystemItem) => !item.name.startsWith('.'));
        setFolderChildren((prev) => new Map(prev).set(normalizedPath, filtered));
      }
    } catch (error) {
      console.error(`Error loading folder ${normalizedPath}:`, error);
      setFolderChildren((prev) => new Map(prev).set(normalizedPath, []));
    } finally {
      setLoadingFolders((prev) => {
        const next = new Set(prev);
        next.delete(normalizedPath);
        return next;
      });
    }
  }, [showDotfiles]);

  // Initialize file system
  useEffect(() => {
    refreshDirectory();
  }, [refreshDirectory]);

  // Load root folder children when project is opened and root is expanded
  useEffect(() => {
    if (projectRoot && expandedFolders.has(projectRoot)) {
      loadFolderChildren(projectRoot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectRoot, expandedFolders, loadFolderChildren]);

  // Helper function to invalidate and refresh folders containing changed files
  const invalidateFoldersForFiles = useCallback((filePaths: string[]) => {
    if (!projectRoot) return;
    
    const normalizedRoot = normalizePath(projectRoot);
    const foldersToInvalidate = new Set<string>();
    
    filePaths.forEach((filePath) => {
      const normalizedFilePath = normalizePath(filePath);
      
      // Only process if file is within project root
      if (normalizedFilePath.startsWith(normalizedRoot)) {
        const parentDir = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'));
        if (parentDir && parentDir.length >= normalizedRoot.length) {
          foldersToInvalidate.add(parentDir);
        }
        // Always invalidate project root if any file changes
        foldersToInvalidate.add(normalizedRoot);
      }
    });

    if (foldersToInvalidate.size === 0) return;

    // Invalidate cached folders in one go
    setFolderChildren((prev) => {
      const newMap = new Map(prev);
      foldersToInvalidate.forEach(folderPath => newMap.delete(folderPath));
      return newMap;
    });

    // Reload if folder is currently expanded or is root
    foldersToInvalidate.forEach((folderPath) => {
      if (folderPath === normalizedRoot || expandedFolders.has(folderPath)) {
        loadFolderChildren(folderPath, true); // Force reload
      }
    });
  }, [projectRoot, expandedFolders, loadFolderChildren]);

  // Refresh project tree when pending diffs change (files written by agent)
  useEffect(() => {
    if (projectRoot && pendingDiffs.size > 0) {
      const changedFiles = Array.from(pendingDiffs.keys());
      invalidateFoldersForFiles(changedFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDiffs.size, projectRoot, invalidateFoldersForFiles]);

  // Refresh project tree when files are accepted (written to disk)
  useEffect(() => {
    if (projectRoot && acceptedDiffs.size > 0) {
      const changedFiles = Array.from(acceptedDiffs);
      invalidateFoldersForFiles(changedFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedDiffs.size, projectRoot, invalidateFoldersForFiles]);

  // Filter content based on search
  const filteredContent = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const content = directoryContent;
    if (!term) return content;
    return content.filter((item) => item.name.toLowerCase().includes(term));
  }, [searchTerm, directoryContent]);

  const handleItemClick = (item: FileSystemItem) => {
    if (item.type === 'folder') {
      if (mode === 'files') {
        navigateTo(item.path);
      } else {
        // Project mode - toggle expansion
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(item.path)) {
          newExpanded.delete(item.path);
        } else {
          newExpanded.add(item.path);
        }
        setExpandedFolders(newExpanded);
      }
    } else {
      openFileByPath(item.path);
      if (window.innerWidth < 1024) {
        useStore.getState().toggleSidebar();
      }
    }
  };

  const openProject = useCallback(async (projectPath: string, skipSave = false) => {
    const { setProjectContext, setIsBuildingContext } = useStore.getState();
    if (!window.electronAPI) return;

    // Prevent race conditions - only one project load at a time
    if (isProjectLoadingRef.current) {
      console.log('[Sidebar] Project already loading, skipping:', projectPath);
      return;
    }

    const normalizedPath = normalizePath(projectPath);

    // Check if this project is already open
    if (projectRoot === normalizedPath && mode === 'project') {
      console.log('[Sidebar] Project already open:', normalizedPath);
      return;
    }

    isProjectLoadingRef.current = true;
    console.log('[Sidebar] Opening project:', normalizedPath);

    try {
      setProjectRoot(normalizedPath);
      setMode('project');
      setExpandedFolders(new Set([normalizedPath])); // Auto-expand root

      // Build project context
      setIsBuildingContext(true);
      setProjectContext(normalizedPath);

      setIsBuildingContext(false);

      // Load root folder contents immediately
      await loadFolderChildren(normalizedPath, true);

      // Notify main process to save this as the last opened project
      // Skip if this is being called from the initial load
      if (!skipSave) {
        await window.electronAPI.project.setCurrent(normalizedPath);
      }

      console.log('[Sidebar] Project opened successfully:', normalizedPath);
    } catch (error) {
      console.error('[Sidebar] Failed to open project:', error);
    } finally {
      isProjectLoadingRef.current = false;
    }
  }, [loadFolderChildren, projectRoot, mode]);

  const handleOpenProject = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Project',
    });
      if (!result.canceled && result.filePaths.length > 0) {
        await openProject(result.filePaths[0]);
      }
  };

  const handleRemoveProject = useCallback(() => {
    isProjectLoadingRef.current = false;
    setProjectRoot(null);
    useStore.getState().setProjectContext(null);
    setExpandedFolders(new Set());
    setFolderChildren(new Map());
    setLoadingFolders(new Set());
    // Notify main process that no project is open
    window.electronAPI.project.setCurrent(null);
  }, []);

  // Listen for project:load-path from main process
  useEffect(() => {
    console.log('[Sidebar] Setting up project:load-path listener');
    if (window.electronAPI?.project?.onLoadPath) {
      const dispose = window.electronAPI.project.onLoadPath((projectPath: string) => {
        console.log('[Sidebar] Received project:load-path:', projectPath);
        // skipSave=true because this is called from setCurrent which already saves
        openProject(projectPath, true);
      });
      return () => {
        console.log('[Sidebar] Disposing project:load-path listener');
        dispose();
      };
    } else {
      console.warn('[Sidebar] project.onLoadPath not available');
    }
  }, [openProject]);

  // On mount, check if there's a last opened project to load
  useEffect(() => {
    console.log('[Sidebar] Mount effect running, projectRoot:', projectRoot, 'mode:', mode);
    const checkLastProject = async () => {
      // Wait a bit for the component to fully mount
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('[Sidebar] Checking for last project...');
      console.log('[Sidebar] State check - projectRoot:', projectRoot, 'isLoading:', isProjectLoadingRef.current);
      console.log('[Sidebar] API check - getCurrent:', !!window.electronAPI?.project?.getCurrent);

      if (!projectRoot && !isProjectLoadingRef.current && window.electronAPI?.project?.getCurrent) {
        try {
          const lastProjectPath = await window.electronAPI.project.getCurrent();
          console.log('[Sidebar] Got lastProjectPath:', lastProjectPath);
          if (lastProjectPath) {
            console.log('[Sidebar] Opening last project:', lastProjectPath);
            // skipSave=true because we're just restoring state, not changing it
            openProject(lastProjectPath, true);
          } else {
            console.log('[Sidebar] No last project found');
          }
        } catch (error) {
          console.error('[Sidebar] Error getting last project:', error);
        }
      } else {
        console.log('[Sidebar] Skipping project load - conditions not met');
      }
    };
    checkLastProject();
  }, []); // Empty deps - only run once on mount

  // Handle generic file system events
  const handleFileSystemEvent = useCallback((type: 'created' | 'deleted' | 'renamed', data: any) => {
    let pathsToInvalidate: string[] = [];
    
    if (type === 'renamed') {
      pathsToInvalidate = [data.oldPath, data.newPath];
    } else {
      pathsToInvalidate = [data.path];
    }
    
    // Resolve absolute paths if they are relative
    if (projectRoot) {
      pathsToInvalidate = pathsToInvalidate.map(p => {
        let normalized = normalizePath(p);
        if (!normalized.startsWith('/') && !normalized.startsWith('~') && !normalized.includes(':')) {
           // Relative path
           return `${projectRoot}/${normalized}`;
        }
        return normalized;
      });
    }

    console.log(`[Sidebar] File ${type}:`, pathsToInvalidate);
    
    // Update Project View - update tree even if not in project mode
    if (projectRoot) {
      invalidateFoldersForFiles(pathsToInvalidate);
    }
    
    // Update Files View - always refresh
    refreshDirectory();
  }, [projectRoot, invalidateFoldersForFiles, refreshDirectory]);

  // Hook up event listeners with proper cleanup
  // We use a ref to store the stable handler to avoid re-binding unnecessarily
  const handleFileSystemEventRef = useRef(handleFileSystemEvent);
  handleFileSystemEventRef.current = handleFileSystemEvent;

  useEffect(() => {
    if (!window.electronAPI?.on) return;
    
    const onCreated = (_: any, data: any) => handleFileSystemEventRef.current('created', data);
    const onDeleted = (_: any, data: any) => handleFileSystemEventRef.current('deleted', data);
    const onRenamed = (_: any, data: any) => handleFileSystemEventRef.current('renamed', data);
    
    window.electronAPI.on('file-system:created', onCreated);
    window.electronAPI.on('file-system:deleted', onDeleted);
    window.electronAPI.on('file-system:renamed', onRenamed);
    
    return () => {
      window.electronAPI.off('file-system:created', onCreated);
      window.electronAPI.off('file-system:deleted', onDeleted);
      window.electronAPI.off('file-system:renamed', onRenamed);
    };
  }, []); // Empty dependency array as we use ref

  // Handle rename with useCallback to fix React hook error
  const handleRename = useCallback(async () => {
    if (!renameDialog.item || !renameDialog.newName.trim() || renameDialog.newName === renameDialog.item.name) return;
    
    if (!window.electronAPI?.renameFile) return;
    
    try {
      const result = await window.electronAPI.renameFile(renameDialog.item.path, renameDialog.newName.trim());
      if (result.success) {
        setRenameDialog({ item: null, newName: '' });
        
        // Always refresh Files view
        refreshDirectory();
        
        // For project mode, manual invalidation helps perceived speed
        // Update it regardless of current mode, so it's ready when switching
        if (projectRoot) {
           const oldPath = renameDialog.item.path;
           const parentDir = oldPath.split('/').slice(0, -1).join('/');
           const newPath = parentDir ? `${parentDir}/${renameDialog.newName.trim()}` : renameDialog.newName.trim();
           invalidateFoldersForFiles([oldPath, newPath]);
        }
      } else {
        alert(`Failed to rename: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  }, [renameDialog, projectRoot, refreshDirectory, invalidateFoldersForFiles]);

  // Handle Copy/Move actions
  const handleTransfer = async (item: FileSystemItem, action: 'copy' | 'move') => {
    if (!window.electronAPI?.showOpenDialog) return;

    try {
      // Select destination folder
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openDirectory'],
        title: action === 'copy' ? 'Copy to...' : 'Move to...'
      });

      if (result.canceled || result.filePaths.length === 0) return;

      const destFolder = normalizePath(result.filePaths[0]);
      const fileName = item.path.split(/[/\\]/).pop() || item.name;
      const destPath = `${destFolder}/${fileName}`;

      // Execute action
      let response;
      if (action === 'copy') {
        response = await window.electronAPI.copyFile(item.path, destPath);
      } else {
        response = await window.electronAPI.moveFile(item.path, destPath);
      }

      if (!response.success) {
        console.error(`Failed to ${action} file:`, response.error);
        alert(`Failed to ${action} file: ${response.error}`);
        return;
      }

      // Always Refresh Files view
      refreshDirectory();

      // Refresh Project view if applicable
      if (projectRoot) {
        const filesToInvalidate: string[] = [];
        
        // 1. Destination (always invalidate if inside project)
        if (destPath.startsWith(projectRoot)) {
           filesToInvalidate.push(destPath);
        }
        
        // 2. Source (invalidate parent if inside project - mostly for move)
        if (action === 'move' && item.path.startsWith(projectRoot)) {
           filesToInvalidate.push(item.path);
        }
        
        if (filesToInvalidate.length > 0) {
           invalidateFoldersForFiles(filesToInvalidate);
        }
      }

    } catch (error) {
      console.error(`Error during ${action}:`, error);
      alert(`Error during ${action}: ${error}`);
    }
  };

  const handleRightClick = async (e: React.MouseEvent, item: FileSystemItem) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmd = isMac ? '⌘' : 'Ctrl+';

    const items = [
      { 
        label: 'Open', 
        icon: <ExternalLink size={14} />, 
        onClick: () => openFileByPath(item.path) 
      },
      {
        label: 'Add to Context',
        icon: <Plus size={14} />,
        onClick: async () => {
          const extension = item.name.split('.').pop()?.toLowerCase() || '';
          const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'];

          if (imageExtensions.includes(extension) && extension !== 'svg') {
            // Use file:// URL for images
            addContextImage({ path: item.path, data: `file://${item.path}` });
          } else if (window.electronAPI?.readFile) {
            try {
              const result = await window.electronAPI.readFile(item.path);
              if (result.content && !result.error) {
                addContextFile({ path: item.path, content: result.content });
              }
            } catch (error) {
              console.error('Failed to add to context:', error);
            }
          }
        }
      },
      { divider: true },
      { 
        label: 'Copy Path', 
        icon: <Copy size={14} />, 
        shortcut: `${cmd}⇧C`,
        onClick: () => navigator.clipboard.writeText(item.path) 
      },
      { 
        label: 'Copy to...', 
        icon: <Copy size={14} />, 
        onClick: () => handleTransfer(item, 'copy') 
      },
      { 
        label: 'Move to...', 
        icon: <ArrowRight size={14} />, 
        onClick: () => handleTransfer(item, 'move') 
      },
      { divider: true },
      { 
        label: 'Rename', 
        icon: <Type size={14} />, 
        onClick: () => {
          setRenameDialog({ item, newName: item.name });
        }
      },
      { 
        label: 'Delete', 
        icon: <Trash size={14} />, 
        shortcut: 'Del',
        onClick: async () => {
          if (window.electronAPI?.trashFile) {
            await window.electronAPI.trashFile(item.path);
            
            // Immediate refresh for Files view
            refreshDirectory();
            
            // Immediate refresh for Project view if applicable
            if (projectRoot && item.path.startsWith(projectRoot)) {
               invalidateFoldersForFiles([item.path]);
            }
          }
        }
      },
    ];

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const getIconForFile = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
      return 'image';
    }
    if (['mp4', 'webm', 'mov', 'mkv'].includes(extension)) {
      return 'video';
    }
    if (['ts', 'js', 'html', 'css', 'scss', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(extension)) {
      return 'code';
    }
    if (extension === 'json') {
      return 'json';
    }
    if (extension === 'md') {
      return 'markdown';
    }
    return 'default';
  };

  const renderFileIcon = (item: FileSystemItem) => {
    if (item.type === 'folder') {
      return <Folder className="w-4 h-4 text-accent shrink-0" />;
    }
    
    const iconType = getIconForFile(item.name);
    
    switch (iconType) {
      case 'image':
        return <ImageIcon className="w-4 h-4 shrink-0 text-accent" />;
      case 'video':
        return <Video className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'code':
        return <CodeIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'json':
        return <FileText className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'markdown':
        return <FileText className="w-4 h-4 text-muted shrink-0" />;
      default:
        return <File className="w-4 h-4 text-muted shrink-0" />;
    }
  };

  // Recursive tree item component
  const TreeItem = ({ item, depth = 0 }: { item: FileSystemItem; depth?: number }) => {
    const isExpanded = expandedFolders.has(item.path);
    const hasChildren = item.type === 'folder';
    const isLoading = loadingFolders.has(item.path);
    const children = hasChildren ? (folderChildren.get(item.path) || []) : [];

    const handleToggle = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const newExpanded = new Set(expandedFolders);
      if (isExpanded) {
        newExpanded.delete(item.path);
      } else {
        newExpanded.add(item.path);
        // Load folder contents when expanding (if not already loaded)
        if (!folderChildren.has(item.path)) {
          await loadFolderChildren(item.path);
        }
      }
      setExpandedFolders(newExpanded);
    };

    const handleClick = () => {
      if (item.type === 'folder') {
        handleToggle({ stopPropagation: () => {} } as React.MouseEvent);
      } else {
        handleItemClick(item);
      }
    };

    return (
      <div>
        <div
          onClick={handleClick}
          onContextMenu={(e) => handleRightClick(e, item)}
          className="flex items-center text-xs font-medium text-foreground py-1 px-2 rounded-md hover:bg-white/10 cursor-pointer group"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          data-tooltip={item.path}
          data-tooltip-position="right"
        >
          {hasChildren && (
            <button
              onClick={handleToggle}
              className="w-3 h-3 flex items-center justify-center mr-1 hover:bg-white/10 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-2.5 h-2.5 text-muted" />
              ) : (
                <ChevronRight className="w-2.5 h-2.5 text-muted" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-3 h-3 mr-1" />}
          
          {item.type === 'folder' ? (
            isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-accent shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 mr-1.5 text-accent shrink-0" />
            )
          ) : (
            renderFileIcon(item)
          )}
          
          <span className="truncate flex-1">{item.name}</span>
          
          {/* Remove project button (only for root folder) */}
          {depth === 0 && item.path === projectRoot && (
            <button
              onClick={handleRemoveProject}
              data-tooltip="Remove project"
              data-tooltip-position="left"
              className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-rose-600/20 text-muted hover:text-rose-400 rounded transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div>
            {isLoading ? (
              <div className="text-xs text-muted px-2 py-1" style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}>
                Loading...
              </div>
            ) : children.length > 0 ? (
              children
                .sort((a, b) => {
                  // Folders first, then by name
                  if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                  }
                  return a.name.localeCompare(b.name);
                })
                .map((child) => (
                  <TreeItem key={child.path} item={child} depth={depth + 1} />
                ))
            ) : null}
          </div>
        )}
      </div>
    );
  };

  // Project mode tree view (recursive)
  const renderProjectTree = () => {
    const { contextMode, setContextMode } = useStore.getState();
    
    if (!projectRoot) {
      return (
        <div className="p-2">
          <button
            onClick={handleOpenProject}
            className="w-full px-3 py-2 text-xs bg-white/5 hover:bg-white/10 rounded border border-white/5 flex items-center gap-2 text-foreground transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Open Project
          </button>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full">
        {/* Project Header with Context Mode Selector */}
        <div className="px-2 py-1.5 border-b border-white/5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-accent shrink-0" />
            <span 
              className="text-xs font-medium text-foreground truncate" 
              data-tooltip={projectRoot}
              data-tooltip-position="bottom"
            >
              {projectRoot.split('/').pop() || projectRoot}
            </span>
          </div>
          <Dropdown
            value={contextMode}
            onChange={(val) => setContextMode(val as any)}
            options={[
              { label: 'Full', value: 'full' },
              { label: 'Smart', value: 'smart' },
              { label: 'Minimal', value: 'minimal' },
            ]}
            title="Context compression mode"
          />
        </div>

        {/* Project Search Bar */}
        <div className="px-2 py-2 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
            <input
              type="text"
              placeholder="Search in project..."
              value={projectSearchTerm}
              onChange={(e) => setProjectSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md py-1 px-2 pl-7 pr-7 text-xs text-foreground placeholder-muted focus:ring-1 focus:ring-accent focus:outline-none transition-all"
            />
            {projectSearchTerm.length > 0 && (
              <button
                onClick={() => {
                  setProjectSearchTerm('');
                  setProjectSearchResults([]);
                  setIsSearchingProject(false);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10 text-muted hover:text-foreground transition-colors"
                data-tooltip="Clear search"
                data-tooltip-position="bottom"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>
        
        {/* Project Content (Tree or Search Results) */}
        <div className="flex-1 overflow-y-auto">
          {projectSearchTerm ? (
            // Search Results View
            <div className="p-2 space-y-0.5">
              {isSearchingProject ? (
                <div className="text-xs text-muted text-center py-2">Searching...</div>
              ) : projectSearchResults.length > 0 ? (
                projectSearchResults.map((item) => (
                  <div
                    key={item.path}
                    onClick={() => handleItemClick(item)}
                    onContextMenu={(e) => handleRightClick(e, item)}
                    className="flex items-center text-xs font-medium text-foreground py-1.5 px-2 rounded-md hover:bg-white/10 cursor-pointer"
                    data-tooltip={item.path}
                    data-tooltip-position="right"
                  >
                    {renderFileIcon(item)}
                    <span className="ml-2 truncate">{item.name}</span>
                    <span className="ml-auto text-[10px] text-muted opacity-50 truncate max-w-[80px]">
                      {/* Handle normalized paths for display, ensuring cross-platform compatibility */}
                      {item.path.replace(projectRoot.replace(/\\/g, '/'), '').split('/').slice(0, -1).join('/')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted text-center py-2">No matches found</div>
              )}
            </div>
          ) : (
            // Tree View
            (() => {
              const rootItem: FileSystemItem = {
                name: projectRoot.split('/').pop() || projectRoot,
                path: projectRoot,
                type: 'folder',
              };

              return (
                <div className="p-2 space-y-0.5">
                  <TreeItem item={rootItem} depth={0} />
                </div>
              );
            })()
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      {/* Mode toggle */}
      <div className="p-2 border-b border-white/5 flex-shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setMode('files')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
              mode === 'files'
                ? 'text-white shadow-lg'
                : 'bg-white/5 text-muted hover:bg-white/10'
            }`}
            style={mode === 'files' ? {
              background: 'var(--accent-gradient)'
            } : {}}
          >
            <Home className="w-3 h-3 inline mr-1" />
            Files
          </button>
          <button
            onClick={() => setMode('project')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
              mode === 'project'
                ? 'text-white shadow-lg'
                : 'bg-white/5 text-muted hover:bg-white/10'
            }`}
            style={mode === 'project' ? {
              background: 'var(--accent-gradient)'
            } : {}}
          >
            <FolderTree className="w-3 h-3 inline mr-1" />
            Project
          </button>
        </div>
      </div>

      {mode === 'files' ? (
        <>
          {/* Search */}
          <div className="relative px-2 pb-2 pt-2.5 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md py-1.5 px-2 pl-7 pr-7 text-xs text-foreground placeholder-muted focus:ring-1 focus:ring-accent focus:outline-none transition-all"
              />
              {searchTerm.length > 0 && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10 text-muted hover:text-foreground transition-colors"
                  data-tooltip="Clear search"
                  data-tooltip-position="bottom"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1 px-2 pb-2 flex-shrink-0">
            <button
              onClick={() => goHome()}
              data-tooltip="Go to home directory"
              data-tooltip-position="bottom"
              data-tooltip-align="left"
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted hover:text-foreground"
            >
              <Home className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigateBack()}
              disabled={!canNavigateBack()}
              data-tooltip="Go back"
              data-tooltip-position="bottom"
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigateForward()}
              disabled={!canNavigateForward()}
              data-tooltip="Go forward"
              data-tooltip-position="bottom"
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigateUp()}
              data-tooltip="Go up one level"
              data-tooltip-position="bottom"
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted hover:text-foreground"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => toggleDotfiles()}
              data-tooltip={showDotfiles ? 'Hide dotfiles' : 'Show dotfiles'}
              data-tooltip-position="bottom"
              className={`p-1.5 rounded-md hover:bg-white/10 transition-colors ${
                showDotfiles ? 'text-accent' : 'text-muted hover:text-foreground'
              }`}
            >
              {showDotfiles ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
            {/* Breadcrumbs */}
            <div className="flex items-center text-xs text-muted truncate ml-1">
              {getBreadcrumbs().map((crumb, index, array) => (
                <span key={crumb.path}>
                  <button
                    onClick={() => navigateTo(crumb.path)}
                    data-tooltip={crumb.path}
                    data-tooltip-position="bottom"
                    className={`px-1 hover:underline truncate ${
                      index === array.length - 1
                        ? 'font-semibold text-foreground'
                        : ''
                    }`}
                  >
                    {crumb.name}
                  </button>
                  {index < array.length - 1 && <span className="px-0.5">/</span>}
                </span>
              ))}
            </div>
          </div>

          {/* File List */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2">
            <div className="space-y-0.5">
              {filteredContent.map((item) => (
                <div
                  key={item.path}
                  onClick={() => handleItemClick(item)}
                  onContextMenu={(e) => handleRightClick(e, item)}
                  className="flex items-center text-xs font-medium text-foreground py-1.5 px-2 rounded-md hover:bg-white/10 cursor-pointer"
                  data-tooltip={item.path}
                  data-tooltip-position="right"
                >
                  {renderFileIcon(item)}
                  <span className="ml-2 truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          {renderProjectTree()}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Rename Dialog */}
      {renameDialog.item && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setRenameDialog({ item: null, newName: '' })}
        >
          <div 
            className="rounded-xl border shadow-2xl p-6 w-full max-w-md"
            style={{ backgroundColor: 'var(--settings-bg)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">Rename</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">New name</label>
                <input
                  type="text"
                  value={renameDialog.newName}
                  onChange={(e) => setRenameDialog({ ...renameDialog, newName: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await handleRename();
                    } else if (e.key === 'Escape') {
                      setRenameDialog({ item: null, newName: '' });
                    }
                  }}
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-md py-2 px-3 text-sm text-foreground focus:ring-1 focus:ring-accent focus:outline-none transition-all"
                  style={{ borderColor: 'var(--input-border)' }}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setRenameDialog({ item: null, newName: '' })}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  disabled={!renameDialog.newName.trim() || renameDialog.newName === renameDialog.item.name}
                  className="px-4 py-2 text-sm font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
