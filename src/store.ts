import { create } from 'zustand';
import { FilePane, FilePaneType } from './models/file-pane.model';
import { ProjectPlan, PlanStep } from './models/plan.model';

export type ThemeType = 'light' | 'dark' | 'alpha' | 'custom' | 'standard';

export interface CustomTheme {
  id: string;
  name: string;
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    textPrimary: string;
    textSecondary: string;
    borderColor: string;
    accentColor: string;
    sidebarBg: string;
    chatBg: string;
    headerBg: string;
    inputBg: string;
    inputBorder: string;
    userMsgBg: string;
    userMsgBorder: string;
    indicatorColor: string;
    buttonBg: string;
    buttonText: string;
    settingsBg: string;
    contextMenuHoverBg?: string;
  };
  transparency: number;
}

export interface TerminalSettings {
  fontSize: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  fontFamily: string;
  shell: string;
}

export interface Task {
  id: string;
  content: string;
  completed: boolean;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  context?: {
    files?: Array<{ path: string; content?: string; startLine?: number; endLine?: number; size?: number }>;
    images?: Array<{ path: string; data: string }>;
  };
  widgets?: Array<{ type: 'task' | 'terminal'; data: any }>;
}

export interface DiffContent {
  original: string;
  modified: string;
  filePath?: string;
  visible: boolean;
}

export interface PendingDiff {
  filePath: string;
  original: string;
  modified: string;
}

interface Store {
  // UI State
  sidebarVisible: boolean;
  chatVisible: boolean;
  sidebarWidth: number;
  chatWidth: number;
  setSidebarVisible: (visible: boolean) => void;
  setChatVisible: (visible: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setChatWidth: (width: number) => void;
  toggleSidebar: () => void;
  toggleChat: () => void;
  
  // Theme
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  customThemes: CustomTheme[];
  activeCustomThemeId: string | null;
  activeStandardThemeId: string | null;
  addCustomTheme: (theme: Omit<CustomTheme, 'id'>) => void;
  updateCustomTheme: (id: string, theme: Partial<CustomTheme>) => void;
  removeCustomTheme: (id: string) => void;
  setActiveCustomThemeId: (id: string | null) => void;
  setActiveStandardThemeId: (id: string | null) => void;
  
  // Settings
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  activeSettingsTab: string;
  setActiveSettingsTab: (tab: string) => void;
  
  // Terminal Settings
  terminalSettings: TerminalSettings;
  setTerminalSettings: (settings: Partial<TerminalSettings>) => void;

  // AI Provider Settings (DeepSeek removed - using dedicated provider services)
  aiProvider: 'groq' | 'grok' | 'gemini' | 'moonshot' | 'ollama';
  setAIProvider: (provider: 'groq' | 'grok' | 'gemini' | 'moonshot' | 'ollama') => void;
  
  // Provider-specific API keys
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  deepseekApiKey: string;
  setDeepseekApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  grokApiKey: string;
  setGrokApiKey: (key: string) => void;
  moonshotApiKey: string;
  setMoonshotApiKey: (key: string) => void;
  
  // AI Backend Model
  aiBackendModel: string;
  setAIBackendModel: (model: string) => void;
  
  // Available Models for each provider
  availableModels: Array<{ id: string; name: string; desc?: string; limits?: string; provider: string }>;
  setAvailableModels: (models: Array<{ id: string; name: string; desc?: string; limits?: string; provider: string }>) => void;
  refreshModels: () => Promise<void>;
  
  // Provider-specific model lists
  deepseekModels: Array<{ id: string; name: string; desc?: string; limits?: string }>;
  groqModels: Array<{ id: string; name: string; desc?: string; limits?: string }>;
  grokModels: Array<{ id: string; name: string; desc?: string; limits?: string }>;
  ollamaModels: Array<{ id: string; name: string; desc?: string; limits?: string; installed?: boolean }>;
  refreshOllamaModels: () => Promise<void>;
  geminiModels: Array<{ id: string; name: string; desc?: string; limits?: string }>;
  
  // Tasks (now managed by chat widgets)
  tasks: Task[];
  addTask: (content: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearCompletedTasks: () => void;
  
  // Chat
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  clearAllAgenticState: () => void;
  
  // Context
  contextFiles: Array<{ path: string; content?: string; startLine?: number; endLine?: number; size?: number }>;
  contextImages: Array<{ path: string; data: string }>;
  addContextFile: (file: { path: string; content?: string; startLine?: number; endLine?: number; size?: number }) => void;
  addContextImage: (image: { path: string; data: string }) => void;
  removeContextFile: (index: number) => void;
  removeContextImage: (index: number) => void;
  clearContext: () => void;
  projectContext: string | null;
  setProjectContext: (path: string | null) => void;
  contextMode: 'full' | 'smart' | 'minimal';
  setContextMode: (mode: 'full' | 'smart' | 'minimal') => void;
  isBuildingContext: boolean;
  setIsBuildingContext: (building: boolean) => void;
  
  // Diff
  diffContent: DiffContent | null;
  setDiffContent: (diff: DiffContent | null) => void;
  
  // Plan/To-Do List
  activePlan: ProjectPlan | null;
  setActivePlan: (plan: ProjectPlan | null) => void;
  updatePlanStep: (stepId: string, status: PlanStep['status']) => void;
  
  // Pending Diffs (for batch approval)
  pendingDiffs: Map<string, PendingDiff>;
  diffHistory: Map<string, PendingDiff>;
  acceptedDiffs: Set<string>;
  rejectedDiffs: Set<string>;
  addPendingDiff: (filePath: string, original: string, modified: string) => void;
  clearPendingDiffs: () => void;
  acceptDiff: (filePath: string) => void;
  rejectDiff: (filePath: string) => void;
  
  // Artifacts (code blocks, examples, etc.)
  artifacts: Map<string, { id: string; content: string; language?: string; timestamp: number }>;
  addArtifact: (content: string, language?: string) => string;
  removeArtifact: (id: string) => void;
  clearArtifacts: () => void;
  
  // Agent Terminal
  terminalOutput: Array<{ command?: string; output: string; type: 'command' | 'stdout' | 'stderr' | 'error' }>;
  pendingElevatedCommand: { command: string; callId?: string } | null;
  addTerminalOutput: (output: { command?: string; output: string; type: 'command' | 'stdout' | 'stderr' | 'error' }) => void;
  clearTerminal: () => void;
  setPendingElevatedCommand: (command: { command: string; callId?: string } | null) => void;
  
  // Canvas
  panes: FilePane[];
  activePaneId: string | null;
  openPane: (pane: FilePane) => void;
  closePane: (id: string) => void;
  setActivePane: (id: string) => void;
  updatePaneContent: (id: string, content: string) => void;
  openFileByPath: (filePath: string) => Promise<void>;
  createNewFile: (type?: 'code' | 'markdown') => void;
  saveFile: (id: string) => Promise<boolean>;
  refreshOpenFiles: () => Promise<void>;
}

export const useStore = create<Store>()((set) => ({
  // UI State
  sidebarVisible: false,
  chatVisible: false,
  sidebarWidth: 256,
  chatWidth: 384,
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  setChatVisible: (visible) => set({ chatVisible: visible }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setChatWidth: (width) => set({ chatWidth: width }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  toggleChat: () => set((state) => ({ chatVisible: !state.chatVisible })),
  
  // Theme
  theme: 'alpha',
  setTheme: (theme) => set({ theme }),
  customThemes: [],
  activeCustomThemeId: null,
  activeStandardThemeId: null,
  addCustomTheme: (theme) => set((state) => {
    const newTheme = { 
      ...theme, 
      id: Date.now().toString(),
      colors: {
        ...theme.colors,
        contextMenuHoverBg: theme.colors.contextMenuHoverBg || 'rgba(148, 163, 184, 0.15)',
      }
    };
    const newThemes = [...state.customThemes, newTheme];
    if (newThemes.length > 5) {
      return { customThemes: newThemes.slice(-5) };
    }
    return { customThemes: newThemes };
  }),
  updateCustomTheme: (id, theme) => set((state) => ({
    customThemes: state.customThemes.map((t) => (t.id === id ? { ...t, ...theme } : t)),
  })),
  removeCustomTheme: (id) => set((state) => ({
    customThemes: state.customThemes.filter((t) => t.id !== id),
    activeCustomThemeId: state.activeCustomThemeId === id ? null : state.activeCustomThemeId,
    theme: state.activeCustomThemeId === id ? 'alpha' : state.theme,
  })),
  setActiveCustomThemeId: (id) => set({ activeCustomThemeId: id }),
  setActiveStandardThemeId: (id) => set({ activeStandardThemeId: id }),
  
  // Settings
  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),
  activeSettingsTab: 'themes',
  setActiveSettingsTab: (tab) => set({ activeSettingsTab: tab }),

  // Terminal Settings
  terminalSettings: {
    fontSize: 13,
    cursorStyle: 'block',
    cursorBlink: true,
    fontFamily: '"JetBrainsMono Nerd Font", "FiraCode Nerd Font", "MesloLGS NF", "Cascadia Code", Consolas, monospace',
    shell: ''
  },
  setTerminalSettings: (settings) => set((state) => ({
    terminalSettings: { ...state.terminalSettings, ...settings }
  })),
  
  // AI Provider Settings
  aiProvider: 'gemini',
  setAIProvider: (provider) => set((state) => {
    let newModel = 'gemini-2.5-flash';
    
    if (provider === 'ollama') {
      newModel = state.ollamaModels.length > 0 ? state.ollamaModels[0].id : 'llama3.2';
    } else {
      newModel = state.availableModels.find(m => m.provider === provider && (m as any).recommended)?.id ||
                 state.availableModels.find(m => m.provider === provider)?.id ||
                 'gemini-2.5-flash';
    }
    
    return { aiProvider: provider, aiBackendModel: newModel };
  }),
  
  // Provider API keys
  geminiApiKey: '',
  setGeminiApiKey: (key) => set({ geminiApiKey: key }),
  deepseekApiKey: '',
  setDeepseekApiKey: (key) => set({ deepseekApiKey: key }),
  groqApiKey: '',
  setGroqApiKey: (key) => set({ groqApiKey: key }),
  grokApiKey: '',
  setGrokApiKey: (key) => set({ grokApiKey: key }),
  moonshotApiKey: '',
  setMoonshotApiKey: (key) => set({ moonshotApiKey: key }),
  
  // AI Backend Model
  aiBackendModel: 'gemini-2.5-flash',
  setAIBackendModel: (model) => set({ aiBackendModel: model }),
  
  // Available Models
  availableModels: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', desc: 'State-of-the-art, Pro-grade reasoning at Flash speed', limits: '5 RPM (free tier)', provider: 'gemini', recommended: false },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Fast, 1M context, 65K output - RECOMMENDED', limits: '15 RPM, 1M RPD (free)', provider: 'gemini', recommended: true },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Advanced reasoning, 1M context (slower)', limits: '2 RPM, 50 RPD (free)', provider: 'gemini', recommended: false },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: 'Most efficient, 1M context', limits: '15 RPM (free)', provider: 'gemini', recommended: false },
    
    { id: 'grok-4.1-fast', name: 'Grok 4.1 Fast', desc: 'Optimized for tool-calling and agentic workflows, 2M token context', limits: 'Better rate limits than Groq, optimized for agents', provider: 'grok', recommended: true },
    { id: 'grok-4.1', name: 'Grok 4.1', desc: 'Latest Grok model with enhanced reasoning and multimodal understanding', limits: 'Better rate limits than Groq', provider: 'grok', recommended: false },
    { id: 'grok-beta', name: 'Grok Beta', desc: 'Beta model with extended context (legacy)', limits: 'Better rate limits than Groq', provider: 'grok', recommended: false },
    
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', desc: '128K context, excellent reasoning', limits: 'Fast, better rate limits', provider: 'groq', recommended: true },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', desc: '128K context, very fast', limits: 'Free tier available', provider: 'groq', recommended: false },
    { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct', desc: '131K context, 16K output - low rate limit (10K TPM)', limits: 'Rate limited on free tier', provider: 'groq', recommended: false },
    
    { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', desc: '8K context window, balanced performance', limits: 'Requires API key', provider: 'moonshot', recommended: false },
    { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', desc: '32K context window', limits: 'Requires API key', provider: 'moonshot', recommended: false },
    { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', desc: '128K context window - RECOMMENDED', limits: 'Requires API key', provider: 'moonshot', recommended: true },
  ],
  setAvailableModels: (models) => set({ availableModels: models }),
  refreshModels: async () => {},
  
  deepseekModels: [],
  grokModels: [
    { id: 'grok-4.1-fast', name: 'Grok 4.1 Fast', desc: 'Optimized for tool-calling and agentic workflows, 2M token context', limits: 'Better rate limits than Groq, optimized for agents' },
    { id: 'grok-4.1', name: 'Grok 4.1', desc: 'Latest Grok model with enhanced reasoning and multimodal understanding', limits: 'Better rate limits than Groq' },
    { id: 'grok-beta', name: 'Grok Beta', desc: 'Beta model with extended context (legacy)', limits: 'Better rate limits than Groq' },
  ],
  ollamaModels: [],
  refreshOllamaModels: async () => {},
  groqModels: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', desc: '128K context, excellent reasoning', limits: 'Fast, better rate limits' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', desc: '128K context, very fast', limits: 'Free tier available' },
    { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct', desc: '131K context, 16K output - low rate limit', limits: 'Rate limited on free tier' },
  ],
  geminiModels: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', desc: 'State-of-the-art, Pro-grade reasoning at Flash speed', limits: '5 RPM (free tier)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Fast, 1M context, 65K output - RECOMMENDED', limits: '15 RPM, 1M RPD (free)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Advanced reasoning, 1M context (slower)', limits: '2 RPM, 50 RPD (free)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: 'Most efficient, 1M context', limits: '15 RPM (free)' },
  ],
  
  // Tasks
  tasks: [],
  addTask: (content) =>
    set((state) => ({
      tasks: [
        ...state.tasks,
        {
          id: Date.now().toString(),
          content,
          completed: false,
          timestamp: new Date().toISOString(),
        },
      ],
    })),
  toggleTask: (id) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      ),
    })),
  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    })),
  clearCompletedTasks: () =>
    set((state) => ({
      tasks: state.tasks.filter((task) => !task.completed),
    })),
  
  // Chat
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
        },
      ],
    })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  
  // Context
  contextFiles: [],
  contextImages: [],
  addContextFile: (file) =>
    set((state) => {
      if (state.contextFiles.some(f => f.path === file.path)) return state;
      return {
        contextFiles: [...state.contextFiles, file],
      };
    }),
  addContextImage: (image) =>
    set((state) => {
      if (state.contextImages.some(img => img.path === image.path)) return state;
      return {
        contextImages: [...state.contextImages, image],
      };
    }),
  removeContextFile: (index: number) =>
    set((state) => ({
      contextFiles: state.contextFiles.filter((_, i) => i !== index),
    })),
  removeContextImage: (index: number) =>
    set((state) => ({
      contextImages: state.contextImages.filter((_, i) => i !== index),
    })),
  clearContext: () => set({ contextFiles: [], contextImages: [] }),
  projectContext: null,
  setProjectContext: (path) => set({ projectContext: path }),
  contextMode: 'minimal' as 'full' | 'smart' | 'minimal',
  setContextMode: (mode) => set({ contextMode: mode }),
  isBuildingContext: false,
  setIsBuildingContext: (building) => set({ isBuildingContext: building }),
  
  // Diff
  diffContent: null,
  setDiffContent: (diff) => set({ diffContent: diff }),
  
  // Plan/To-Do List
  activePlan: null,
  setActivePlan: (plan) => set({ activePlan: plan }),
  updatePlanStep: (stepId, status) => set((state) => {
    if (!state.activePlan) return state;
    const updatedSteps = state.activePlan.steps.map((step) =>
      step.id === stepId ? { ...step, status } : step
    );
    return {
      activePlan: {
        ...state.activePlan,
        steps: updatedSteps,
        updatedAt: Date.now(),
      },
    };
  }),
  
  // Pending Diffs
  pendingDiffs: new Map(),
  diffHistory: new Map(),
  acceptedDiffs: new Set(),
  rejectedDiffs: new Set(),
  addPendingDiff: (filePath, original, modified) => set((state) => {
    if (state.acceptedDiffs.has(filePath) || state.rejectedDiffs.has(filePath)) {
      return state;
    }
    const newDiffs = new Map(state.pendingDiffs);
    const newHistory = new Map(state.diffHistory);
    const diff = { filePath, original, modified };
    newDiffs.set(filePath, diff);
    newHistory.set(filePath, diff);
    return { pendingDiffs: newDiffs, diffHistory: newHistory };
  }),
  clearPendingDiffs: () => set({ pendingDiffs: new Map(), diffHistory: new Map(), acceptedDiffs: new Set(), rejectedDiffs: new Set() }),
  acceptDiff: async (filePath) => {
    const state = useStore.getState();
    const diff = state.pendingDiffs.get(filePath) || state.diffHistory.get(filePath);
    if (!diff) return;
    
    if (window.electronAPI?.approveDiff) {
      await window.electronAPI.approveDiff(filePath, diff.modified);
    }
    
    useStore.setState((state) => {
      const newAccepted = new Set(state.acceptedDiffs);
      newAccepted.add(filePath);
      const newRejected = new Set(state.rejectedDiffs);
      newRejected.delete(filePath);
      const newDiffs = new Map(state.pendingDiffs);
      newDiffs.delete(filePath);
      
      const updatedPanes = state.panes.map(p => 
        p.id === filePath ? { ...p, content: diff.modified, isUnsaved: false } : p
      );
      
      const updatedContextFiles = state.contextFiles.map(f =>
        f.path === filePath ? { ...f, content: diff.modified } : f
      );
      
      return { 
        acceptedDiffs: newAccepted, 
        rejectedDiffs: newRejected, 
        pendingDiffs: newDiffs,
        panes: updatedPanes,
        contextFiles: updatedContextFiles
      };
    });
  },
  rejectDiff: async (filePath) => {
    if (window.electronAPI?.rejectDiff) {
      await window.electronAPI.rejectDiff(filePath);
    }
    
    useStore.setState((state) => {
      const newRejected = new Set(state.rejectedDiffs);
      newRejected.add(filePath);
      const newAccepted = new Set(state.acceptedDiffs);
      newAccepted.delete(filePath);
      const newDiffs = new Map(state.pendingDiffs);
      newDiffs.delete(filePath);
      return { acceptedDiffs: newAccepted, rejectedDiffs: newRejected, pendingDiffs: newDiffs };
    });
  },
  
  // Agent Terminal
  terminalOutput: [],
  pendingElevatedCommand: null,
  addTerminalOutput: (output) =>
    set((state) => ({
      terminalOutput: [...state.terminalOutput, output],
    })),
  clearTerminal: () => set({ terminalOutput: [] }),
  setPendingElevatedCommand: (command) => set({ pendingElevatedCommand: command }),
  clearAllAgenticState: () => set({
    activePlan: null,
    pendingDiffs: new Map(),
    diffHistory: new Map(),
    acceptedDiffs: new Set(),
    rejectedDiffs: new Set(),
    terminalOutput: [],
    pendingElevatedCommand: null,
    artifacts: new Map(),
  }),
  
  // Artifacts
  artifacts: new Map(),
  addArtifact: (content, language) => {
    const id = `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    set((state) => {
      const newArtifacts = new Map(state.artifacts);
      newArtifacts.set(id, { id, content, language, timestamp: Date.now() });
      return { artifacts: newArtifacts };
    });
    return id;
  },
  removeArtifact: (id) => set((state) => {
    const newArtifacts = new Map(state.artifacts);
    newArtifacts.delete(id);
    return { artifacts: newArtifacts };
  }),
  clearArtifacts: () => set({ artifacts: new Map() }),
  
  // Canvas
  panes: [],
  activePaneId: null,
  openPane: (pane) =>
    set((state) => {
      const existing = state.panes.find((p) => p.id === pane.id);
      if (existing) {
        return { activePaneId: pane.id };
      }
      return {
        panes: [...state.panes, pane],
        activePaneId: pane.id,
      };
    }),
  closePane: (id) =>
    set((state) => {
      const newPanes = state.panes.filter((p) => p.id !== id);
      let newActiveId = state.activePaneId;
      if (state.activePaneId === id) {
        if (newPanes.length > 0) {
          const index = state.panes.findIndex((p) => p.id === id);
          const newIndex = Math.max(0, index - 1);
          newActiveId = newPanes[newIndex]?.id || null;
        } else {
          newActiveId = null;
        }
      }
      return { panes: newPanes, activePaneId: newActiveId };
    }),
  setActivePane: (id) => set({ activePaneId: id }),
  updatePaneContent: (id, content) =>
    set((state) => ({
      panes: state.panes.map((p) =>
        p.id === id ? { ...p, content, isUnsaved: true } : p
      ),
    })),
  openFileByPath: async (filePath: string) => {
    const store = useStore.getState();
    const name = filePath.split('/').pop() || filePath;
    const extension = name.split('.').pop()?.toLowerCase() || '';

    let type: FilePaneType = 'code';
    let language: string = 'plaintext';
    
    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'];
    const videoExtensions = ['mp4', 'webm', 'mov', 'mkv'];
    
    if (extension === 'md') {
      type = 'markdown';
      language = 'markdown';
    } else if (['sh', 'bash', 'zsh', 'fish'].includes(extension)) {
      type = 'code';
      language = 'shell';
    } else if (extension === 'pdf') {
      type = 'pdf';
    } else if (['docx', 'doc'].includes(extension)) {
      type = 'word';
    } else if (['xlsx', 'xls'].includes(extension)) {
      type = 'excel';
    } else if (['pptx', 'ppt'].includes(extension)) {
      type = 'powerpoint';
    } else if (extension === 'one') {
      type = 'onenote';
    } else if (imageExtensions.includes(extension)) {
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.readDirectory(dirPath);
          if (!('error' in result)) {
            const mediaFiles = result.filter((item: any) => {
              if (item.type !== 'file') return false;
              const ext = item.name.split('.').pop()?.toLowerCase();
              return ext && imageExtensions.includes(ext);
            });
            if (mediaFiles.length > 0) {
              const galleryId = `gallery:image:${dirPath}`;
              const galleryPane: FilePane = {
                id: galleryId,
                name: `Images: ${dirPath.split('/').pop() || 'Root'}`,
                type: 'image-gallery',
                content: '',
                data: mediaFiles,
                isUnsaved: false,
              };
              store.openPane(galleryPane);
              return;
            }
          }
        } catch (error) {
          console.error('Failed to load image gallery:', error);
        }
      }
      type = 'code';
    } else if (videoExtensions.includes(extension)) {
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.readDirectory(dirPath);
          if (!('error' in result)) {
            const mediaFiles = result.filter((item: any) => {
              if (item.type !== 'file') return false;
              const ext = item.name.split('.').pop()?.toLowerCase();
              return ext && videoExtensions.includes(ext);
            });
            if (mediaFiles.length > 0) {
              const galleryId = `gallery:video:${dirPath}`;
              const galleryPane: FilePane = {
                id: galleryId,
                name: `Videos: ${dirPath.split('/').pop() || 'Root'}`,
                type: 'video-gallery',
                content: '',
                data: mediaFiles,
                isUnsaved: false,
              };
              store.openPane(galleryPane);
              return;
            }
          }
        } catch (error) {
          console.error('Failed to load video gallery:', error);
        }
      }
      type = 'code';
    } else {
      const languageMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        py: 'python',
        json: 'json',
        html: 'html',
        css: 'css',
        scss: 'scss',
        yaml: 'yaml',
        yml: 'yaml',
        go: 'go',
        rs: 'rust',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
      };
      language = languageMap[extension] || 'plaintext';
    }
    
    let content = '';
    if (type === 'code' || type === 'markdown') {
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.readFile(filePath);
          if (!('error' in result)) {
            content = result.content || '';
          }
        } catch (error) {
          console.error('Failed to read file:', error);
        }
      }
    }
    
    const pane: FilePane = {
      id: filePath,
      name,
      type,
      content,
      language,
      isUnsaved: false,
    };
    
    store.openPane(pane);
  },
  createNewFile: (type = 'code') => {
    const store = useStore.getState();
    const untitledCount = store.panes.filter((p) => p.id.startsWith('untitled-')).length + 1;
    const name = `Untitled-${untitledCount}`;
    const id = `untitled-${Date.now()}`;
    const pane: FilePane = {
      id,
      name,
      type: type === 'markdown' ? 'markdown' : 'code',
      content: '',
      language: type === 'markdown' ? 'markdown' : 'typescript',
      isUnsaved: true,
    };
    store.openPane(pane);
  },
  saveFile: async (id: string) => {
    const store = useStore.getState();
    const pane = store.panes.find((p) => p.id === id);
    if (!pane || !pane.isUnsaved) return false;
    
    // If it's a real file path (not untitled), just save it
    if (!id.startsWith('untitled-')) {
      if (window.electronAPI?.writeFile) {
        try {
          const writeResult = await window.electronAPI.writeFile(id, pane.content);
          if (!('error' in writeResult)) {
            useStore.setState((state) => ({
              panes: state.panes.map((p) =>
                p.id === id ? { ...p, isUnsaved: false } : p
              )
            }));
            return true;
          }
        } catch (error) {
          console.error('Failed to save file:', error);
        }
      }
    }
    
    // Otherwise show save dialog
    if (!window.electronAPI?.showSaveDialog) {
      console.error('Save dialog not available');
      return false;
    }
    
    try {
      const result = await window.electronAPI.showSaveDialog({
        defaultPath: pane.name,
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'TypeScript', extensions: ['ts', 'tsx'] },
          { name: 'JavaScript', extensions: ['js', 'jsx'] },
          { name: 'Python', extensions: ['py'] },
          { name: 'Markdown', extensions: ['md'] },
        ],
      });
      
      if (result.canceled || !result.filePath) {
        return false;
      }
      
      const filePath = result.filePath;
      const writeResult = await window.electronAPI.writeFile(filePath, pane.content);
      
      if ('error' in writeResult) {
        console.error('Failed to save file:', writeResult.error);
        return false;
      }
      
      const extension = filePath.split('.').pop()?.toLowerCase() || '';
      const fileName = filePath.split(/[/\\]/).pop() || pane.name;
      const languageMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        py: 'python',
        md: 'markdown',
      };
      const language = languageMap[extension] || 'plaintext';
      const fileType: FilePaneType = extension === 'md' ? 'markdown' : 'code';
      
      useStore.setState((state) => ({
        panes: state.panes.map((p) =>
          p.id === id
            ? {
                ...p,
                id: filePath,
                name: fileName,
                type: fileType,
                language,
                isUnsaved: false,
              }
            : p
        ),
        activePaneId: filePath,
      }));
      
      return true;
    } catch (error) {
      console.error('Error saving file:', error);
      return false;
    }
  },
  refreshOpenFiles: async () => {
    const store = useStore.getState();
    const openFiles = store.panes.filter(p => (p.type === 'code' || p.type === 'markdown') && !p.id.startsWith('untitled-'));
    
    if (openFiles.length === 0 || !window.electronAPI?.readFile) return;
    
    const updatedPanes = [...store.panes];
    let changed = false;
    
    for (const pane of openFiles) {
      try {
        const result = await window.electronAPI.readFile(pane.id);
        if (!('error' in result) && result.content !== undefined) {
          if (result.content !== pane.content) {
            const index = updatedPanes.findIndex(p => p.id === pane.id);
            if (index !== -1) {
              updatedPanes[index] = { ...pane, content: result.content, isUnsaved: false };
              changed = true;
            }
          }
        }
      } catch (error) {
        console.error(`Failed to refresh file ${pane.id}:`, error);
      }
    }
    
    if (changed) {
      set({ panes: updatedPanes });
    }
  },
}));

if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('alphastudio-storage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      
      const validGeminiModels = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];
      const validGrokModels = ['grok-4.1-fast', 'grok-4.1', 'grok-beta'];
      const validGroqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'moonshotai/kimi-k2-instruct'];
      const validMoonshotModels = ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'];
      
      let model = parsed.aiBackendModel || 'gemini-2.5-flash';
      let provider = parsed.aiProvider || 'gemini';
      
      if (provider === 'deepseek') {
        provider = 'gemini';
        model = 'gemini-2.5-flash';
      }
      
      const oldModelMap: Record<string, { provider: string, model: string }> = {
        'llama3.1': { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        'llama3.1:8b': { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        'llama-3.1-8b-instruct': { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        'meta-llama/Llama-3.1-8B-Instruct': { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        'gpt-4': { provider: 'gemini', model: 'gemini-2.5-flash' },
        'gpt-3.5-turbo': { provider: 'gemini', model: 'gemini-2.5-flash' },
        'deepseek-chat': { provider: 'gemini', model: 'gemini-2.5-flash' },
        'deepseek-coder': { provider: 'gemini', model: 'gemini-2.5-flash' },
        'deepseek-reasoner': { provider: 'gemini', model: 'gemini-2.5-flash' },
        'mixtral-8x7b-32768': { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        'llama-3.2-90b-vision-preview': { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        'gemini-2.5-flash': { provider: 'gemini', model: 'gemini-2.5-flash' },
      };
      
      if (oldModelMap[model]) {
        provider = oldModelMap[model].provider;
        model = oldModelMap[model].model;
      }
      else {
        if (provider === 'gemini' && !validGeminiModels.includes(model)) {
          model = 'gemini-2.5-flash';
        } else if (provider === 'grok' && !validGrokModels.includes(model)) {
          model = 'grok-4.1-fast';
        } else if (provider === 'groq' && !validGroqModels.includes(model)) {
          model = 'llama-3.3-70b-versatile';
        } else if (provider === 'moonshot' && !validMoonshotModels.includes(model)) {
          model = 'moonshot-v1-128k';
        }
      }
      
      useStore.setState({
        theme: parsed.theme === 'aether' ? 'alpha' : (parsed.theme || 'alpha'),
        customThemes: parsed.customThemes || [],
        activeCustomThemeId: parsed.activeCustomThemeId || null,
        activeStandardThemeId: parsed.activeStandardThemeId || null,
        aiProvider: provider as 'groq' | 'grok' | 'gemini' | 'moonshot' | 'ollama',
        ollamaModels: parsed.ollamaModels || [],
        geminiApiKey: parsed.geminiApiKey || '',
        deepseekApiKey: parsed.deepseekApiKey || '',
        groqApiKey: parsed.groqApiKey || '',
        grokApiKey: parsed.grokApiKey || '',
        moonshotApiKey: parsed.moonshotApiKey || '',
        aiBackendModel: model,
        terminalSettings: parsed.terminalSettings || {
          fontSize: 13,
          cursorStyle: 'block',
          cursorBlink: true,
          fontFamily: '"JetBrainsMono Nerd Font", "FiraCode Nerd Font", "MesloLGS NF", "Cascadia Code", Consolas, monospace',
          shell: ''
        },
        tasks: parsed.tasks || [],
        messages: parsed.messages || [],
        sidebarWidth: parsed.sidebarWidth || 256,
        chatWidth: parsed.chatWidth || 384,
        activeSettingsTab: parsed.activeSettingsTab || 'themes',
      });
    } catch (e) {
      console.error('Failed to parse stored state:', e);
    }
  }

  useStore.subscribe((state) => {
    try {
      const serializableState = {
        theme: state.theme,
        customThemes: state.customThemes,
        activeCustomThemeId: state.activeCustomThemeId,
        activeStandardThemeId: state.activeStandardThemeId,
        aiProvider: state.aiProvider,
        geminiApiKey: state.geminiApiKey,
        deepseekApiKey: state.deepseekApiKey,
        groqApiKey: state.groqApiKey,
        grokApiKey: state.grokApiKey,
        moonshotApiKey: state.moonshotApiKey,
        ollamaModels: state.ollamaModels,
        aiBackendModel: state.aiBackendModel,
        terminalSettings: state.terminalSettings,
        tasks: state.tasks,
        messages: state.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          context: msg.context ? {
            files: msg.context.files?.map(f => ({
              path: f.path,
              content: f.content,
              startLine: f.startLine,
              endLine: f.endLine,
              size: f.size,
            })),
            images: msg.context.images?.map(img => ({
              path: img.path,
              data: img.data,
            })),
          } : undefined,
        })),
        sidebarWidth: state.sidebarWidth,
        chatWidth: state.chatWidth,
        activeSettingsTab: state.activeSettingsTab,
      };
      localStorage.setItem('alphastudio-storage', JSON.stringify(serializableState));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  });
}
