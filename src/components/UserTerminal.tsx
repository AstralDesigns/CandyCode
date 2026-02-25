import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useStore } from '../store';
import 'xterm/css/xterm.css';

// Map app themes to XTerm themes
const getXtermTheme = (theme: string, customTheme?: any) => {
  const isLight = theme === 'light';
  
  if (theme === 'custom' && customTheme) {
    return {
      background: '#00000000',
      foreground: customTheme.colors.textPrimary || '#f8fafc',
      cursor: customTheme.colors.accentColor || '#0ea5e9',
      selectionBackground: customTheme.colors.accentColor + '40',
      black: '#000000',
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#eab308',
      blue: customTheme.colors.accentColor || '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#ffffff',
      brightBlack: '#4b5563',
      brightRed: '#f87171',
      brightGreen: '#4ade80',
      brightYellow: '#fde047',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#ffffff',
    };
  }

  if (!isLight) {
    return {
      background: '#00000000', 
      foreground: '#f8fafc',
      cursor: '#0ea5e9',
      selectionBackground: '#334155',
      black: '#1e293b',
      red: '#f43f5e',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#3b82f6',
      magenta: '#d946ef',
      cyan: '#06b6d4',
      white: '#f8fafc',
      brightBlack: '#475569',
      brightRed: '#fb7185',
      brightGreen: '#34d399',
      brightYellow: '#fbbf24',
      brightBlue: '#60a5fa',
      brightMagenta: '#e879f9',
      brightCyan: '#22d3ee',
      brightWhite: '#ffffff',
    };
  }

  return {
    background: '#ffffff',
    foreground: '#0f172a',
    cursor: '#2563eb',
    selectionBackground: '#bfdbfe',
    black: '#000000',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    blue: '#2563eb',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#ffffff',
    brightBlack: '#4b5563',
    brightRed: '#f87171',
    brightGreen: '#4ade80',
    brightYellow: '#fde047',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#ffffff',
  };
};

export default function UserTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // Use a stable ID across renders
  const ptyId = useRef<string>(`pty-${Date.now()}-${Math.random()}`);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  
  const { theme, customThemes, activeCustomThemeId, projectContext, terminalSettings } = useStore();
  
  const initializationAttempted = useRef(false);
  const cleanupDone = useRef(false);

  // Check if container has dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    
    const checkDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setContainerReady(true);
        }
      }
    };
    
    // Check immediately
    checkDimensions();
    
    // Also check after a short delay in case of initial render
    const timer = setTimeout(checkDimensions, 50);
    
    return () => clearTimeout(timer);
  }, []);

  // Use IntersectionObserver to detect visibility
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting && entry.intersectionRatio > 0);
      },
      { threshold: 0.1 }
    );
    
    observer.observe(containerRef.current);
    intersectionObserverRef.current = observer;
    
    return () => {
      observer.disconnect();
    };
  }, []);

  // Safe fit function
  const fitTerminal = () => {
    if (!fitAddonRef.current || !terminalRef.current || !xtermRef.current) return;
    
    // We can try to fit even if dimensions are weird, worst case it throws or does nothing
    try {
      fitAddonRef.current.fit();
      
      if (ptyId.current && window.electronAPI?.pty) {
        const { cols, rows } = xtermRef.current;
        if (cols > 0 && rows > 0) {
          window.electronAPI.pty.resize(ptyId.current, cols, rows);
        }
      }
    } catch (e) {
      // Ignore fit errors which can happen when container is hidden
    }
  };

  // Initialize terminal - Dependency on containerReady only
  useEffect(() => {
    if (!terminalRef.current || !containerReady) return;
    if (xtermRef.current || initializationAttempted.current) return;
    
    initializationAttempted.current = true;
    cleanupDone.current = false;

    console.log('[Terminal] Initializing...');

    const term = new Terminal({
      cursorBlink: terminalSettings.cursorBlink,
      cursorStyle: terminalSettings.cursorStyle,
      fontFamily: terminalSettings.fontFamily,
      fontSize: terminalSettings.fontSize,
      lineHeight: 1.2,
      theme: getXtermTheme(theme, customThemes.find(t => t.id === activeCustomThemeId)),
      allowTransparency: true,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Open terminal
    term.open(terminalRef.current);
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Immediate fit and PTY creation to minimize latency
    fitTerminal();
    
    if (window.electronAPI?.pty) {
      // Use default dimensions if fit failed (e.g. if hidden)
      const cols = term.cols || 80;
      const rows = term.rows || 24;

      window.electronAPI.pty.create({
        id: ptyId.current,
        cols,
        rows,
        cwd: projectContext || undefined,
      }).then(() => {
        console.log('[Terminal] PTY created');
        
        // Wire up data listener
        window.electronAPI.pty.onData(({ id, data }) => {
          if (id === ptyId.current && xtermRef.current) {
            xtermRef.current.write(data);
          }
        });

        // Handle input
        term.onData((data) => {
          // Strictly filter only the OSC 11 background color response to prevent it being echoed to the PTY
          // This typically looks like: \x1b]11;rgb:rrrr/gggg/bbbb\x07 or \x1b]11;rgb:rrrr/gggg/bbbb\x1b\
          // We must NOT block generic control characters like \x07 (BEL) as that breaks shell completions
          if (
            data.startsWith('\x1b]11;rgb:') && 
            (data.endsWith('\x07') || data.endsWith('\x1b\\'))
          ) {
            return;
          }

          if (ptyId.current) {
            window.electronAPI?.pty.write(ptyId.current, data);
          }
        });

        // Auto-focus if visible
        if (isVisible) {
            term.focus();
        }
      }).catch((err: any) => {
        console.error('[Terminal] Failed to create PTY:', err);
        term.write('\r\n\x1b[31mFailed to initialize terminal session.\x1b[0m\r\n');
      });
    }

    // Setup resize observer
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitTerminal();
      });
    });
    
    resizeObserver.observe(terminalRef.current);
    resizeObserverRef.current = resizeObserver;

    // Focus on click
    const handleClick = () => term.focus();
    terminalRef.current?.addEventListener('click', handleClick);

    // Cleanup - Only runs when component unmounts (app closed or reloaded)
    return () => {
      if (cleanupDone.current) return;
      cleanupDone.current = true;
      
      console.log('[Terminal] Cleaning up...');
      
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      terminalRef.current?.removeEventListener('click', handleClick);
      
      if (ptyId.current && window.electronAPI?.pty) {
        window.electronAPI.pty.kill(ptyId.current);
      }
      
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      initializationAttempted.current = false;
    };
  }, [containerReady]); // Run once when container is ready

  // Re-fit when visible
  useEffect(() => {
    if (isVisible && xtermRef.current) {
      setTimeout(() => {
        fitTerminal();
        xtermRef.current?.focus();
      }, 50);
    }
  }, [isVisible]);

  // Update terminal settings dynamically (Hot Updates)
  useEffect(() => {
    if (!xtermRef.current) return;
    
    const term = xtermRef.current;
    
    // Update all options
    term.options.fontSize = terminalSettings.fontSize;
    term.options.cursorStyle = terminalSettings.cursorStyle;
    // Force re-apply cursor blink to ensure it updates correctly for all styles
    term.options.cursorBlink = terminalSettings.cursorBlink;
    term.options.fontFamily = terminalSettings.fontFamily;
    
    // Update theme
    const customTheme = customThemes.find(t => t.id === activeCustomThemeId);
    term.options.theme = getXtermTheme(theme, customTheme);
    
    // Refit after settings change
    setTimeout(() => {
      fitTerminal();
    }, 50);
  }, [terminalSettings, theme, activeCustomThemeId, customThemes]);

  return (
    <div 
      ref={containerRef}
      className="h-full w-full p-3 overflow-hidden bg-black/20"
      style={{
        backdropFilter: 'blur(4px)',
      }}
    >
      <div 
        ref={terminalRef} 
        className="h-full w-full rounded-lg overflow-hidden border border-white/5 shadow-inner"
        style={{
          padding: '4px 0 0 8px'
        }}
      />
    </div>
  );
}
