import { useState } from 'react';
import ChatInterface from './ChatInterface';
import UserTerminal from './UserTerminal';
import { TerminalSquare, MessageSquare } from 'lucide-react';

export default function ChatPanel() {
  const [activeTab, setActiveTab] = useState<'candy' | 'terminal'>('candy');

  return (
    <div className="flex flex-col w-full h-full bg-transparent overflow-hidden relative shadow-2xl">
      {/* Panel Header with Tabs */}
      <div className="p-2 border-b border-white/5 flex-shrink-0 bg-background/50 backdrop-blur-md z-30">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('candy')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'candy'
                ? 'text-white shadow-lg'
                : 'bg-white/5 text-muted hover:bg-white/10'
            }`}
            style={activeTab === 'candy' ? {
              background: 'var(--accent-gradient)'
            } : {}}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Candy
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'terminal'
                ? 'text-white shadow-lg'
                : 'bg-white/5 text-muted hover:bg-white/10'
            }`}
            style={activeTab === 'terminal' ? {
              background: 'var(--accent-gradient)'
            } : {}}
          >
            <TerminalSquare className="w-3.5 h-3.5" />
            Terminal
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: activeTab === 'candy' ? 1 : 0,
            pointerEvents: activeTab === 'candy' ? 'auto' : 'none',
            zIndex: activeTab === 'candy' ? 10 : 0
          }}
        >
          <ChatInterface />
        </div>
        
        <div 
          className="absolute inset-0 transition-opacity duration-200"
          style={{ 
            opacity: activeTab === 'terminal' ? 1 : 0, 
            pointerEvents: activeTab === 'terminal' ? 'auto' : 'none',
            zIndex: activeTab === 'terminal' ? 10 : 0
          }}
        >
          <UserTerminal />
        </div>
      </div>
    </div>
  );
}
