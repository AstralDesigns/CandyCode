import { create } from 'zustand';
import { ChatMessage } from '../store';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatSessionStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentSession: ChatSession | null;
  
  createNewSession: (title?: string) => string;
  switchToSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  updateCurrentSessionMessages: (messages: ChatMessage[]) => void;
  updateCurrentSessionTitle: (title: string) => void;
  clearAllSessions: () => void;
  
  // Load from localStorage
  loadSessions: () => void;
  // Save to localStorage
  saveSessions: () => void;
}

const STORAGE_KEY = 'candycode-chat-sessions';
const CURRENT_SESSION_KEY = 'candycode-current-session-id';
const MAX_SESSIONS = 50;

export const useChatSessionService = create<ChatSessionStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  currentSession: null,
  
  createNewSession: (title = 'New Chat') => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    set((state) => {
      const newSessions = [newSession, ...state.sessions].slice(0, MAX_SESSIONS);
      return {
        sessions: newSessions,
        currentSessionId: newSession.id,
        currentSession: newSession,
      };
    });
    
    get().saveSessions();
    return newSession.id;
  },
  
  switchToSession: (sessionId: string) => {
    const session = get().sessions.find(s => s.id === sessionId);
    if (session) {
      set({
        currentSessionId: sessionId,
        currentSession: session,
      });
      localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
    }
  },
  
  deleteSession: (sessionId: string) => {
    set((state) => {
      const newSessions = state.sessions.filter(s => s.id !== sessionId);
      let newCurrentId = state.currentSessionId;
      let newCurrentSession = state.currentSession;
      
      // If deleting current session, switch to first available or create new
      if (sessionId === state.currentSessionId) {
        if (newSessions.length > 0) {
          newCurrentId = newSessions[0].id;
          newCurrentSession = newSessions[0];
        } else {
          const newSession = get().createNewSession();
          newCurrentId = newSession;
          newCurrentSession = get().sessions.find(s => s.id === newSession) || null;
        }
      }
      
      return {
        sessions: newSessions,
        currentSessionId: newCurrentId,
        currentSession: newCurrentSession,
      };
    });
    
    get().saveSessions();
  },
  
  updateCurrentSessionMessages: (messages: ChatMessage[]) => {
    const currentId = get().currentSessionId;
    if (!currentId) return;
    
    set((state) => {
      const updatedSessions = state.sessions.map(session => {
        if (session.id === currentId) {
          return {
            ...session,
            messages,
            updatedAt: Date.now(),
          };
        }
        return session;
      });
      
      const updatedSession = updatedSessions.find(s => s.id === currentId);
      
      return {
        sessions: updatedSessions,
        currentSession: updatedSession || state.currentSession,
      };
    });
    
    get().saveSessions();
  },
  
  updateCurrentSessionTitle: (title: string) => {
    const currentId = get().currentSessionId;
    if (!currentId) return;
    
    set((state) => {
      const updatedSessions = state.sessions.map(session => {
        if (session.id === currentId) {
          return {
            ...session,
            title,
            updatedAt: Date.now(),
          };
        }
        return session;
      });
      
      const updatedSession = updatedSessions.find(s => s.id === currentId);
      
      return {
        sessions: updatedSessions,
        currentSession: updatedSession || state.currentSession,
      };
    });
    
    get().saveSessions();
  },
  
  clearAllSessions: () => {
    const newSessionId = get().createNewSession();
    set({
      currentSessionId: newSessionId,
      currentSession: get().sessions.find(s => s.id === newSessionId) || null,
    });
  },
  
  loadSessions: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const sessions: ChatSession[] = JSON.parse(stored);
        const currentId = localStorage.getItem(CURRENT_SESSION_KEY);
        
        let currentSession: ChatSession | null = null;
        if (currentId) {
          currentSession = sessions.find(s => s.id === currentId) || null;
        }
        
        // If no current session, use most recent or create new
        if (!currentSession) {
          if (sessions.length > 0) {
            currentSession = sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          } else {
            const newId = get().createNewSession();
            currentSession = get().sessions.find(s => s.id === newId) || null;
          }
        }
        
        set({
          sessions,
          currentSessionId: currentSession?.id || null,
          currentSession,
        });
      } else {
        // No stored sessions, create default
        const newId = get().createNewSession();
        const newSession = get().sessions.find(s => s.id === newId);
        set({
          currentSessionId: newId,
          currentSession: newSession || null,
        });
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      // Create default session on error
      const newId = get().createNewSession();
      const newSession = get().sessions.find(s => s.id === newId);
      set({
        currentSessionId: newId,
        currentSession: newSession || null,
      });
    }
  },
  
  saveSessions: () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().sessions));
      if (get().currentSessionId) {
        localStorage.setItem(CURRENT_SESSION_KEY, get().currentSessionId || '');
      }
    } catch (error) {
      console.error('Failed to save chat sessions:', error);
    }
  },
}));

