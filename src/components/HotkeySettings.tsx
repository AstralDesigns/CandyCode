import { useState, useEffect } from 'react';
import { Keyboard, X, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

interface HotkeyConfig {
  action: string;
  hotkey: string;
  description: string;
}

const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  {
    action: 'launch',
    hotkey: 'Super+Alt+C',
    description: 'Launch or focus CandyCode',
  },
  {
    action: 'new-window',
    hotkey: 'Ctrl+Shift+N',
    description: 'Open new CandyCode window',
  },
];

export default function HotkeySettings() {
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>([]);
  const [registeredHotkeys, setRegisteredHotkeys] = useState<Array<{ action: string; hotkey: string }>>([]);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [pressedKeys, setPressedKeys] = useState<string[]>([]);
  const [status, setStatus] = useState<{ [key: string]: 'success' | 'error' | 'pending' }>({});
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    loadRegisteredHotkeys();
    
    // Listen for global hotkey triggers
    const handleHotkeyTrigger = (_event: any, data: { hotkey: string; action: string }) => {
      const hotkey = data?.hotkey;
      const _action = data?.action;
      console.log('[HotkeySettings] Hotkey triggered:', hotkey, _action);
      // Could show a notification or visual feedback here
    };

    window.electronAPI?.on?.('global-hotkey-triggered' as any, handleHotkeyTrigger as any);

    return () => {
      // Cleanup if needed
    };
  }, []);

  const loadRegisteredHotkeys = async () => {
    try {
      const registered = await window.electronAPI?.getRegisteredHotkeys?.();
      if (registered) {
        setRegisteredHotkeys(registered);
      }
    } catch (error) {
      console.error('Failed to load registered hotkeys:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, _action: string) => {
    e.preventDefault();
    
    const modifiers: string[] = [];
    const keys: string[] = [];
    
    if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey && !modifiers.includes('Ctrl')) modifiers.push('Super');
    
    // Get the main key
    let key = e.key;
    if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
      return; // Don't record modifier-only presses
    }
    
    // Normalize key names
    if (key.length === 1) {
      key = key.toUpperCase();
    } else if (key.startsWith('F') && key.length <= 3) {
      // F1-F12
      key = key.toUpperCase();
    } else if (key === ' ') {
      key = 'Space';
    } else if (key === 'Escape') {
      key = 'Esc';
    } else if (key === 'Backspace') {
      key = 'Backspace';
    } else if (key === 'Enter') {
      key = 'Enter';
    } else if (key === 'Tab') {
      key = 'Tab';
    } else if (key === 'ArrowUp') {
      key = 'Up';
    } else if (key === 'ArrowDown') {
      key = 'Down';
    } else if (key === 'ArrowLeft') {
      key = 'Left';
    } else if (key === 'ArrowRight') {
      key = 'Right';
    } else {
      // Skip other special keys
      return;
    }
    
    keys.push(key);
    
    const newHotkey = [...modifiers, ...keys].join('+');
    setPressedKeys([newHotkey]);
  };

  const handleKeyUp = async (e: React.KeyboardEvent, action: string) => {
    e.preventDefault();
    
    if (pressedKeys.length === 0) {
      setRecordingFor(null);
      return;
    }
    
    const newHotkey = pressedKeys[0];
    
    // Validate hotkey (must have at least one modifier)
    const hasModifier = newHotkey.includes('Ctrl') || 
                        newHotkey.includes('Alt') || 
                        newHotkey.includes('Shift') || 
                        newHotkey.includes('Super');
    
    if (!hasModifier) {
      setStatus({ [action]: 'error' });
      setMessage('Hotkey must include at least one modifier (Ctrl, Alt, Shift, or Super/Command)');
      setTimeout(() => {
        setStatus({});
        setMessage('');
      }, 3000);
      setPressedKeys([]);
      setRecordingFor(null);
      return;
    }
    
    // Register the hotkey
    try {
      const result = await window.electronAPI?.registerGlobalHotkey?.(newHotkey, action);
      
      if (result?.success) {
        setHotkeys(prev => {
          const filtered = prev.filter(h => h.action !== action);
          return [...filtered, { action, hotkey: newHotkey, description: prev.find(h => h.action === action)?.description || '' }];
        });
        setStatus({ [action]: 'success' });
        setMessage(`Hotkey registered: ${newHotkey}`);
        loadRegisteredHotkeys();
      } else {
        setStatus({ [action]: 'error' });
        setMessage(result?.error || 'Failed to register hotkey');
      }
    } catch (error: any) {
      setStatus({ [action]: 'error' });
      setMessage(`Error: ${error.message}`);
    }
    
    setTimeout(() => {
      setStatus({});
      setMessage('');
    }, 3000);
    
    setPressedKeys([]);
    setRecordingFor(null);
  };

  const startRecording = (action: string) => {
    setRecordingFor(action);
    setPressedKeys([]);
  };

  const cancelRecording = () => {
    setRecordingFor(null);
    setPressedKeys([]);
  };

  const unregisterHotkey = async (action: string, hotkey: string) => {
    try {
      await window.electronAPI?.unregisterGlobalHotkey?.(hotkey);
      setHotkeys(prev => prev.filter(h => h.action !== action));
      loadRegisteredHotkeys();
      setMessage(`Hotkey unregistered: ${hotkey}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const resetToDefaults = async () => {
    try {
      await window.electronAPI?.unregisterAllHotkeys?.();
      setHotkeys([]);
      setRegisteredHotkeys([]);
      setMessage('All hotkeys reset to defaults');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Keyboard className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h3>
        </div>
        <button
          onClick={resetToDefaults}
          className="px-3 py-1.5 text-xs text-muted hover:text-foreground border border-border rounded-md hover:bg-white/5 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
          status.launch === 'success' || status['new-window'] === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : status.launch === 'error' || status['new-window'] === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {status.launch === 'success' || status['new-window'] === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : status.launch === 'error' || status['new-window'] === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <Keyboard className="h-4 w-4" />
          )}
          {message}
        </div>
      )}

      <div className="space-y-4">
        {DEFAULT_HOTKEYS.map((config) => {
          const registeredHotkey = registeredHotkeys.find(h => h.action === config.action)?.hotkey;
          const currentHotkey = hotkeys.find(h => h.action === config.action)?.hotkey || registeredHotkey || config.hotkey;
          const isRecording = recordingFor === config.action;
          const displayHotkey = isRecording 
            ? (pressedKeys[0] || 'Press keys...') 
            : currentHotkey;
          const hotkeyStatus = status[config.action];

          return (
            <div
              key={config.action}
              className="flex items-center justify-between p-4 rounded-xl border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--settings-bg)' }}
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{config.description}</p>
                <p className="text-xs text-muted mt-1">Action: {config.action}</p>
              </div>

              <div className="flex items-center gap-3">
                {isRecording ? (
                  <div
                    className="px-4 py-2 rounded-lg border-2 border-accent bg-accent/10 text-accent text-sm font-mono animate-pulse min-w-[150px] text-center"
                    tabIndex={0}
                    onKeyDown={(e) => handleKeyDown(e, config.action)}
                    onKeyUp={(e) => handleKeyUp(e, config.action)}
                    onBlur={cancelRecording}
                  >
                    {displayHotkey}
                  </div>
                ) : (
                  <div
                    className="px-4 py-2 rounded-lg border text-sm font-mono min-w-[150px] text-center"
                    style={{ 
                      backgroundColor: 'var(--input-bg)',
                      borderColor: hotkeyStatus === 'success' ? 'rgb(34 197 94)' : hotkeyStatus === 'error' ? 'rgb(239 68 68)' : 'var(--input-border)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    {displayHotkey}
                  </div>
                )}

                {hotkeyStatus === 'success' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                {hotkeyStatus === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}

                {!isRecording && (
                  <>
                    <button
                      onClick={() => startRecording(config.action)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted hover:text-foreground"
                      data-tooltip="Change hotkey"
                    >
                      <Keyboard className="h-4 w-4" />
                    </button>
                    {registeredHotkey && (
                      <button
                        onClick={() => unregisterHotkey(config.action, registeredHotkey)}
                        className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-muted hover:text-red-400"
                        data-tooltip="Remove hotkey"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}

                {isRecording && (
                  <button
                    onClick={cancelRecording}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted hover:text-foreground"
                    data-tooltip="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl border text-sm" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--settings-bg)' }}>
        <h4 className="font-medium text-foreground mb-2">Hotkey Tips:</h4>
        <ul className="space-y-1 text-muted">
          <li>• Click on a hotkey and press your desired key combination</li>
          <li>• Hotkeys must include at least one modifier (Ctrl, Alt, Shift, or Super/Command)</li>
          <li>• Some system hotkeys may take precedence over app hotkeys</li>
          <li>• On macOS, Super refers to the Command key</li>
          <li>• Changes take effect immediately</li>
        </ul>
      </div>

      <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--settings-bg)' }}>
        <h4 className="font-medium text-foreground mb-3">System-Level Hotkey Setup</h4>
        <p className="text-sm text-muted mb-3">
          For hotkeys that work even when CandyCode is not running, set up system-level shortcuts:
        </p>
        <div className="text-xs text-muted space-y-2">
          <p><strong className="text-foreground">Linux:</strong> Run <code className="px-2 py-1 bg-white/10 rounded">node scripts/setup-hotkeys.js</code> to configure desktop environment shortcuts</p>
          <p><strong className="text-foreground">macOS:</strong> Use System Preferences → Keyboard → Shortcuts, or tools like Karabiner-Elements</p>
          <p><strong className="text-foreground">Windows:</strong> Create a shortcut with hotkey in Properties, or use AutoHotkey</p>
        </div>
      </div>
    </div>
  );
}
