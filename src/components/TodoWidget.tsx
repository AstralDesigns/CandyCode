import { Check, Circle } from 'lucide-react';
import { useStore } from '../store';
import { ProjectPlan } from '../models/plan.model';

export default function TodoWidget({ plan }: { plan: ProjectPlan | null }) {
  if (!plan || !plan.steps || plan.steps.length === 0) return null;

  const sortedSteps = [...plan.steps].sort((a, b) => a.order - b.order);
  const completedCount = sortedSteps.filter((s) => s.status === 'completed').length;
  const totalSteps = sortedSteps.length;

  return (
    <div className="rounded-lg overflow-hidden bg-white/5 border border-border backdrop-blur-sm shadow-lg">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-border bg-white/5">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <span className="text-xs font-semibold text-foreground">{plan.title || 'Plan'}</span>
          <span className="text-xs text-muted">
            ({completedCount}/{totalSteps})
          </span>
        </div>
      </div>

      {/* Steps List */}
      <div className="px-3 py-2 space-y-1.5">
        {sortedSteps.map((step) => (
          <div key={step.id} className="flex items-start gap-2 text-xs">
            <div className="mt-0.5 shrink-0">
              {step.status === 'completed' ? (
                <div className="w-3.5 h-3.5 rounded border border-green-500/50 bg-green-500/20 flex items-center justify-center">
                  <span className="text-[10px] text-green-400">✓</span>
                </div>
              ) : step.status === 'in-progress' ? (
                <div className="w-3.5 h-3.5 rounded border border-accent/50 bg-accent/20 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                </div>
              ) : step.status === 'skipped' ? (
                <div className="w-3.5 h-3.5 rounded border border-border bg-white/5 flex items-center justify-center">
                  <span className="text-[10px] text-muted">-</span>
                </div>
              ) : (
                <div className="w-3.5 h-3.5 rounded border border-border bg-white/5"></div>
              )}
            </div>
            <span
              className={`flex-1 text-foreground/90 ${
                step.status === 'completed' || step.status === 'skipped'
                  ? 'line-through text-muted'
                  : ''
              }`}
            >
              {step.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
