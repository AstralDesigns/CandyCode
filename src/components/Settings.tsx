import { X, Save, Palette, Cpu, ExternalLink, Key, ChevronDown, Plus, Trash2, Edit2, Check, Zap, Globe, Brain, Moon, Server, Search, Download, Loader2, TerminalSquare } from 'lucide-react';
import { useStore, CustomTheme, TerminalSettings } from '../store';
import { useState, useEffect, useRef } from 'react';
import Dropdown from './ui/Dropdown';

type Tab = 'themes' | 'terminal' | 'groq' | 'grok' | 'gemini' | 'moonshot' | 'ollama';

const DEFAULT_CUSTOM_THEME: Omit<CustomTheme, 'id'> = {
  name: 'New Custom Theme',
  colors: {
    bgPrimary: '#020617',
    bgSecondary: '#0f172a',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    borderColor: '#1e293b',
    accentColor: '#0ea5e9',
    sidebarBg: '#0f172a',
    chatBg: '#0f172a',
    headerBg: '#020617',
    inputBg: '#0f172a',
    inputBorder: '#1e293b',
    userMsgBg: '#0ea5e9',
    userMsgBorder: '#1e293b',
    indicatorColor: '#0ea5e9',
    buttonBg: '#ffffff',
    buttonText: '#020617',
    settingsBg: '#0f172a',
  },
  transparency: 0.3,
};

const POPULAR_FONTS = [
  { label: 'JetBrainsMono Nerd Font', value: '"JetBrainsMono Nerd Font", "JetBrains Mono", monospace' },
  { label: 'FiraCode Nerd Font', value: '"FiraCode Nerd Font", "Fira Code", monospace' },
  { label: 'MesloLGS NF', value: '"MesloLGS NF", monospace' },
  { label: 'Cascadia Code', value: '"Cascadia Code", monospace' },
  { label: 'Hack Nerd Font', value: '"Hack Nerd Font", "Hack", monospace' },
  { label: 'SauceCodePro Nerd Font', value: '"SauceCodePro Nerd Font", "Source Code Pro", monospace' },
  { label: 'RobotoMono Nerd Font', value: '"RobotoMono Nerd Font", "Roboto Mono", monospace' },
  { label: 'UbuntuMono Nerd Font', value: '"UbuntuMono Nerd Font", "Ubuntu Mono", monospace' },
  { label: 'Monospaced', value: 'monospace' },
];

const BASIC_THEMES = [
  { id: 'alpha', name: 'Alpha (Default)' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

const STANDARD_THEMES = [
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha' },
  { id: 'gruvbox', name: 'Gruvbox' },
  { id: 'solarized-dark', name: 'Solarized Dark' },
  { id: 'tokyo-night', name: 'Tokyo Night' },
  { id: 'graphite', name: 'Graphite' },
  { id: 'dracula', name: 'Dracula' },
  { id: 'rose-pine', name: 'Rosé Pine' },
  { id: 'crimson', name: 'Crimson' },
  { id: 'monokai', name: 'Monokai' },
  { id: 'greenify', name: 'Greenify' },
];

const ALL_PRESET_THEMES = [...BASIC_THEMES, ...STANDARD_THEMES];

const GROK_MODELS = [
  { 
    id: 'grok-4.1-fast', 
    name: 'Grok 4.1 Fast', 
    desc: 'Optimized for tool-calling and agentic workflows, 2M token context',
    limits: 'Better rate limits than Groq, optimized for agents',
    provider: 'grok' as const,
    recommended: true
  },
  { 
    id: 'grok-4.1', 
    name: 'Grok 4.1', 
    desc: 'Latest Grok model with enhanced reasoning and multimodal understanding',
    limits: 'Better rate limits than Groq',
    provider: 'grok' as const,
    recommended: false
  },
  { 
    id: 'grok-beta', 
    name: 'Grok Beta', 
    desc: 'Beta model with extended context (legacy)',
    limits: 'Better rate limits than Groq',
    provider: 'grok' as const,
    recommended: false
  }
];

const GROQ_MODELS = [
  { 
    id: 'llama-3.3-70b-versatile', 
    name: 'Llama 3.3 70B Versatile', 
    desc: '128K context, excellent reasoning and coding',
    limits: 'Fast, better rate limits',
    provider: 'groq' as const,
    recommended: true
  },
  { 
    id: 'llama-3.1-8b-instant', 
    name: 'Llama 3.1 8B Instant', 
    desc: '128K context, extremely fast inference',
    limits: 'Free tier available',
    provider: 'groq' as const,
    recommended: false
  },
  { 
    id: 'moonshotai/kimi-k2-instruct', 
    name: 'Kimi K2 Instruct', 
    desc: '131K context, 16K output - low rate limit (10K TPM)',
    limits: 'Rate limited on free tier',
    provider: 'groq' as const,
    recommended: false
  }
];

const GEMINI_MODELS = [
  { 
    id: 'gemini-3-flash-preview', 
    name: 'Gemini 3 Flash Preview', 
    desc: 'State-of-the-art, Pro-grade reasoning at Flash speed',
    limits: '5 RPM (free tier)',
    provider: 'gemini' as const,
    recommended: false
  },
  { 
    id: 'gemini-2.5-flash', 
    name: 'Gemini 2.5 Flash', 
    desc: 'Fast, 1M context, 65K output - RECOMMENDED',
    limits: '15 RPM, 1M RPD (free)',
    provider: 'gemini' as const,
    recommended: true
  },
  { 
    id: 'gemini-2.5-pro', 
    name: 'Gemini 2.5 Pro', 
    desc: 'Advanced reasoning, 1M context (slower)',
    limits: '2 RPM, 50 RPD (free)',
    provider: 'gemini' as const,
    recommended: false
  },
  { 
    id: 'gemini-2.5-flash-lite', 
    name: 'Gemini 2.5 Flash Lite', 
    desc: 'Most efficient, 1M context',
    limits: '15 RPM (free)',
    provider: 'gemini' as const,
    recommended: false
  }
];

const MOONSHOT_MODELS = [
  { 
    id: 'moonshot-v1-8k', 
    name: 'Moonshot v1 8K', 
    desc: 'General purpose model with 8K context',
    limits: 'Requires API key',
    provider: 'moonshot' as const,
    recommended: false
  },
  { 
    id: 'moonshot-v1-32k', 
    name: 'Moonshot v1 32K', 
    desc: 'Extended context for larger tasks',
    limits: 'Requires API key',
    provider: 'moonshot' as const,
    recommended: false
  },
  { 
    id: 'moonshot-v1-128k', 
    name: 'Moonshot v1 128K', 
    desc: '128K context window - RECOMMENDED',
    limits: 'Requires API key',
    provider: 'moonshot' as const,
    recommended: true
  }
];

export default function Settings() {
  const { 
    showSettings, 
    setShowSettings, 
    theme, 
    setTheme, 
    customThemes,
    activeCustomThemeId,
    activeStandardThemeId,
    addCustomTheme,
    updateCustomTheme,
    removeCustomTheme,
    setActiveCustomThemeId,
    setActiveStandardThemeId,
    geminiApiKey,
    setGeminiApiKey,
    aiBackendModel,
    setAIBackendModel,
    aiProvider,
    setAIProvider,
    deepseekApiKey,
    setDeepseekApiKey,
    groqApiKey,
    setGroqApiKey,
    grokApiKey,
    setGrokApiKey,
    moonshotApiKey,
    setMoonshotApiKey,
    ollamaModels,
    activeSettingsTab,
    setActiveSettingsTab,
    terminalSettings,
    setTerminalSettings
  } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>(activeSettingsTab as Tab);

  // Sync local tab state with store
  useEffect(() => {
    setActiveSettingsTab(activeTab);
  }, [activeTab, setActiveSettingsTab]);

  const [deepseekKey, setDeepseekKey] = useState(deepseekApiKey);
  const [groqKey, setGroqKey] = useState(groqApiKey);
  const [grokKey, setGrokKey] = useState(grokApiKey);
  const [geminiKey, setGeminiKey] = useState(geminiApiKey);
  const [moonshotKey, setMoonshotKey] = useState(moonshotApiKey);
  const [selectedModel, setSelectedModel] = useState(aiBackendModel);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editingTheme, setEditingTheme] = useState<Omit<CustomTheme, 'id'>>(DEFAULT_CUSTOM_THEME);
  const [showThemeLimitWarning, setShowThemeLimitWarning] = useState(false);
  
  // Ollama state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [serverStatus, setServerStatus] = useState<{ running: boolean; error?: string } | null>(null);
  const [installingModel, setInstallingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const getModelsForProvider = () => {
    switch (activeTab) {
      case 'grok': return GROK_MODELS;
      case 'groq': return GROQ_MODELS;
      case 'gemini': return GEMINI_MODELS;
      case 'moonshot': return MOONSHOT_MODELS;
      case 'ollama': return Array.isArray(ollamaModels) ? ollamaModels : [];
      default: return [];
    }
  };

  useEffect(() => {
    setDeepseekKey(deepseekApiKey);
    setGroqKey(groqApiKey);
    setGrokKey(grokApiKey);
    setGeminiKey(geminiApiKey);
    setMoonshotKey(moonshotApiKey);
    
    // When opening settings, sync internal tab state
    if (showSettings) {
      setActiveTab(activeSettingsTab as Tab);
    }
  }, [deepseekApiKey, groqApiKey, grokApiKey, geminiApiKey, moonshotApiKey, showSettings, activeSettingsTab]);

  // Sync selectedModel with aiBackendModel initially, but respect tab switches
  useEffect(() => {
    if (showSettings && activeTab !== 'themes' && activeTab !== 'terminal') {
      const models = getModelsForProvider();
      const currentModelId = selectedModel;
      
      // If we are just opening settings, init from store.
      // But if we switched tabs, we might need to reset to default for that provider.
      
      // Check if current selected model belongs to the active tab's provider
      const isValid = Array.isArray(models) && models.some(m => m.id === currentModelId);
      
      if (!isValid) {
        if (aiProvider === activeTab && models.some(m => m.id === aiBackendModel)) {
           // If we are on the active provider tab, use the active model
           setSelectedModel(aiBackendModel);
        } else if (Array.isArray(models) && models.length > 0) {
           // Otherwise default to first/recommended
           const defaultModel = models.find(m => (m as any).recommended)?.id || models[0].id;
           setSelectedModel(defaultModel);
        }
      }
    }
  }, [activeTab, showSettings, aiBackendModel, aiProvider]);

  useEffect(() => {
    if (activeTab === 'ollama' && showSettings) {
      checkOllamaStatus();
      refreshOllamaModels();
    }
  }, [activeTab, showSettings]);

  const checkOllamaStatus = async () => {
    if (window.electronAPI?.ollama?.checkServer) {
      const status = await window.electronAPI.ollama.checkServer();
      setServerStatus(status);
    }
  };

  const refreshOllamaModels = async () => {
    if (window.electronAPI?.ollama?.listModels) {
      const result = await window.electronAPI.ollama.listModels();
      if (result.success) {
        useStore.setState({ 
          ollamaModels: result.models.map((m: any) => ({
            id: m.id || m.name,
            name: m.name,
            desc: m.desc,
            limits: m.limits,
            provider: 'ollama',
            installed: true
          }))
        });
      }
    }
  };

  const handleSearchModels = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    if (window.electronAPI?.ollama?.searchModels) {
      const result = await window.electronAPI.ollama.searchModels(query);
      if (result.success) {
        setSearchResults(result.models);
      }
    }
  };

  const handleInstallModel = async (modelName: string) => {
    setInstallingModel(modelName);
    setPullProgress('Starting download...');
    
    const cleanup = window.electronAPI?.ollama?.onPullProgress?.((data: any) => {
      if (data.modelName === modelName) {
        setPullProgress(data.progress);
      }
    });

    if (window.electronAPI?.ollama?.pullModel) {
      const result = await window.electronAPI.ollama.pullModel(modelName);
      if (result.success) {
        await refreshOllamaModels();
        setInstallingModel(null);
        setPullProgress('');
      } else {
        setPullProgress(`Error: ${result.error}`);
        setTimeout(() => {
          setInstallingModel(null);
          setPullProgress('');
        }, 3000);
      }
    }
    
    if (cleanup) cleanup();
  };

  const handleDeleteModel = async (modelName: string) => {
    setDeletingModel(modelName);
    if (window.electronAPI?.ollama?.deleteModel) {
      const result = await window.electronAPI.ollama.deleteModel(modelName);
      if (result.success) {
        await refreshOllamaModels();
      }
    }
    setDeletingModel(null);
  };

  const handleSave = async () => {
    setDeepseekApiKey(deepseekKey);
    setGroqApiKey(groqKey);
    setGrokApiKey(grokKey);
    setGeminiApiKey(geminiKey);
    setMoonshotApiKey(moonshotKey);
    
    setAIProvider(activeTab === 'themes' || activeTab === 'terminal' ? aiProvider : activeTab);
    
    if (activeTab !== 'themes' && activeTab !== 'terminal') {
      const models = getModelsForProvider();
      const validModel = models.some(m => m.id === selectedModel) 
        ? selectedModel 
        : (models.find(m => (m as any).recommended)?.id || models[0]?.id);
      
      if (validModel) {
        setAIBackendModel(validModel);
        
        // If Ollama, try to load the model immediately to ensure it's ready
        if (activeTab === 'ollama' && window.electronAPI?.ollama?.runModel) {
          console.log('[Settings] Loading and persisting Ollama model:', validModel);
          const result = await window.electronAPI.ollama.runModel(validModel);
          if (!result.success) {
            console.error('[Settings] Failed to load Ollama model:', result.error);
          }
        }
      }
    }
    setShowSettings(false);
  };

  const handleEditTheme = (theme: CustomTheme) => {
    setEditingThemeId(theme.id);
    setEditingTheme({
      name: theme.name,
      colors: { ...theme.colors },
      transparency: theme.transparency,
    });
  };

  const handleCreateTheme = () => {
    if (customThemes.length >= 5) {
      setShowThemeLimitWarning(true);
      return;
    }
    setEditingThemeId('new');
    setEditingTheme(DEFAULT_CUSTOM_THEME);
  };

  const handleSaveTheme = () => {
    if (editingThemeId === 'new') {
      addCustomTheme(editingTheme);
    } else if (editingThemeId) {
      updateCustomTheme(editingThemeId, editingTheme);
    }
    setEditingThemeId(null);
  };

  const handleReplaceTheme = (themeId: string) => {
    removeCustomTheme(themeId);
    setEditingThemeId('new');
    setEditingTheme(DEFAULT_CUSTOM_THEME);
    setShowThemeLimitWarning(false);
  };
  
  const handlePresetThemeSelect = (themeId: string) => {
    const basicTheme = BASIC_THEMES.find(t => t.id === themeId);
    if (basicTheme) {
      setTheme(basicTheme.id as any);
      setActiveStandardThemeId(null);
    } else {
      setTheme('standard');
      setActiveStandardThemeId(themeId);
    }
  };
  
  // Determine current effective theme name/ID for the dropdown
  const currentPresetId = theme === 'standard' 
    ? activeStandardThemeId 
    : (['alpha', 'light', 'dark'].includes(theme) ? theme : null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Only close if no dropdowns are open (Dropdown portal handles its own clicks)
        // We can check if the click target is inside a dropdown portal
        const target = event.target as HTMLElement;
        if (!target.closest('.dropdown-portal')) {
          setShowSettings(false);
        }
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings, setShowSettings]);

  if (!showSettings) return null;

  const getProviderName = () => {
    switch (activeTab) {
      case 'grok': return 'Grok';
      case 'groq': return 'Groq';
      case 'gemini': return 'Gemini';
      case 'moonshot': return 'Moonshot';
      case 'ollama': return 'Ollama';
      default: return '';
    }
  };

  const getProviderKey = () => {
    switch (activeTab) {
      case 'grok': return grokKey;
      case 'groq': return groqKey;
      case 'gemini': return geminiKey;
      case 'moonshot': return moonshotKey;
      default: return '';
    }
  };

  const setProviderKey = (val: string) => {
    switch (activeTab) {
      case 'grok': setGrokKey(val); break;
      case 'groq': setGroqKey(val); break;
      case 'gemini': setGeminiKey(val); break;
      case 'moonshot': setMoonshotKey(val); break;
    }
  };

  const getProviderLink = () => {
    switch (activeTab) {
      case 'grok': return 'https://console.x.ai/';
      case 'groq': return 'https://console.groq.com/keys';
      case 'gemini': return 'https://aistudio.google.com/apikey';
      case 'moonshot': return 'https://platform.moonshot.cn/console/api-keys';
      default: return '';
    }
  };

  const getProviderIcon = () => {
    switch (activeTab) {
      case 'grok': return <Brain className="w-4 h-4" />;
      case 'groq': return <Zap className="w-4 h-4" />;
      case 'gemini': return <Globe className="w-4 h-4" />;
      case 'moonshot': return <Moon className="w-4 h-4" />;
      case 'ollama': return <Server className="w-4 h-4" />;
      default: return <Cpu className="w-4 h-4" />;
    }
  };

  const getProviderDescription = () => {
    switch (activeTab) {
      case 'grok': return 'xAI Grok models with better rate limits than Groq. OpenAI-compatible API.';
      case 'groq': return 'Fast inference with Llama 3.3 70B (128K context). OpenAI-compatible API.';
      case 'gemini': return 'Native Gemini API with 1M+ context. Best for complex tasks. RECOMMENDED.';
      case 'moonshot': return 'Kimi AI with 128K context. China-based servers (may be slower).';
      case 'ollama': return 'Run models locally for privacy and offline use. No API keys required. Optimized for mid-tier to high-end hardware.';
      default: return '';
    }
  };
  
  const currentModels = getModelsForProvider();
  const activeModelDetails = currentModels.find(m => m.id === selectedModel) || currentModels[0];

  const tabClass = (tab: Tab) => `
    flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all
    ${activeTab === tab 
      ? 'bg-accent/10 text-accent ring-1 ring-accent/40 shadow-sm shadow-accent/10' 
      : 'text-muted hover:text-foreground hover:bg-white/5'}
  `;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8">
      <div 
        ref={containerRef}
        className="w-full max-w-3xl rounded-xl border shadow-2xl flex flex-col max-h-[90vh] transition-colors"
        style={{ backgroundColor: 'var(--settings-bg)', borderColor: 'var(--border-color)' }}
      >
        <div className="p-5 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-accent" />
            Settings
          </h2>
          <button 
            onClick={() => setShowSettings(false)}
            className="p-1.5 hover:bg-white/5 rounded-md text-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-full md:w-56 p-2 border-b md:border-b-0 md:border-r overflow-y-auto space-y-1 shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider px-3 py-2">Appearance</div>
            <button onClick={() => setActiveTab('themes')} className={tabClass('themes')}>
              <Palette className="w-4 h-4" /> Themes
            </button>
            <button onClick={() => setActiveTab('terminal')} className={tabClass('terminal')}>
              <TerminalSquare className="w-4 h-4" /> Terminal
            </button>
            
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider px-3 py-2 mt-4">AI Providers</div>
            <button onClick={() => setActiveTab('grok')} className={tabClass('grok')}>
              <Brain className="w-4 h-4" /> Grok (xAI)
            </button>
            <button onClick={() => setActiveTab('groq')} className={tabClass('groq')}>
              <Zap className="w-4 h-4" /> Groq
            </button>
            <button onClick={() => setActiveTab('gemini')} className={tabClass('gemini')}>
              <Globe className="w-4 h-4" /> Gemini
            </button>
            <button onClick={() => setActiveTab('moonshot')} className={tabClass('moonshot')}>
              <Moon className="w-4 h-4" /> Moonshot
            </button>
            <button onClick={() => setActiveTab('ollama')} className={tabClass('ollama')}>
              <Server className="w-4 h-4" /> Ollama (Local)
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {/* Themes Tab */}
            {activeTab === 'themes' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-4">Interface Theme</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Standard/Preset Themes */}
                    <div className="space-y-2">
                       <label className="text-xs text-muted font-medium uppercase tracking-wider">Standard</label>
                       <Dropdown
                         value={currentPresetId || 'alpha'}
                         onChange={(val) => handlePresetThemeSelect(val)}
                         options={ALL_PRESET_THEMES.map(t => ({ label: t.name, value: t.id }))}
                         className="w-full"
                         title="Select a standard theme"
                       />
                       <p className="text-[10px] text-muted leading-tight">
                         Includes basic Light/Dark modes and popular color schemes like Catppuccin and Dracula.
                       </p>
                    </div>

                    {/* Custom Themes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                         <label className="text-xs text-muted font-medium uppercase tracking-wider">Custom</label>
                         <button 
                           onClick={handleCreateTheme}
                           className="text-[10px] text-accent hover:underline flex items-center gap-1"
                         >
                           <Plus className="w-3 h-3" /> New
                         </button>
                      </div>
                      
                      <div className="space-y-2">
                        {customThemes.length === 0 ? (
                           <div className="p-3 rounded-lg border border-dashed border-border bg-white/5 text-center text-xs text-muted">
                             No custom themes yet
                           </div>
                        ) : (
                          customThemes.map(t => (
                            <div 
                              key={t.id}
                              className={`group flex items-center justify-between p-2 rounded-lg border transition-all ${
                                activeCustomThemeId === t.id && theme === 'custom'
                                  ? 'bg-white/10 border-accent/50 ring-1 ring-accent/20' 
                                  : 'bg-white/5 border-border hover:border-accent/30'
                              }`}
                            >
                              <button
                                onClick={() => {
                                  setTheme('custom');
                                  setActiveCustomThemeId(t.id);
                                }}
                                className="flex-1 flex items-center gap-2 text-left overflow-hidden"
                              >
                                <div 
                                  className="w-3 h-3 rounded-full border border-white/20 shadow-sm shrink-0" 
                                  style={{ backgroundColor: t.colors.accentColor }} 
                                />
                                <span className={`text-xs truncate ${activeCustomThemeId === t.id && theme === 'custom' ? 'text-accent font-medium' : 'text-foreground'}`}>
                                  {t.name}
                                </span>
                              </button>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleEditTheme(t)}
                                  className="p-1 hover:bg-white/10 rounded text-muted hover:text-foreground transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => removeCustomTheme(t.id)}
                                  className="p-1 hover:bg-rose-500/20 rounded text-muted hover:text-rose-400 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {theme === 'custom' && showThemeLimitWarning && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs text-amber-200 mb-3">Maximum 5 custom themes reached. Choose one to replace:</p>
                    <div className="flex flex-wrap gap-2">
                      {customThemes.map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleReplaceTheme(t.id)}
                          className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 rounded-lg text-xs text-amber-100 transition-colors border border-amber-500/30"
                        >
                          {t.name}
                        </button>
                      ))}
                      <button 
                        onClick={() => setShowThemeLimitWarning(false)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Theme Editor Modal */}
                {editingThemeId && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div 
                      className="w-full max-w-lg rounded-xl border shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
                      style={{ backgroundColor: 'var(--settings-bg)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground">
                          {editingThemeId === 'new' ? 'Create Custom Theme' : 'Edit Theme'}
                        </h4>
                        <button onClick={() => setEditingThemeId(null)} className="text-muted hover:text-foreground">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Theme Name</label>
                          <input
                            type="text"
                            value={editingTheme.name}
                            onChange={e => setEditingTheme({ ...editingTheme, name: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                          {[
                            { label: 'Primary BG', key: 'bgPrimary' },
                            { label: 'Secondary BG', key: 'bgSecondary' },
                            { label: 'Text Primary', key: 'textPrimary' },
                            { label: 'Text Secondary', key: 'textSecondary' },
                            { label: 'Border Color', key: 'borderColor' },
                            { label: 'Accent Color', key: 'accentColor' },
                            { label: 'Sidebar BG', key: 'sidebarBg' },
                            { label: 'Chat BG', key: 'chatBg' },
                            { label: 'Header BG', key: 'headerBg' },
                            { label: 'Input BG', key: 'inputBg' },
                            { label: 'Input Border', key: 'inputBorder' },
                            { label: 'User Msg BG', key: 'userMsgBg' },
                            { label: 'User Msg Border', key: 'userMsgBorder' },
                            { label: 'Pulse Indicator', key: 'indicatorColor' },
                            { label: 'Button BG', key: 'buttonBg' },
                            { label: 'Button Text', key: 'buttonText' },
                            { label: 'Settings BG', key: 'settingsBg' },
                          ].map((field) => (
                            <div key={field.key}>
                              <label className="block text-[10px] font-medium text-muted mb-1 uppercase tracking-wider">{field.label}</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={editingTheme.colors[field.key as keyof typeof editingTheme.colors]}
                                  onChange={e => setEditingTheme({
                                    ...editingTheme,
                                    colors: { ...editingTheme.colors, [field.key]: e.target.value }
                                  })}
                                  className="w-8 h-8 bg-transparent border-0 p-0 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={editingTheme.colors[field.key as keyof typeof editingTheme.colors]}
                                  onChange={e => setEditingTheme({
                                    ...editingTheme,
                                    colors: { ...editingTheme.colors, [field.key]: e.target.value }
                                  })}
                                  className="flex-1 text-[11px] px-2 py-1 bg-white/5 border border-border rounded text-muted font-mono"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div>
                          <div className="flex justify-between mb-1.5">
                            <label className="text-xs font-medium text-muted uppercase tracking-wider">Panel Transparency</label>
                            <span className="text-xs text-accent font-mono">{(editingTheme.transparency * 100).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={editingTheme.transparency}
                            onChange={e => setEditingTheme({ ...editingTheme, transparency: parseFloat(e.target.value) })}
                            className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-accent"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <button 
                          onClick={() => setEditingThemeId(null)}
                          className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveTheme}
                          className="px-6 py-2 bg-accent hover:brightness-110 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Save Theme
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Terminal Settings Tab */}
            {activeTab === 'terminal' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">Font Family</label>
                    <Dropdown
                      value={terminalSettings.fontFamily}
                      onChange={(val) => setTerminalSettings({ fontFamily: val })}
                      options={POPULAR_FONTS}
                      className="w-full"
                      placeholder="Select font..."
                    />
                    <p className="mt-1 text-[10px] text-muted">Requires a Nerd Font for icons.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">Font Size</label>
                    <input
                      type="number"
                      min="8"
                      max="32"
                      value={terminalSettings.fontSize}
                      onChange={(e) => setTerminalSettings({ fontSize: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/5 border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">Cursor Style</label>
                    <Dropdown
                      value={terminalSettings.cursorStyle}
                      onChange={(val) => setTerminalSettings({ cursorStyle: val as any })}
                      options={[
                        { label: 'Block', value: 'block' },
                        { label: 'Underline', value: 'underline' },
                        { label: 'Bar', value: 'bar' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={terminalSettings.cursorBlink}
                      onChange={(e) => setTerminalSettings({ cursorBlink: e.target.checked })}
                      className="rounded border-border bg-white/5 text-accent focus:ring-accent"
                    />
                    <label className="text-sm font-medium text-muted">Cursor Blink</label>
                  </div>
                </div>
              </div>
            )}

            {/* API Provider Tabs */}
            {(activeTab === 'grok' || activeTab === 'groq' || activeTab === 'gemini' || activeTab === 'moonshot') && (
              <div className="space-y-8">
                <div className="p-4 bg-white/5 border border-border rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white/10">
                      {getProviderIcon()}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-1">{getProviderName()} AI</h3>
                      <p className="text-xs text-muted leading-relaxed">
                        {getProviderDescription()}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-muted">
                      <Key className="w-4 h-4 text-accent" />
                      {getProviderName()} API Key
                    </label>
                    <a 
                      href={getProviderLink()} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
                    >
                      Get Free Key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="relative group">
                    <input
                      type="password"
                      value={getProviderKey()}
                      onChange={(e) => setProviderKey(e.target.value)}
                      placeholder={`Enter your ${getProviderName()} API key`}
                      className="w-full px-4 py-2.5 bg-white/5 border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-muted leading-relaxed">
                    Your key is saved locally. {' '}
                    {activeTab === 'grok' && 'Grok 4.1 Fast (2M context, agent-optimized)'}
                    {activeTab === 'groq' && 'Llama 3.3 70B (128K context)'}
                    {activeTab === 'gemini' && 'Gemini 2.5 Flash (1M context)'}
                    {activeTab === 'moonshot' && 'Moonshot v1 128K (128K context)'}
                    {' '}is recommended.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    {getProviderName()} Model
                  </label>
                  <Dropdown
                    value={selectedModel}
                    onChange={(val) => setSelectedModel(val)}
                    options={currentModels.map((m: any) => ({
                      label: m.name,
                      value: m.id
                    }))}
                    className="w-full"
                  />

                  {activeModelDetails && (
                    <div className="mt-3 p-4 bg-white/5 border border-border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-xs text-foreground font-medium">{activeModelDetails.desc}</div>
                        {(activeModelDetails as any).recommended && (
                          <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] bg-white/10 text-muted px-1.5 py-0.5 rounded border border-border">
                          ID: {activeModelDetails.id}
                        </span>
                        <span className="text-[10px] bg-white/10 text-muted px-1.5 py-0.5 rounded border border-border">
                          Limits: {activeModelDetails.limits}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <button
                    onClick={() => {
                      // Save key first
                      const key = getProviderKey();
                      if (key) {
                        switch(activeTab) {
                          case 'grok': setGrokApiKey(key); break;
                          case 'groq': setGroqApiKey(key); break;
                          case 'gemini': setGeminiApiKey(key); break;
                          case 'moonshot': setMoonshotApiKey(key); break;
                        }
                      }
                      
                      // Activate provider
                      setAIProvider(activeTab);
                      
                      // Set model
                      const models = getModelsForProvider();
                      if (models.some(m => m.id === selectedModel)) {
                        setAIBackendModel(selectedModel);
                      } else {
                        const defaultModel = models.find(m => (m as any).recommended)?.id || models[0]?.id;
                        if (defaultModel) setAIBackendModel(defaultModel);
                      }
                    }}
                    disabled={!getProviderKey()}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                      aiProvider === activeTab 
                        ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                        : 'bg-white/5 text-muted hover:text-foreground hover:bg-white/10 border border-border'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {aiProvider === activeTab ? (
                      <div className="flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        Currently Active
                      </div>
                    ) : (
                      `Set ${getProviderName()} as Active Provider`
                    )}
                  </button>
                  <p className="mt-2 text-[11px] text-muted text-center">
                    {aiProvider === activeTab 
                      ? `${getProviderName()} is your current AI provider`
                      : `Click to switch to ${getProviderName()} for all AI interactions`
                  }
                  </p>
                </div>

                <div className="p-4 bg-white/5 border border-border rounded-lg">
                  <div className="flex gap-3">
                    <Cpu className="w-5 h-5 text-accent shrink-0" />
                    <div className="text-xs text-muted leading-relaxed">
                      <p className="text-foreground font-medium mb-1">Agentic Capabilities</p>
                      <p>
                        AlphaStudio uses native function calling with {getProviderName()} to interact with your files and terminal.
                        This enables autonomous coding, project planning, and web searching.
                        {activeTab === 'grok' && ' Grok (xAI) provides better rate limits than Groq with OpenAI-compatible API.'}
                        {activeTab === 'groq' && ' Groq provides extremely fast inference with Llama 3.3 70B (128K context).'}
                        {activeTab === 'gemini' && ' Gemini offers 1M+ context window for complex projects.'}
                        {activeTab === 'moonshot' && ' Moonshot is optimized for Chinese-language understanding.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ollama Tab */}
            {activeTab === 'ollama' && (
              <div className="space-y-8">
                <div className="p-4 bg-white/5 border border-border rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white/10">
                      <Server className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-foreground mb-1">Ollama (Local LLM)</h3>
                      <p className="text-xs text-muted leading-relaxed mb-3">
                        Run models locally for privacy and offline use. No API keys required. Optimized for mid-tier to high-end hardware.
                      </p>
                      
                      <div className="flex items-center gap-2 mt-3">
                        {serverStatus ? (
                          serverStatus.running ? (
                            <div className="flex items-center gap-2 text-xs text-green-400">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span>Ollama server is running</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-red-400">
                              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                              <span>Ollama server not running</span>
                              {serverStatus.error && <span className="text-muted">({serverStatus.error})</span>}
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Checking server status...</span>
                          </div>
                        )}
                        <button onClick={checkOllamaStatus} className="ml-auto text-xs text-accent hover:underline">
                          Refresh
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    <Search className="w-4 h-4 inline mr-2" />
                    Search & Install Models
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        handleSearchModels(val);
                      }}
                      placeholder="Search for models (e.g., llama3.2:3b, mistral:7b, phi3:mini)"
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                    />
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {searchResults.map((model, idx) => (
                        <div key={idx} className="p-3 bg-white/5 border border-border rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">{model.name}</div>
                            {model.description && <div className="text-xs text-muted mt-1">{model.description}</div>}
                          </div>
                          <button
                            onClick={() => handleInstallModel(model.name)}
                            disabled={installingModel === model.name || !!installingModel}
                            className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {installingModel === model.name ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Installing...
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                Install
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {installingModel && pullProgress && (
                    <div className="mt-3 p-3 bg-white/5 border border-border rounded-lg">
                      <div className="text-xs text-muted mb-1">Installing {installingModel}...</div>
                      <div className="text-xs text-foreground">{pullProgress}</div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-muted">
                      Installed Models ({Array.isArray(ollamaModels) ? ollamaModels.length : 0})
                    </label>
                    <button onClick={refreshOllamaModels} className="text-xs text-accent hover:underline flex items-center gap-1">
                      Refresh
                    </button>
                  </div>
                  
                  {!Array.isArray(ollamaModels) || ollamaModels.length === 0 ? (
                    <div className="p-6 bg-white/5 border border-border rounded-lg text-center">
                      <p className="text-sm text-muted">No models installed yet.</p>
                      <p className="text-xs text-muted mt-2">Search above to find and install models.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ollamaModels.map((model) => (
                        <div key={model.id} className="p-4 bg-white/5 border border-border rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-foreground">{model.name}</div>
                              {model.id === selectedModel && aiProvider === 'ollama' && (
                                <span className="px-2 py-0.5 text-xs bg-accent/20 text-accent rounded">Active</span>
                              )}
                            </div>
                            {model.desc && <div className="text-xs text-muted mt-1">{model.desc}</div>}
                            {model.limits && <div className="text-xs text-muted mt-1">{model.limits}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedModel(model.id);
                                setAIBackendModel(model.id);
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-white/10 text-foreground rounded hover:bg-white/20 transition-colors"
                            >
                              Select
                            </button>
                            <button
                              onClick={() => handleDeleteModel(model.name)}
                              disabled={deletingModel === model.name}
                              className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors disabled:opacity-50"
                              title="Delete model"
                            >
                              {deletingModel === model.name ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <button
                    onClick={() => {
                      setAIProvider('ollama');
                      const models = Array.isArray(ollamaModels) ? ollamaModels : [];
                      if (models.length > 0 && selectedModel) {
                        if (models.some(m => m.id === selectedModel)) {
                          setAIBackendModel(selectedModel);
                        } else {
                          const defaultModel = models[0]?.id;
                          if (defaultModel) {
                            setAIBackendModel(defaultModel);
                            setSelectedModel(defaultModel);
                          }
                        }
                      }
                    }}
                    disabled={!Array.isArray(ollamaModels) || ollamaModels.length === 0 || !serverStatus?.running}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                      aiProvider === 'ollama' 
                        ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                        : 'bg-white/5 text-muted hover:text-foreground hover:bg-white/10 border border-border'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {aiProvider === 'ollama' ? (
                      <div className="flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        Currently Active
                      </div>
                    ) : (
                      !Array.isArray(ollamaModels) || ollamaModels.length === 0 ? "Install at least one model to use Ollama" :
                      !serverStatus?.running ? "Start Ollama server to use local models" :
                      "Set Ollama as Active Provider"
                    )}
                  </button>
                  <p className="mt-2 text-[11px] text-muted text-center">
                    {aiProvider === 'ollama' 
                      ? `Ollama is your current AI provider`
                      : `Click to switch to Ollama for all AI interactions`
                    }
                  </p>
                </div>

                <div className="p-4 bg-white/5 border border-border rounded-lg">
                  <div className="flex gap-3">
                    <Cpu className="w-5 h-5 text-accent shrink-0" />
                    <div className="text-xs text-muted leading-relaxed">
                      <p className="text-foreground font-medium mb-1">Local Model Recommendations</p>
                      <p className="mb-2">For best performance on mid-tier hardware (4 cores, 2GB VRAM):</p>
                      <ul className="list-disc list-inside space-y-1 mb-2">
                        <li><strong>llama3.2:3b</strong> - Fast, efficient, good for basic tasks</li>
                        <li><strong>llama3.2:1b</strong> - Ultra-lightweight, fastest inference</li>
                        <li><strong>phi3:mini</strong> - Microsoft's efficient model</li>
                        <li><strong>mistral:7b</strong> - Excellent reasoning, efficient</li>
                      </ul>
                      <p className="mb-2">For high-end hardware (8+ cores, 8GB+ VRAM):</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>llama3.1:8b</strong> - Balanced performance and quality</li>
                        <li><strong>llama3.1:70b</strong> - High quality, requires more VRAM</li>
                        <li><strong>qwen2.5:14b</strong> - Enhanced capabilities</li>
                        <li><strong>deepseek-r1:14b</strong> - Strong reasoning</li>
                      </ul>
                      <p className="mt-3 text-foreground font-medium">
                        Note: Models are automatically quantized for optimal performance. Install Ollama from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">ollama.com</a> if not already installed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <button 
            onClick={() => setShowSettings(false)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-muted transition-colors border"
            style={{ borderColor: 'var(--border-color)' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 rounded text-sm text-white font-semibold transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-accent/20"
            style={{ background: 'var(--accent-gradient)' }}
          >
            <Save className="w-4 h-4 inline-block mr-2" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Settings Icon Component */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(155, 155, 155, 0.2);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(155, 155, 155, 0.4);
        }
      `}</style>
    </div>
  );
}

// Helper icon component
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}