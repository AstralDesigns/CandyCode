import { Check, X, FileText, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';

export default function BatchApprovalWidget() {
  const { pendingDiffs, acceptedDiffs, rejectedDiffs, acceptDiff, rejectDiff, openFileByPath } = useStore();
  
  // Filter out accepted/rejected diffs - only show pending ones
  const pendingEntries = Array.from(pendingDiffs.entries()).filter(
    ([filePath]) => !acceptedDiffs.has(filePath) && !rejectedDiffs.has(filePath)
  );
  const pendingCount = pendingEntries.length;

  if (pendingCount === 0) return null;

  const handleApproveAll = () => {
    for (const [filePath] of pendingEntries) {
      acceptDiff(filePath);
    }
  };

  const handleRejectAll = () => {
    for (const [filePath] of pendingEntries) {
      rejectDiff(filePath);
    }
  };

  // Calculate change stats
  const getChangeStats = (original: string, modified: string) => {
    const origLines = (original || '').split('\n').length;
    const modLines = (modified || '').split('\n').length;
    const added = Math.max(0, modLines - origLines);
    const removed = Math.max(0, origLines - modLines);
    return { added, removed };
  };

  return (
    <div className="rounded-xl overflow-hidden bg-white/5 border border-border backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-white/5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
            <FileText size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Pending Approvals</h4>
            <p className="text-[10px] text-muted font-medium">{pendingCount} file{pendingCount !== 1 ? 's' : ''} waiting for review</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRejectAll}
            className="px-3 py-1.5 text-xs font-semibold text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
          >
            Reject All
          </button>
          <button
            onClick={handleApproveAll}
            className="px-4 py-1.5 text-xs font-bold bg-accent hover:brightness-110 text-white rounded-lg transition-all shadow-lg shadow-accent/20 flex items-center gap-1.5"
          >
            <Check size={14} strokeWidth={3} />
            <span>Approve All</span>
          </button>
        </div>
      </div>
      
      <div className="p-2 max-h-60 overflow-y-auto space-y-1">
        {pendingEntries.map(([filePath, diff]) => {
          const fileName = filePath.split('/').pop() || filePath;
          const stats = getChangeStats(diff.original || '', diff.modified || '');
          
          return (
            <div key={filePath} className="group flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
              <div 
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                onClick={() => openFileByPath(filePath)}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-accent/50 group-hover:bg-accent transition-colors" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-foreground truncate group-hover:text-accent transition-colors font-mono">{fileName}</span>
                  <span className="text-[10px] text-muted truncate font-mono">{filePath}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-green-400/80">+{stats.added}</span>
                  <span className="text-rose-400/80">-{stats.removed}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => rejectDiff(filePath)}
                    className="p-1.5 text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={() => acceptDiff(filePath)}
                    className="p-1.5 text-muted hover:text-green-400 hover:bg-green-500/10 rounded-md transition-all"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
