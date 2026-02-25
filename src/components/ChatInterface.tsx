import { useState, useRef, useEffect, useCallback } from 'react';
import { Image as ImageIcon, FileText, X, ChevronDown, Trash2, Plus, Undo, Redo, Scissors, Copy, ClipboardPaste, Type, Smile, Trash, CheckCircle2, ClipboardList } from 'lucide-react';
import { useStore } from '../store';
import ReactMarkdown from 'react-markdown';
import TaskList from './TaskList';
import TodoWidget from './TodoWidget';
import BatchApprovalWidget from './BatchApprovalWidget';
import DiffWidget from './DiffWidget';
import CommandWidget from './CommandWidget';
import StatusMessage from './StatusMessage';
import ContextMenu from './ContextMenu';
import EmojiPicker from './EmojiPicker';
import { useChatSessionService } from '../services/chat-session.service';
import { aiBackendApiService, AIBackendChunk } from '../services/ai-backend-api.service';
import { ProjectPlan } from '../models/plan.model';

// Helper function to map tool names to friendly status messages
function getStatusMessage(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case 'read_file':
      return `Reading ${args.path || args.file_path || 'file'}...`;
    case 'peek_file':
      return `Peeking at ${args.path || args.file_path || 'file'}...`;
    case 'write_file':
      return `Creating file: ${args.path || args.file_path || 'file'}`;
    case 'list_files':
      return `Listing files in ${args.directory_path || '.'}...`;
    case 'search_code':
      return `Searching codebase for "${args.pattern || args.search_term || 'pattern'}"...`;
    case 'create_plan':
      return `Creating plan: ${args.title || 'task'}`;
    case 'execute_command':
      const cmd = args.command || '';
      const shortCmd = cmd.length > 40 ? cmd.substring(0, 37) + '...' : cmd;
      return `Running ${shortCmd}...`;
    case 'run_tests':
      return `Running tests${args.framework ? ` (${args.framework})` : ''}...`;
    case 'web_search':
      return `Searching web for "${args.query || args.search_term || 'query'}"...`;
    case 'task_complete':
      return 'Task Complete';
    default:
      return `${toolName}...`;
  }
}

const MOCK_ERRORS: Record<string, string[]> = {
  'teh': ['the', 'ten', 'tea'],
  'recieve': ['receive'],
  'adress': ['address'],
  'seperate': ['separate'],
  'occured': ['occurred'],
  'definately': ['definitely'],
  'goverment': ['government'],
  'beleive': ['believe'],
};

// Chronological event tracking for conversational flow
type ChatEvent = 
  | { type: 'text'; content: string; id: string }
  | { type: 'status'; message: string; id: string; isActive: boolean; isComplete: boolean; callId?: string }
  | { type: 'plan'; plan: ProjectPlan; id: string; callId?: string }
  | { type: 'diff'; filePath: string; id: string; callId?: string }
  | { type: 'command'; command: string; callId: string; id: string; needsPassword: boolean; output?: Array<{ command?: string; output: string; type: 'command' | 'stdout' | 'stderr' | 'error' }> }
  | { type: 'summary'; content: string; id: string };

export default function ChatInterface() {
  const { messages, addMessage, contextFiles, contextImages, clearMessages, setMessages, removeContextFile, removeContextImage, setActivePlan, pendingDiffs, diffHistory, acceptedDiffs, rejectedDiffs, acceptDiff, rejectDiff, openFileByPath, artifacts, addArtifact, clearArtifacts, geminiApiKey, deepseekApiKey, groqApiKey, grokApiKey, moonshotApiKey, aiProvider, aiBackendModel, projectContext, contextMode, licenseTier, windsurfApiKey, windsurfServiceKey, windsurfBYOKProvider, windsurfBYOKApiKey, windsurfUseBYOK } = useStore();
  const sessionService = useChatSessionService();
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const streamingRef = useRef(false);
  const processedContentRef = useRef<string>('');

  const [showTasks, setShowTasks] = useState(false);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [activeFunctionCalls, setActiveFunctionCalls] = useState<Map<string, { name: string; args: Record<string, any>; startTime: number; statusId?: string }>>(new Map());
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [pendingCommands, setPendingCommands] = useState<Map<string, { command: string; needsPassword: boolean }>>(new Map());
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const currentStreamingMessageIdRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const currentTextSegmentRef = useRef<string>(''); 
  
  const [streamingEvents, setStreamingEvents] = useState<ChatEvent[]>([]);
  const [eventsByMessageId, setEventsByMessageId] = useState<Map<string, ChatEvent[]>>(new Map()); 
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  // Use a ref to store events while streaming to ensure they're available for migration
  const streamingEventsRef = useRef<ChatEvent[]>([]);

  // Migrate events when a new assistant message is added
  useEffect(() => {
    const currentMessageCount = messages.length;
    const lastCount = lastMessageCountRef.current;
    
    if (currentMessageCount > lastCount) {
      const newMessage = messages[currentMessageCount - 1];
      if (newMessage.role === 'assistant' && currentStreamingMessageIdRef.current) {
        const tempId = currentStreamingMessageIdRef.current;
        setEventsByMessageId(prev => {
          const next = new Map(prev);
          // Use the ref if state hasn't updated yet
          const tempEvents = next.get(tempId) || streamingEventsRef.current;
          if (tempEvents && tempEvents.length > 0) {
            next.set(newMessage.id, tempEvents);
            next.delete(tempId);
          }
          return next;
        });
        currentStreamingMessageIdRef.current = null;
        // Reset the ref after migration
        streamingEventsRef.current = [];
      }
    }
    lastMessageCountRef.current = currentMessageCount;
  }, [messages]);

  // Update the ref whenever streamingEvents changes
  useEffect(() => {
    if (streaming) {
      streamingEventsRef.current = streamingEvents;
    }
  }, [streamingEvents, streaming]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ x: number; y: number } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    sessionService.loadSessions();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(event.target as Node)) {
        setShowSessionDropdown(false);
      }
    };
    if (showSessionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSessionDropdown]);

  useEffect(() => {
    if (sessionService.currentSession) {
      setMessages(sessionService.currentSession.messages);
    }
  }, [sessionService.currentSession?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      sessionService.updateCurrentSessionMessages(messages);
    }
  }, [messages]);

  // Improved Autoscroll Logic
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    if (scrollTop < lastScrollTopRef.current && !isAtBottom) {
      isAutoScrollingRef.current = false;
    } else if (isAtBottom) {
      isAutoScrollingRef.current = true;
    }
    
    lastScrollTopRef.current = scrollTop;
  }, []);

  useEffect(() => {
    if (isAutoScrollingRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, streamingEvents, activeFunctionCalls.size, pendingCommands.size, pendingDiffs.size]);

  // Artifact extraction
  useEffect(() => {
    if (!streamingContent || streamingContent === processedContentRef.current) return;
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    const seenBlocks = new Set<string>();
    Array.from(artifacts.values()).forEach(artifact => seenBlocks.add(artifact.content.trim()));
    
    codeBlockRegex.lastIndex = 0;
    while ((match = codeBlockRegex.exec(streamingContent)) !== null) {
      const language = match[1] || undefined;
      const codeContent = match[2] || '';
      if (codeContent.trim() && !seenBlocks.has(codeContent.trim())) {
        addArtifact(codeContent, language);
      }
    }
    processedContentRef.current = streamingContent;
  }, [streamingContent, artifacts, addArtifact]);

  const handleSend = async (messageOverride?: string) => {
    const messageToSend = messageOverride || input.trim();
    if (!messageToSend || streaming) return;

    const effectiveProvider = aiProvider;
    let selectedApiKey: string | undefined;
    
    // Handle API key selection based on provider
    if (effectiveProvider === 'windsurf') {
      if (windsurfUseBYOK) {
        selectedApiKey = windsurfBYOKApiKey;
      } else {
        selectedApiKey = windsurfApiKey;
      }
    } else if (effectiveProvider === 'grok') {
      selectedApiKey = grokApiKey;
    } else if (effectiveProvider === 'groq') {
      selectedApiKey = groqApiKey;
    } else if (effectiveProvider === 'moonshot') {
      selectedApiKey = moonshotApiKey;
    } else if (effectiveProvider === 'ollama') {
      selectedApiKey = undefined;
    } else {
      selectedApiKey = geminiApiKey;
    }
    
    if (!selectedApiKey && effectiveProvider !== 'ollama' && !(effectiveProvider === 'windsurf')) {
      addMessage({ role: 'assistant', content: `Please set your ${effectiveProvider.charAt(0).toUpperCase() + effectiveProvider.slice(1)} API key in Settings to start chatting.` });
      return;
    }

    const userMessage = messageToSend;
    if (!messageOverride) setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    if (messages.length === 0 && sessionService.currentSession?.title === 'New Chat') {
      const title = userMessage.slice(0, 40).replace(/\n/g, ' ').trim() || 'New Chat';
      sessionService.updateCurrentSessionTitle(title + (userMessage.length > 40 ? '...' : ''));
    }

    setTaskCompleted(false);
    setActiveFunctionCalls(new Map());
    setStreamingEvents([]); 
    streamingEventsRef.current = [];
    isAutoScrollingRef.current = true; 
    
    const expectedAssistantMessageIndex = messages.length + 1;
    
    addMessage({ 
      role: 'user', 
      content: userMessage,
      context: {
        files: contextFiles.map(f => ({ path: f.path, startLine: f.startLine, endLine: f.endLine, size: f.size })),
        images: contextImages,
      }
    });
    
    setStreaming(true);
    streamingRef.current = true;
    setStreamingContent('');
    currentStreamingMessageIdRef.current = `streaming_${expectedAssistantMessageIndex}`;
    currentTextSegmentRef.current = ''; 

    try {
      const handleChunk = (chunk: AIBackendChunk) => {
        if (!streamingRef.current) return;

        switch (chunk.type) {
          case 'text':
            const textData = chunk.data || '';
            currentTextSegmentRef.current += textData;
            setStreamingContent((prev) => prev + textData);
            break;

          case 'function_call': {
            const { name, data: args, callId } = chunk;
            const callIdKey = callId || `${name || 'unknown'}_${Date.now()}`;
            const statusMsg = getStatusMessage(name || '', args || {});
            const statusId = `status_${callIdKey}`;
            
            if (currentTextSegmentRef.current.trim()) {
              setStreamingEvents(prev => [...prev, {
                type: 'text',
                content: currentTextSegmentRef.current.trim(),
                id: `text_${Date.now()}_${Math.random()}`
              }]);
              currentTextSegmentRef.current = '';
              setStreamingContent(''); 
            }
            
            if (statusMsg) {
              setStreamingEvents(prev => [...prev, {
                type: 'status',
                message: statusMsg,
                id: statusId,
                isActive: true,
                isComplete: false,
                callId: callIdKey
              }]);
            }
            
            setActiveFunctionCalls(prev => {
              const next = new Map(prev);
              next.set(callIdKey, { name: name || '', args: args || {}, startTime: Date.now(), statusId });
              return next;
            });
            break;
          }

          case 'function_result': {
            const { name: funcName, data: result, callId: resultCallId } = chunk;
            const callIdKey = resultCallId || '';
            
            setActiveFunctionCalls(prev => {
              const next = new Map(prev);
              const call = next.get(callIdKey);
              if (call?.statusId) {
                setStreamingEvents(prevEvents => prevEvents.map(e => 
                  e.type === 'status' && e.callId === callIdKey
                    ? { ...e, isActive: false, isComplete: true }
                    : e
                ));
              }
              next.delete(callIdKey);
              return next;
            });

            if (funcName === 'create_plan' && result && !result.error) {
              const plan: ProjectPlan = {
                id: `plan_${Date.now()}`,
                title: result.title,
                steps: result.steps.map((s: any, i: number) => ({
                  id: s.id || `step_${i+1}`,
                  description: s.description || '',
                  status: s.status || 'pending',
                  order: s.order ?? i + 1,
                })),
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              setActivePlan(plan);
              setStreamingEvents(prev => [...prev, {
                type: 'plan',
                plan,
                id: `plan_${Date.now()}`,
                callId: callIdKey
              }]);
            }

            if (funcName === 'write_file' && result && !result.error) {
              const filePath: string = result.file_path || result.path || '';
              if (filePath && currentStreamingMessageIdRef.current) {
                const { pendingDiffs, diffHistory, acceptedDiffs, rejectedDiffs } = useStore.getState();
                const newDiffs = new Map(pendingDiffs);
                const newHistory = new Map(diffHistory);
                const newAccepted = new Set(acceptedDiffs);
                const newRejected = new Set(rejectedDiffs);
                const content = result.content || result.modified || '';
                
                newAccepted.delete(filePath);
                newRejected.delete(filePath);
                
                const diff = {
                  filePath,
                  original: result.originalContent || ((newDiffs.get(filePath) as any)?.original) || '',
                  modified: content
                };
                
                newDiffs.set(filePath, diff);
                newHistory.set(filePath, diff);
                
                useStore.setState({ 
                  pendingDiffs: newDiffs, 
                  diffHistory: newHistory,
                  acceptedDiffs: newAccepted,
                  rejectedDiffs: newRejected
                });
                
                setStreamingEvents(prev => [...prev, {
                  type: 'diff',
                  filePath,
                  id: `diff_${filePath}_${Date.now()}`,
                  callId: callIdKey
                }]);
              }
            }

            if (funcName === 'execute_command' && result) {
              if (result.status === 'pending') {
                setPendingCommands(prev => new Map(prev).set(callIdKey || 'cmd', { command: result.command, needsPassword: result.needsPassword }));
                setStreamingEvents(prev => [...prev, {
                  type: 'command',
                  command: result.command || '',
                  callId: callIdKey || 'cmd',
                  id: `command_${callIdKey || 'cmd'}_${Date.now()}`,
                  needsPassword: result.needsPassword || false
                }]);
              } else {
                const output = [
                  { command: result.command, output: result.command, type: 'command' as const },
                  { output: result.stdout, type: 'stdout' as const },
                  { output: result.stderr, type: 'stderr' as const },
                ];
                setStreamingEvents(prev => prev.map(e => 
                  e.type === 'command' && e.callId === (callIdKey || 'cmd')
                    ? { ...e, output }
                    : e
                ));
              }
            }

            if (funcName === 'task_complete') {
              setTaskCompleted(true);
              const summary = result.summary || 'Task completed';
              
              if (currentTextSegmentRef.current.trim()) {
                setStreamingEvents(prev => [...prev, {
                  type: 'text',
                  content: currentTextSegmentRef.current.trim(),
                  id: `text_${Date.now()}_${Math.random()}`
                }]);
                currentTextSegmentRef.current = '';
                setStreamingContent('');
              }
              
              setStreamingEvents(prev => [...prev, {
                type: 'summary',
                content: summary,
                id: `summary_${Date.now()}`
              }]);
              
              // We don't clear streaming content yet, let 'done' handle it
            }
            break;
          }

          case 'error':
            setStreamingContent(prev => prev + `\n\n[Error: ${chunk.data}]\n\n`);
            break;

          case 'done':
            streamingRef.current = false;
            setStreaming(false);
            
            if (currentTextSegmentRef.current.trim()) {
              setStreamingEvents(prev => {
                const updated = [...prev, {
                  type: 'text',
                  content: currentTextSegmentRef.current.trim(),
                  id: `text_${Date.now()}_${Math.random()}`
                } as ChatEvent];
                // Update ref immediately for migration
                streamingEventsRef.current = updated;
                return updated;
              });
            } else {
              // Ensure ref is up to date for migration
              streamingEventsRef.current = streamingEvents;
            }
            
            if (currentStreamingMessageIdRef.current) {
              const tempId = currentStreamingMessageIdRef.current;
              setEventsByMessageId(prev => {
                const next = new Map(prev);
                next.set(tempId, streamingEventsRef.current);
                return next;
              });
            }
            
            setStreamingContent(prev => {
              let finalContent = prev.trim();
              if (finalContent.includes('---START_SUMMARY---')) {
                finalContent = finalContent.replace('---START_SUMMARY---', '## Summary');
              }

              setTimeout(() => {
                const currentMessages = useStore.getState().messages;
                const last = currentMessages[currentMessages.length - 1];
                
                // Add message if it doesn't exist or content is different
                if (!last || last.role !== 'assistant' || last.content !== finalContent) {
                  addMessage({ role: 'assistant', content: finalContent });
                }
              }, 0);
              return '';
            });
            aiBackendApiService.removeListener(handleChunk);
            break;
        }
      };

      await aiBackendApiService.chatStream(
        userMessage,
        {
          provider: effectiveProvider,
          model: aiBackendModel,
          apiKey: selectedApiKey,
          context: {
            files: contextFiles.map(f => ({ path: f.path, content: f.content, startLine: f.startLine, endLine: f.endLine })),
            images: contextImages,
            project: projectContext || undefined,
            contextMode: contextMode,
          },
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
          licenseTier: licenseTier, // Pass license tier
          // Windsurf-specific options
          windsurfUseBYOK: effectiveProvider === 'windsurf' ? windsurfUseBYOK : undefined,
          windsurfBYOKProvider: effectiveProvider === 'windsurf' && windsurfBYOKProvider ? windsurfBYOKProvider : undefined,
          windsurfBYOKApiKey: effectiveProvider === 'windsurf' ? windsurfBYOKApiKey : undefined
        },
        handleChunk
      );
    } catch (error: any) {
      setStreaming(false);
      addMessage({ role: 'assistant', content: `Error: ${error.message || 'Failed to start chat'}` });
    }
  };

  const handleCommandApproval = async (callId: string, approved: boolean) => {
    const cmdData = pendingCommands.get(callId);
    if (!cmdData) return;
    setPendingCommands(prev => { const n = new Map(prev); n.delete(callId); return n; });
    
    if (approved) {
      try {
        const res = await window.electronAPI.executeCommand(cmdData.command, { timeout: 60000 });
        const output = [
          { command: cmdData.command, output: cmdData.command, type: 'command' as const },
          { output: res.stdout, type: 'stdout' as const },
          { output: res.stderr, type: 'stderr' as const },
        ];
        
        setStreamingEvents(prev => prev.map(e => 
          e.type === 'command' && e.callId === callId
            ? { ...e, output }
            : e
        ));

        setEventsByMessageId(prev => {
          const next = new Map(prev);
          for (const [msgId, events] of next.entries()) {
            const updatedEvents = events.map(e => 
              e.type === 'command' && e.callId === callId ? { ...e, output } : e
            );
            next.set(msgId, updatedEvents);
          }
          return next;
        });

      } catch (e: any) {
        addMessage({ role: 'assistant', content: `Error: ${e.message}` });
      }
    }
  };

  const handleAddFile = async () => {
    if (!window.electronAPI?.showOpenDialog) return;
    
    const result = await window.electronAPI.showOpenDialog({ properties: ['openFile'] });
    if (result.canceled || !result.filePaths?.length) return;
    
    const filePath = result.filePaths[0];
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    
    if (imageExtensions.includes(ext)) {
      // Use file:// URL for images
      useStore.getState().addContextImage({ path: filePath, data: `file://${filePath}` });
    } else {
      // Read content for text files
      const fileResult = await window.electronAPI.readFile(filePath);
      if (fileResult.content && !fileResult.error) {
        useStore.getState().addContextFile({ path: filePath, content: fileResult.content });
      }
    }
  };

  const handleInputContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmd = isMac ? '⌘' : 'Ctrl+';
    
    // Check for word under cursor for spellcheck/correction
    let suggestions: any[] = [];
    if (textareaRef.current) {
       const text = input;
       // Get cursor position from the selectionStart property
       const cursor = textareaRef.current.selectionStart || 0;
       
       // Find word boundaries around cursor
       let start = cursor;
       while (start > 0 && /[a-zA-Z0-9']/.test(text[start - 1])) {
         start--;
       }
       let end = cursor;
       while (end < text.length && /[a-zA-Z0-9']/.test(text[end])) {
         end++;
       }
       
       const word = text.slice(start, end);
       const cleanWord = word.replace(/[.,!?;:]/g, '').toLowerCase();
       
       if (word && MOCK_ERRORS[cleanWord]) {
         suggestions = MOCK_ERRORS[cleanWord].map(s => ({
           label: s,
           onClick: () => {
             const newValue = text.slice(0, start) + s + text.slice(end);
             setInput(newValue);
             setContextMenu(null);
           }
         }));
       }
    }

    const items = [
      ...(suggestions.length > 0 ? [
        { label: 'Corrections', disabled: true },
        ...suggestions,
        { divider: true }
      ] : []),
      { label: 'Undo', icon: <Undo size={14} />, shortcut: `${cmd}Z`, onClick: () => {
        textareaRef.current?.focus();
        document.execCommand('undo');
      }},
      { label: 'Redo', icon: <Redo size={14} />, shortcut: `${cmd}Y`, onClick: () => {
        textareaRef.current?.focus();
        document.execCommand('redo');
      }},
      { divider: true },
      { label: 'Cut', icon: <Scissors size={14} />, shortcut: `${cmd}X`, onClick: () => {
        const start = textareaRef.current?.selectionStart || 0;
        const end = textareaRef.current?.selectionEnd || 0;
        const selectedText = input.slice(start, end);
        if (selectedText) {
          navigator.clipboard.writeText(selectedText);
          const newValue = input.slice(0, start) + input.slice(end);
          setInput(newValue);
        }
      }},
      { label: 'Copy', icon: <Copy size={14} />, shortcut: `${cmd}C`, onClick: () => {
        const start = textareaRef.current?.selectionStart || 0;
        const end = textareaRef.current?.selectionEnd || 0;
        const selectedText = input.slice(start, end);
        if (selectedText) navigator.clipboard.writeText(selectedText);
      }},
      { label: 'Paste', icon: <ClipboardPaste size={14} />, shortcut: `${cmd}V`, onClick: async () => {
        const text = await navigator.clipboard.readText();
        const start = textareaRef.current?.selectionStart || 0;
        const end = textareaRef.current?.selectionEnd || 0;
        const newValue = input.slice(0, start) + text + input.slice(end);
        setInput(newValue);
      }},
      { label: 'Delete', icon: <Trash size={14} />, shortcut: 'Del', onClick: () => {
        const start = textareaRef.current?.selectionStart || 0;
        const end = textareaRef.current?.selectionEnd || 0;
        const newValue = input.slice(0, start) + input.slice(end);
        setInput(newValue);
      }},
      { divider: true },
      { label: 'Insert Emoji', icon: <Smile size={14} />, onClick: () => setShowEmojiPicker({ x: e.clientX, y: e.clientY }) },
      { label: 'Change Case', icon: <Type size={14} />, onClick: () => {
        const start = textareaRef.current?.selectionStart || 0;
        const end = textareaRef.current?.selectionEnd || 0;
        const selectedText = input.slice(start, end);
        if (selectedText) {
          const isUpper = selectedText === selectedText.toUpperCase();
          const newValue = input.slice(0, start) + (isUpper ? selectedText.toLowerCase() : selectedText.toUpperCase()) + input.slice(end);
          setInput(newValue);
        }
      }},
    ];
    setContextMenu({ x: e.clientX, y: e.clientY - 120, items });
  };

  const handleMessageContextMenu = (e: React.MouseEvent) => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      e.preventDefault();
      e.stopPropagation();
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmd = isMac ? '⌘' : 'Ctrl+';
      
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: 'Copy', icon: <Copy size={14} />, shortcut: `${cmd}C`, onClick: () => navigator.clipboard.writeText(selection) }
        ]
      });
    }
  };

  const renderEvent = (event: ChatEvent) => {
    switch (event.type) {
      case 'text':
        return (
          <div key={event.id} className="prose prose-invert prose-slate max-w-full text-foreground text-sm leading-relaxed overflow-hidden">
            <ReactMarkdown>{event.content}</ReactMarkdown>
          </div>
        );
      case 'status':
        return (
          <div key={event.id} className="py-0.5">
            <StatusMessage 
              message={event.message} 
              isActive={event.isActive} 
              isComplete={event.isComplete} 
            />
          </div>
        );
      case 'plan':
        return (
          <div key={event.id} className="w-full py-1">
            <TodoWidget plan={event.plan} />
          </div>
        );
      case 'diff':
        const diff = diffHistory.get(event.filePath);
        if (!diff) return null;
        const isAccepted = acceptedDiffs.has(event.filePath);
        const isRejected = rejectedDiffs.has(event.filePath);
        const diffStatus = isAccepted ? 'accepted' : isRejected ? 'rejected' : 'pending';
        return (
          <div key={event.id} className="w-full py-1">
            <DiffWidget 
              filePath={diff.filePath} 
              original={diff.original} 
              modified={diff.modified} 
              status={diffStatus}
              onAccept={() => acceptDiff(event.filePath)}
              onReject={() => rejectDiff(event.filePath)}
              onOpenFile={() => openFileByPath(event.filePath)} 
            />
          </div>
        );
      case 'command':
        return (
          <div key={event.id} className="w-full py-1">
            <CommandWidget 
              command={event.command} 
              needsPassword={event.needsPassword} 
              callId={event.callId} 
              terminalOutput={event.output || []} 
              onApprove={handleCommandApproval} 
            />
          </div>
        );
      case 'summary':
        return (
          <div key={event.id} className="prose prose-invert prose-slate max-w-full text-foreground text-sm leading-relaxed overflow-hidden pt-2 border-t mt-4" style={{ borderColor: 'var(--border-color)' }}>
            <ReactMarkdown>{`## Summary\n\n${event.content}`}</ReactMarkdown>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-transparent overflow-hidden relative">
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--indicator-color)' }} />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Candy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative" ref={sessionDropdownRef}>
            <button
              onClick={() => setShowSessionDropdown(!showSessionDropdown)}
              className="p-1.5 rounded-md hover:bg-white/10 text-muted transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {showSessionDropdown && (
              <div 
                className="absolute top-full right-0 mt-1 w-64 border rounded-xl shadow-2xl z-50 overflow-hidden"
                style={{ backgroundColor: 'var(--settings-bg)', borderColor: 'var(--border-color)' }}
              >
                <button
                  onClick={() => { 
                    sessionService.createNewSession(); 
                    clearMessages(); 
                    clearArtifacts(); 
                    setTaskCompleted(false); 
                    setStreamingEvents([]);
                    setEventsByMessageId(new Map());
                    setShowSessionDropdown(false); 
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-white/5 transition-colors flex items-center gap-2 border-b"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <Plus className="h-4 w-4 text-accent" />
                  <span>New Chat</span>
                </button>
                <div className="max-h-64 overflow-y-auto">
                  {sessionService.sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { sessionService.switchToSession(s.id); setShowSessionDropdown(false); }}
                      className={`w-full px-4 py-2.5 text-left text-sm text-muted hover:bg-white/5 transition-colors flex items-center justify-between group ${sessionService.currentSessionId === s.id ? 'bg-accent/10 text-accent' : ''}`}
                    >
                      <span className="truncate flex-1">{s.title}</span>
                      <X onClick={(e) => { e.stopPropagation(); sessionService.deleteSession(s.id); }} className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => { 
              clearMessages(); 
              clearArtifacts(); 
              setTaskCompleted(false); 
              setStreamingEvents([]);
              setEventsByMessageId(new Map());
            }}
            className="p-1.5 rounded-md hover:bg-white/10 text-muted hover:text-rose-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide bg-transparent" 
        onContextMenu={handleMessageContextMenu}
      >
        {messages.map((msg) => {
          const messageEvents = eventsByMessageId.get(msg.id) || [];
          const hasEvents = messageEvents.length > 0;
          
          return (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}>
              {msg.role === 'user' ? (
                <div 
                  className="max-w-[85%] border px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm"
                  style={{ backgroundColor: 'var(--user-msg-bg)', borderColor: 'var(--user-msg-border)', color: 'var(--text-primary)' }}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                </div>
              ) : (
                <div className="w-full space-y-1 overflow-hidden">
                  {hasEvents ? (
                    messageEvents.map(renderEvent)
                  ) : (
                    <div className="prose prose-invert prose-slate max-w-full text-foreground text-sm leading-relaxed overflow-hidden">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {streaming && (
          <div className="w-full space-y-1 overflow-hidden">
            {streamingEvents.map(renderEvent)}
            {streamingContent && (
              <div className="prose prose-invert prose-slate max-w-full text-foreground text-sm leading-relaxed opacity-80 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {taskCompleted && Array.from(pendingDiffs.entries()).filter(([p]) => !acceptedDiffs.has(p) && !rejectedDiffs.has(p)).length > 0 && (
          <div className="w-full border-t pt-4 mt-4" style={{ borderColor: 'var(--border-color)' }}>
            <BatchApprovalWidget />
          </div>
        )}

        {taskCompleted && !streaming && Array.from(pendingDiffs.entries()).filter(([p]) => !acceptedDiffs.has(p) && !rejectedDiffs.has(p)).length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 w-fit animate-in zoom-in-95 duration-500">
            <CheckCircle2 size={16} />
            <span className="text-xs font-semibold">Task Completed Successfully</span>
          </div>
        )}
        
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="p-4 bg-white/5 backdrop-blur-xl shrink-0">
        {(contextFiles.length > 0 || contextImages.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {contextFiles.map((f, i) => (
              <div 
                key={`file-${i}`} 
                className="flex items-center gap-1.5 px-2 py-1 bg-white/10 border border-border rounded-md text-[10px] text-muted cursor-pointer hover:bg-white/20 transition-colors"
                onClick={() => openFileByPath(f.path)}
              >
                <FileText size={12} className="text-accent" />
                <span className="truncate max-w-[120px]">{f.path.split('/').pop()}</span>
                <X size={12} className="ml-1 cursor-pointer hover:text-rose-400" onClick={(e) => { e.stopPropagation(); removeContextFile(i); }} />
              </div>
            ))}
            {contextImages.map((img, i) => (
              <div 
                key={`img-${i}`} 
                className="relative group cursor-pointer"
                onClick={() => setLightboxImage(img.data)}
              >
                <img 
                  src={img.data} 
                  alt="Context" 
                  className="w-8 h-8 object-cover rounded border border-border hover:border-accent transition-colors" 
                />
                <div 
                  className="absolute -top-1.5 -right-1.5 bg-background rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all border border-border"
                  onClick={(e) => { e.stopPropagation(); removeContextImage(i); }}
                >
                  <X size={10} />
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="relative flex flex-col gap-2">
          
          <textarea
            ref={textareaRef}
            value={input}
            spellCheck="true"
            onContextMenu={handleInputContextMenu}
            onChange={e => { 
              const val = e.target.value;
              setInput(val); 
              e.target.style.height = 'auto'; 
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask Candy to build something..."
            disabled={streaming}
            className="w-full border rounded-2xl px-4 py-3 pr-4 resize-none focus:outline-none focus:ring-1 focus:ring-accent text-sm text-foreground placeholder:text-muted transition-all chat-textarea-scrollbar-hide"
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--input-border)' }}
            rows={1}
          />
          
          <div className="flex items-center justify-between mt-1 px-1">
            <div className="flex items-center gap-3">
              <button onClick={handleAddFile} className="flex items-center gap-1.5 text-[10px] text-muted hover:text-foreground transition-colors">
                <FileText size={12} /> Add File
              </button>
              <button onClick={() => setShowTasks(!showTasks)} className={`flex items-center gap-1.5 text-[10px] transition-colors ${showTasks ? 'text-accent' : 'text-muted hover:text-foreground'}`}>
                <ClipboardList size={12} /> Tasks
              </button>
            </div>

            {!streaming ? (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-50"
                style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => { streamingRef.current = false; setStreaming(false); aiBackendApiService.cancel(); }}
                className="w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all shadow-lg"
                style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
              >
                <div className="w-2 h-2 bg-current rounded-sm" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showTasks && (
        <div 
          className="absolute bottom-28 left-4 right-4 border rounded-2xl shadow-2xl p-4 z-30 animate-in slide-in-from-bottom-4 duration-300 backdrop-blur-xl"
          style={{ backgroundColor: 'var(--settings-bg)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
            <span className="text-xs font-bold text-muted uppercase tracking-widest">Task Planner</span>
            <X size={14} className="cursor-pointer text-muted hover:text-foreground" onClick={() => setShowTasks(false)} />
          </div>
          <TaskList onSendTasks={(f) => { setShowTasks(false); handleSend(f); }} />
        </div>
      )}

      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-8 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={lightboxImage} 
              alt="Lightbox" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
            />
            <button 
              className="absolute -top-4 -right-4 bg-white text-slate-900 rounded-full p-1.5 shadow-xl hover:bg-slate-200 transition-colors"
              onClick={() => setLightboxImage(null)}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showEmojiPicker && (
        <EmojiPicker 
          x={showEmojiPicker.x}
          y={showEmojiPicker.y}
          onSelect={(emoji) => {
            const start = textareaRef.current?.selectionStart || 0;
            const end = textareaRef.current?.selectionEnd || 0;
            const newValue = input.slice(0, start) + emoji + input.slice(end);
            setInput(newValue);
            setShowEmojiPicker(null);
            setContextMenu(null);
          }}
          onClose={() => setShowEmojiPicker(null)}
        />
      )}
    </div>
  );
}