import { useRef, useEffect } from 'react';
import { useStore } from '../store';

export default function Terminal() {
  const { terminalOutput } = useStore();
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalOutput]);

  // Terminal is display-only - agent executes commands via backend
  // Commands are displayed here automatically when backend streams command_result events
  // Command approval is handled by CommandWidget, not Terminal

  return (
    <div className="flex flex-col h-full">
      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs text-foreground scrollbar-hide bg-black/20 rounded border border-border">
        {terminalOutput.length === 0 ? (
          <div className="text-muted opacity-50 text-center py-4 text-xs">
            Agent terminal ready. Commands will appear here.
          </div>
        ) : (
          <div className="space-y-1">
            {terminalOutput.map((item, idx) => (
              <div 
                key={idx} 
                className={`whitespace-pre-wrap break-words ${
                  item.type === 'command' ? 'text-accent' :
                  item.type === 'stdout' ? 'text-foreground' :
                  item.type === 'stderr' ? 'text-yellow-400' :
                  'text-rose-400'
                }`}
              >
                {item.type === 'command' ? `$ ${item.output}` : item.output}
              </div>
            ))}
            <div ref={outputEndRef} />
          </div>
        )}
      </div>

    </div>
  );
}
