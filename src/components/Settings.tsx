import { X, Save, Palette, Cpu, AlertCircle, ExternalLink, Key, ChevronDown, Plus, Trash2, Edit2, Check, Zap, Globe, Brain, Moon, Server, Search, Download, Loader2 } from 'lucide-react';
import { useStore, CustomTheme } from '../store';
import { useState, useEffect, useRef } from 'react';

type Tab = 'themes' | 'groq' | 'grok' | 'gemini' | 'moonshot' | 'ollama';

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
    recommended: false,
  },
  {
    id: 'moonshot-v1-32k',
    name: 'Moonshot v1 32K',
    desc: 'Extended context for larger tasks',
    limits: 'Requires API key',
    provider: 'moonshot' as const,
    recommended: false,
  },
  {
    id: 'moonshot-v1-128k',
    name: 'Moonshot v1 128K',
    desc: '128K context window - RECOMMENDED',
    limits: 'Requires API key',
    provider: 'moonshot' as const,
    recommended: true,
  },
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
  } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>(aiProvider);
  const [deepseekApiKeyInput, setDeepseekApiKeyInput] = useState(deepseekApiKey);
  const [groqApiKeyInput, setGroqApiKeyInput] = useState(groqApiKey);
  const [grokApiKeyInput, setGrokApiKeyInput] = useState(grokApiKey);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState(geminiApiKey);
  const [moonshotApiKeyInput, setMoonshotApiKeyInput] = useState(moonshotApiKey);
  const [selectedModel, setSelectedModel] = useState(aiBackendModel);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [tempTheme, setTempTheme] = useState<Omit<CustomTheme, 'id'>>(DEFAULT_CUSTOM_THEME);
  const [showReplacePrompt, setShowReplacePrompt] = useState(false);
  const [showStandardDropdown, setShowStandardDropdown] = useState(false);
  
  // Ollama-specific state
  const [ollamaSearchQuery, setOllamaSearchQuery] = useState('');
  const [ollamaSearchResults, setOllamaSearchResults] = useState<Array<{ name: string; description?: string }>>([]);
  const [ollamaServerStatus, setOllamaServerStatus] = useState<{ running: boolean; error?: string } | null>(null);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  
  const settingsRef = useRef<HTMLDivElement>(null);
  const standardDropdownRef = useRef<HTMLDivElement>(null);

  const getCurrentModels = () => {
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
    setDeepseekApiKeyInput(deepseekApiKey);
    setGroqApiKeyInput(groqApiKey);
    setGrokApiKeyInput(grokApiKey);
    setGeminiApiKeyInput(geminiApiKey);
    setMoonshotApiKeyInput(moonshotApiKey);
    setSelectedModel(aiBackendModel);
    setActiveTab(aiProvider);
  }, [deepseekApiKey, groqApiKey, grokApiKey, geminiApiKey, moonshotApiKey, aiBackendModel, showSettings, aiProvider]);

  // Sync selectedModel when switching provider tabs
  useEffect(() => {
    if (activeTab !== 'themes') {
      const currentModels = getCurrentModels();
      if (Array.isArray(currentModels)) {
        const modelForProvider = currentModels.find(m => m.id === selectedModel);
        if (!modelForProvider && currentModels.length > 0) {
          // Selected model doesn't belong to this provider, switch to recommended or first
          const newModel = currentModels.find(m => (m as any).recommended)?.id || currentModels[0].id;
          setSelectedModel(newModel);
        }
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'ollama' && showSettings) {
      checkOllamaServer();
      loadOllamaModels();
    }
  }, [activeTab, showSettings]);

  const checkOllamaServer = async () => {
    if (window.electronAPI?.ollama?.checkServer) {
      const status = await window.electronAPI.ollama.checkServer();
      setOllamaServerStatus(status);
    }
  };

  const loadOllamaModels = async () => {
    if (window.electronAPI?.ollama?.listModels) {
      const result = await window.electronAPI.ollama.listModels();
      if (result.success) {
        // Update store with installed models
        useStore.setState({
          ollamaModels: result.models.map((m: any) => ({
            id: m.id,
            name: m.name,
            desc: m.desc,
            limits: m.limits,
            provider: 'ollama',
            installed: true,
          }))
        });
      }
    }
  };

  const handleSearchModels = async (query: string) => {
    if (!query.trim()) {
      setOllamaSearchResults([]);
      return;
    }
    if (window.electronAPI?.ollama?.searchModels) {
      const result = await window.electronAPI.ollama.searchModels(query);
      if (result.success) {
        setOllamaSearchResults(result.models);
      }
    }
  };

  const handlePullModel = async (modelName: string) => {
    setPullingModel(modelName);
    setPullProgress('Starting download...');
    
    // Setup progress listener
    const removeListener = window.electronAPI?.ollama?.onPullProgress?.((data: any) => {
      if (data.modelName === modelName) {
        setPullProgress(data.progress);
      }
    });

    if (window.electronAPI?.ollama?.pullModel) {
      const result = await window.electronAPI.ollama.pullModel(modelName);
      if (result.success) {
        await loadOllamaModels();
        setPullingModel(null);
        setPullProgress('');
      } else {
        setPullProgress(`Error: ${result.error}`);
        setTimeout(() => {
          setPullingModel(null);
          setPullProgress('');
        }, 3000);
      }
    }
    
    if (removeListener) removeListener();
  };

  const handleDeleteModel = async (modelName: string) => {
    setDeletingModel(modelName);
    if (window.electronAPI?.ollama?.deleteModel) {
      const result = await window.electronAPI.ollama.deleteModel(modelName);
      if (result.success) {
        await loadOllamaModels();
      }
    }
    setDeletingModel(null);
  };

  const handleSave = async () => {
    // Save provider-specific API keys
    setDeepseekApiKey(deepseekApiKeyInput);
    setGroqApiKey(groqApiKeyInput);
    setGrokApiKey(grokApiKeyInput);
    setGeminiApiKey(geminiApiKeyInput);
    setMoonshotApiKey(moonshotApiKeyInput);
    
    const providerToSet = activeTab === 'themes' ? aiProvider : activeTab as 'grok' | 'groq' | 'gemini' | 'moonshot' | 'ollama';
    setAIProvider(providerToSet);
    
    if (activeTab !== 'themes') {
      const currentModels = getCurrentModels();
      const modelBelongsToProvider = currentModels.some(m => m.id === selectedModel);
      const finalModel = modelBelongsToProvider ? selectedModel : (currentModels.find(m => (m as any).recommended)?.id || currentModels[0]?.id);
      
      if (finalModel) {
        setAIBackendModel(finalModel);
        
        // If Ollama model is selected, run/load it into memory and persist selection
        if (activeTab === 'ollama' && window.electronAPI?.ollama?.runModel) {
          console.log('[Settings] Loading and persisting Ollama model:', finalModel);
          const result = await window.electronAPI.ollama.runModel(finalModel);
          if (!result.success) {
            console.error('[Settings] Failed to load Ollama model:', result.error);
          }
        }
      }
    }
    
    setShowSettings(false);
  };

  const startEditing = (theme: CustomTheme) => {
    setEditingThemeId(theme.id);
    setTempTheme({
      name: theme.name,
      colors: { ...theme.colors },
      transparency: theme.transparency,
    });
  };

  const startCreating = () => {
    if (customThemes.length >= 5) {
      setShowReplacePrompt(true);
    } else {
      setEditingThemeId('new');
      setTempTheme(DEFAULT_CUSTOM_THEME);
    }
  };

  const saveCustomTheme = () => {
    if (editingThemeId === 'new') {
      addCustomTheme(tempTheme);
    } else if (editingThemeId) {
      updateCustomTheme(editingThemeId, tempTheme);
    }
    setEditingThemeId(null);
  };

  const replaceTheme = (id: string) => {
    removeCustomTheme(id);
    setEditingThemeId('new');
    setTempTheme(DEFAULT_CUSTOM_THEME);
    setShowReplacePrompt(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        if (!showStandardDropdown) setShowSettings(false);
      }
      if (standardDropdownRef.current && !standardDropdownRef.current.contains(event.target as Node)) {
        setShowStandardDropdown(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSettings, setShowSettings, showStandardDropdown]);

  if (!showSettings) {
    return null;
  }

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

  const getApiKeyInput = () => {
    switch (activeTab) {
      case 'grok': return grokApiKeyInput;
      case 'groq': return groqApiKeyInput;
      case 'gemini': return geminiApiKeyInput;
      case 'moonshot': return moonshotApiKeyInput;
      default: return '';
    }
  };

  const setApiKeyInput = (key: string) => {
    switch (activeTab) {
      case 'grok': setGrokApiKeyInput(key); break;
      case 'groq': setGroqApiKeyInput(key); break;
      case 'gemini': setGeminiApiKeyInput(key); break;
      case 'moonshot': setMoonshotApiKeyInput(key); break;
    }
  };

  const getApiKeyUrl = () => {
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

  const currentModels = getCurrentModels();
  const currentModelInfo = currentModels.find(m => m.id === selectedModel) || currentModels[0];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8">
      <div 
        ref={settingsRef} 
        className="w-full max-w-2xl rounded-xl border shadow-2xl flex flex-col max-h-[90vh] transition-colors"
        style={{ backgroundColor: 'var(--settings-bg)', borderColor: 'var(--border-color)' }}
      >
        <div className="p-6 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl font-semibold text-foreground">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="p-2 hover:bg-white/5 rounded text-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b shrink-0 overflow-x-auto" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('themes')}
            className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors shrink-0 ${
              activeTab === 'themes'
                ? 'text-accent border-b-2 border-accent bg-white/5'
                : 'text-muted hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Palette className="w-4 h-4" />
            Themes
          </button>
          <button
            onClick={() => setActiveTab('grok')}
            className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors shrink-0 ${
              activeTab === 'grok'
                ? 'text-accent border-b-2 border-accent bg-white/5'
                : 'text-muted hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Brain className="w-4 h-4" />
            Grok
          </button>
          <button
            onClick={() => setActiveTab('groq')}
            className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors shrink-0 ${
              activeTab === 'groq'
                ? 'text-accent border-b-2 border-accent bg-white/5'
                : 'text-muted hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Zap className="w-4 h-4" />
            Groq
          </button>
          <button
            onClick={() => setActiveTab('gemini')}
            className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors shrink-0 ${
              activeTab === 'gemini'
                ? 'text-accent border-b-2 border-accent bg-white/5'
                : 'text-muted hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Globe className="w-4 h-4" />
            Gemini
          </button>
          <button
            onClick={() => setActiveTab('moonshot')}
            className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors shrink-0 ${
              activeTab === 'moonshot'
                ? 'text-accent border-b-2 border-accent bg-white/5'
                : 'text-muted hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Moon className="w-4 h-4" />
            Moonshot
          </button>
          <button
            onClick={() => setActiveTab('ollama')}
            className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors shrink-0 ${
              activeTab === 'ollama'
                ? 'text-accent border-b-2 border-accent bg-white/5'
                : 'text-muted hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Server className="w-4 h-4" />
            Ollama
          </button>
        </div>

        <div className={`p-6 overflow-y-auto flex-1 custom-scrollbar ${activeTab === 'themes' ? 'min-h-[600px]' : ''}`}>
          {/* Themes Tab */}
          {activeTab === 'themes' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted mb-4">
                  Interface Theme
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['light', 'dark', 'alpha', 'standard', 'custom'] as const).map((t) => (
                    <div key={t} className="relative">
                      <button
                        onClick={() => {
                          if (t === 'standard') {
                            setShowStandardDropdown(!showStandardDropdown);
                          } else {
                            setTheme(t);
                            setShowStandardDropdown(false);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg capitalize text-xs font-medium transition-all border ${
                          theme === t
                            ? 'text-white border-accent shadow-lg'
                            : 'bg-white/5 border-border text-muted hover:border-accent hover:text-foreground'
                        }`}
                        style={
                          theme === t
                            ? {
                                background: 'var(--accent-gradient)',
                              }
                            : {}
                        }
                      >
                        {t === 'standard' && activeStandardThemeId 
                          ? STANDARD_THEMES.find(st => st.id === activeStandardThemeId)?.name || 'Standard'
                          : t}
                        {t === 'standard' && <ChevronDown className="w-3 h-3 inline ml-1 opacity-50" />}
                      </button>

                      {t === 'standard' && showStandardDropdown && (
                        <div 
                          ref={standardDropdownRef}
                          className="absolute top-full left-0 mt-1 w-48 rounded-xl border shadow-2xl z-[70] py-1 overflow-hidden backdrop-blur-xl"
                          style={{ backgroundColor: 'var(--settings-bg)', borderColor: 'var(--border-color)' }}
                        >
                          <div className="max-h-64 overflow-y-auto custom-scrollbar">
                            {STANDARD_THEMES.map((st) => (
                              <button
                                key={st.id}
                                onClick={() => {
                                  setTheme('standard');
                                  setActiveStandardThemeId(st.id);
                                  setShowStandardDropdown(false);
                                }}
                                className={`w-full px-4 py-2 text-left text-xs transition-colors hover:bg-white/10 ${
                                  activeStandardThemeId === st.id ? 'text-accent bg-accent/5 font-medium' : 'text-muted'
                                }`}
                              >
                                {st.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {theme === 'custom' && (
                <div className="space-y-4 border-t pt-6" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted">Custom Themes ({customThemes.length}/5)</h3>
                    <button
                      onClick={startCreating}
                      className="flex items-center gap-1 text-xs text-accent hover:brightness-110 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      New Theme
                    </button>
                  </div>

                  {showReplacePrompt && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-200 mb-3">Maximum 5 custom themes reached. Choose one to replace:</p>
                      <div className="flex flex-wrap gap-2">
                        {customThemes.map(t => (
                          <button
                            key={t.id}
                            onClick={() => replaceTheme(t.id)}
                            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 rounded text-xs text-amber-100 transition-colors border border-amber-500/30"
                          >
                            {t.name}
                          </button>
                        ))}
                        <button
                          onClick={() => setShowReplacePrompt(false)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs text-muted transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {customThemes.map((t) => (
                      <div
                        key={t.id}
                        className={`group flex items-center justify-between p-3 rounded-lg border transition-all ${
                          activeCustomThemeId === t.id
                            ? 'bg-white/10 border-accent/50'
                            : 'bg-white/5 border-border hover:border-accent/30'
                        }`}
                      >
                        <button
                          onClick={() => setActiveCustomThemeId(t.id)}
                          className="flex-1 flex items-center gap-3 text-left"
                        >
                          <div
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{ backgroundColor: t.colors.accentColor }}
                          />
                          <span className={`text-sm ${activeCustomThemeId === t.id ? 'text-accent font-medium' : 'text-foreground'}`}>
                            {t.name}
                          </span>
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditing(t)}
                            className="p-1.5 hover:bg-white/10 rounded text-muted hover:text-foreground transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeCustomTheme(t.id)}
                            className="p-1.5 hover:bg-rose-500/20 rounded text-muted hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

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
                              value={tempTheme.name}
                              onChange={(e) => setTempTheme({ ...tempTheme, name: e.target.value })}
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
                            ].map((item) => (
                              <div key={item.key}>
                                <label className="block text-[10px] font-medium text-muted mb-1 uppercase tracking-wider">{item.label}</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={tempTheme.colors[item.key as keyof typeof tempTheme.colors]}
                                    onChange={(e) => setTempTheme({
                                      ...tempTheme,
                                      colors: { ...tempTheme.colors, [item.key]: e.target.value }
                                    })}
                                    className="w-8 h-8 bg-transparent border-0 p-0 cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    value={tempTheme.colors[item.key as keyof typeof tempTheme.colors]}
                                    onChange={(e) => setTempTheme({
                                      ...tempTheme,
                                      colors: { ...tempTheme.colors, [item.key]: e.target.value }
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
                              <span className="text-xs text-accent font-mono">{(tempTheme.transparency * 100).toFixed(0)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={tempTheme.transparency}
                              onChange={(e) => setTempTheme({ ...tempTheme, transparency: parseFloat(e.target.value) })}
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
                            onClick={saveCustomTheme}
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

              <p className="mt-4 text-xs text-muted italic">
                Changes the global look and feel of AlphaStudio.
              </p>
            </div>
          )}

          {/* AI Provider Tabs (Grok, Groq, Gemini, Moonshot) */}
          {(activeTab === 'grok' || activeTab === 'groq' || activeTab === 'gemini' || activeTab === 'moonshot') && (
            <div className="space-y-8">
              {/* Provider Description */}
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

              {/* API Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-muted">
                    <Key className="w-4 h-4 text-accent" />
                    {getProviderName()} API Key
                  </label>
                  <a 
                    href={getApiKeyUrl()} 
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
                    value={getApiKeyInput()}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={`Enter your ${getProviderName()} API key`}
                    className="w-full px-4 py-2.5 bg-white/5 border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted leading-relaxed">
                  Your key is saved locally. {
                    activeTab === 'grok' ? 'Grok 4.1 Fast (2M context, agent-optimized)' :
                    activeTab === 'groq' ? 'Llama 3.3 70B (128K context)' :
                    activeTab === 'gemini' ? 'Gemini 2.5 Flash (1M context)' :
                    'Moonshot v1 128K (128K context)'
                  } is recommended.
                </p>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  {getProviderName()} Model
                </label>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full appearance-none px-4 py-3 bg-white/5 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer transition-all pr-10"
                  >
                    {currentModels.map((model) => (
                      <option key={model.id} value={model.id} className="bg-background">
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </div>
                </div>
                
                {/* Active Model Details Card */}
                {currentModelInfo && (
                  <div className="mt-3 p-4 bg-white/5 border border-border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-foreground font-medium">{currentModelInfo.desc}</div>
                      {(currentModelInfo as any).recommended && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] bg-white/10 text-muted px-1.5 py-0.5 rounded border border-border">ID: {currentModelInfo.id}</span>
                      <span className="text-[10px] bg-white/10 text-muted px-1.5 py-0.5 rounded border border-border">Limits: {currentModelInfo.limits}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Set as Active Provider Button */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  onClick={() => {
                    // Save the API key for the current provider first
                    const currentApiKey = getApiKeyInput();
                    if (currentApiKey) {
                      switch (activeTab) {
                        case 'grok':
                          setGrokApiKey(currentApiKey);
                          break;
                        case 'groq':
                          setGroqApiKey(currentApiKey);
                          break;
                        case 'gemini':
                          setGeminiApiKey(currentApiKey);
                          break;
                        case 'moonshot':
                          setMoonshotApiKey(currentApiKey);
                          break;
                      }
                    }
                    // Then set the provider
                    setAIProvider(activeTab);
                    // Also update the model if on a provider tab
                    if (activeTab !== 'themes') {
                      const modelBelongsToProvider = getCurrentModels().some(m => m.id === selectedModel);
                      if (modelBelongsToProvider) {
                        setAIBackendModel(selectedModel);
                      } else {
                        const fallbackModel = getCurrentModels().find(m => (m as any).recommended)?.id || getCurrentModels()[0]?.id;
                        if (fallbackModel) {
                          setAIBackendModel(fallbackModel);
                        }
                      }
                    }
                  }}
                  disabled={!getApiKeyInput()}
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

              {/* Provider-specific Info */}
              <div className="p-4 bg-white/5 border border-border rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-accent shrink-0" />
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
              {/* Provider Description */}
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
                    {/* Server Status */}
                    <div className="flex items-center gap-2 mt-3">
                      {ollamaServerStatus ? (
                        ollamaServerStatus.running ? (
                          <div className="flex items-center gap-2 text-xs text-green-400">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span>Ollama server is running</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-red-400">
                            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                            <span>Ollama server not running</span>
                            {ollamaServerStatus.error && (
                              <span className="text-muted">({ollamaServerStatus.error})</span>
                            )}
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Checking server status...</span>
                        </div>
                      )}
                      <button
                        onClick={checkOllamaServer}
                        className="ml-auto text-xs text-accent hover:underline"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search for Models */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  <Search className="w-4 h-4 inline mr-2" />
                  Search & Install Models
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ollamaSearchQuery}
                    onChange={(e) => {
                      const query = e.target.value;
                      setOllamaSearchQuery(query);
                      handleSearchModels(query);
                    }}
                    placeholder="Search for models (e.g., llama3.2:3b, mistral:7b, phi3:mini)"
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                  />
                </div>
                {ollamaSearchResults.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {ollamaSearchResults.map((model, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white/5 border border-border rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{model.name}</div>
                          {model.description && (
                            <div className="text-xs text-muted mt-1">{model.description}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handlePullModel(model.name)}
                          disabled={pullingModel === model.name || !!pullingModel}
                          className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {pullingModel === model.name ? (
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
                {pullingModel && pullProgress && (
                  <div className="mt-3 p-3 bg-white/5 border border-border rounded-lg">
                    <div className="text-xs text-muted mb-1">Installing {pullingModel}...</div>
                    <div className="text-xs text-foreground">{pullProgress}</div>
                  </div>
                )}
              </div>

              {/* Installed Models */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-muted">
                    Installed Models ({Array.isArray(ollamaModels) ? ollamaModels.length : 0})
                  </label>
                  <button
                    onClick={loadOllamaModels}
                    className="text-xs text-accent hover:underline flex items-center gap-1"
                  >
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
                      <div
                        key={model.id}
                        className="p-4 bg-white/5 border border-border rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-foreground">{model.name}</div>
                            {model.id === selectedModel && aiProvider === 'ollama' && (
                              <span className="px-2 py-0.5 text-xs bg-accent/20 text-accent rounded">Active</span>
                            )}
                          </div>
                          {model.desc && (
                            <div className="text-xs text-muted mt-1">{model.desc}</div>
                          )}
                          {model.limits && (
                            <div className="text-xs text-muted mt-1">{model.limits}</div>
                          )}
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

              {/* Set as Active Provider */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  onClick={() => {
                    setAIProvider('ollama');
                    const models = Array.isArray(ollamaModels) ? ollamaModels : [];
                    if (models.length > 0 && selectedModel) {
                      const modelBelongsToProvider = models.some(m => m.id === selectedModel);
                      if (modelBelongsToProvider) {
                        setAIBackendModel(selectedModel);
                      } else {
                        const fallbackModel = models[0]?.id;
                        if (fallbackModel) {
                          setAIBackendModel(fallbackModel);
                          setSelectedModel(fallbackModel);
                        }
                      }
                    }
                  }}
                  disabled={!Array.isArray(ollamaModels) || ollamaModels.length === 0 || !ollamaServerStatus?.running}
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
                    `Set Ollama as Active Provider`
                  )}
                </button>
                <p className="mt-2 text-[11px] text-muted text-center">
                  {aiProvider === 'ollama' 
                    ? 'Ollama is your current AI provider'
                    : !Array.isArray(ollamaModels) || ollamaModels.length === 0
                    ? 'Install at least one model to use Ollama'
                    : !ollamaServerStatus?.running
                    ? 'Start Ollama server to use local models'
                    : 'Click to switch to Ollama for all AI interactions'
                  }
                </p>
              </div>

              {/* Info */}
              <div className="p-4 bg-white/5 border border-border rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-accent shrink-0" />
                  <div className="text-xs text-muted leading-relaxed">
                    <p className="text-foreground font-medium mb-1">Local Model Recommendations</p>
                    <p className="mb-2">
                      For best performance on mid-tier hardware (4 cores, 2GB VRAM):
                    </p>
                    <ul className="list-disc list-inside space-y-1 mb-2">
                      <li><strong>llama3.2:3b</strong> - Fast, efficient, good for basic tasks</li>
                      <li><strong>llama3.2:1b</strong> - Ultra-lightweight, fastest inference</li>
                      <li><strong>phi3:mini</strong> - Microsoft's efficient model</li>
                      <li><strong>mistral:7b</strong> - Excellent reasoning, efficient</li>
                    </ul>
                    <p className="mb-2">
                      For high-end hardware (8+ cores, 8GB+ VRAM):
                    </p>
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
            style={{
              background: 'var(--accent-gradient)',
            }}
          >
            <Save className="w-4 h-4 inline-block mr-2" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
