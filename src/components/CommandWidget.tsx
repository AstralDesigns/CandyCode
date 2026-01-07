import { useState, useRef, useEffect } from 'react';
import { Check, X, Lock } from 'lucide-react';

interface TerminalOutput {
  command?: string;
  output: string;
  type: 'command' | 'stdout' | 'stderr' | 'error';
}

interface CommandWidgetProps {
  command: string;
  needsPassword: boolean;
  callId: string;
  terminalOutput?: TerminalOutput[];
  onApprove: (callId: string, approved: boolean, password?: string) => void;
}

export default function CommandWidget({
  command,
  needsPassword,
  callId,
  terminalOutput = [],
  onApprove,
}: CommandWidgetProps) {
  const [password, setPassword] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalOutput]);

  const handleApprove = async () => {
    setIsApproving(true);
    await onApprove(callId, true, needsPassword ? password : undefined);
    setIsApproving(false);
  };

  const handleReject = async () => {
    setIsApproving(true);
    await onApprove(callId, false);
    setIsApproving(false);
  };

  const isExecuted = terminalOutput.length > 0;

  return (
    <div className="rounded-lg overflow-hidden bg-white/5 border border-border backdrop-blur-sm shadow-lg my-2">
      {/* Command Header with Approval Controls */}
      {!isExecuted && (
        <div className="px-3 py-2.5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-xs font-mono text-foreground truncate" title={command}>
              $ {command}
            </span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {needsPassword ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Lock className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sudo password..."
                    className="pl-7 pr-2 py-1 bg-black/20 border border-border rounded text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent w-32"
                  />
                </div>
                <button
                  onClick={handleApprove}
                  disabled={isApproving || !password}
                  className="px-3 py-1 bg-accent hover:brightness-110 text-white text-[10px] font-bold rounded transition-all disabled:opacity-50"
                >
                  Run Sudo
                </button>
                <button
                  onClick={handleReject}
                  disabled={isApproving}
                  className="p-1 text-muted hover:text-rose-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="px-2 py-1 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Approve"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={handleReject}
                  disabled={isApproving}
                  className="px-2 py-1 text-xs font-medium text-rose-400/90 bg-rose-500/10 hover:bg-rose-500/20 rounded transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Reject"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Terminal Output */}
      {isExecuted && (
        <>
          <div className="px-3 py-2 bg-white/5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted">$ {command}</span>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-2 font-mono text-xs scrollbar-hide bg-black/20">
            {terminalOutput.length === 0 ? (
              <div className="text-muted text-center py-4 text-xs">
                Waiting for output...
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
        </>
      )}
    </div>
  );
}
