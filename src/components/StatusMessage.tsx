import { useEffect, useState } from 'react';

interface StatusMessageProps {
  message: string;
  isActive: boolean;
  isComplete: boolean;
}

export default function StatusMessage({ message, isActive, isComplete }: StatusMessageProps) {
  const [showAnimation, setShowAnimation] = useState(isActive && !isComplete);

  useEffect(() => {
    setShowAnimation(isActive && !isComplete);
  }, [isActive, isComplete]);

  return (
    <div className={`flex items-start gap-1.5 text-xs font-mono w-full ${isComplete ? 'py-0.5' : 'py-1'}`}>
      <span
        className={`
          relative overflow-hidden break-all
          ${isComplete ? 'text-muted/60' : showAnimation ? 'text-foreground' : 'text-muted'}
          transition-colors duration-300
        `}
        style={{
          fontSize: '11px',
          lineHeight: '1.4',
        }}
      >
        <span className={showAnimation && !isComplete ? 'animate-streak' : ''}>
          {message}
        </span>
        {showAnimation && !isComplete && (
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 45%, rgba(0, 0, 0, 0.4) 50%, rgba(255, 255, 255, 0.4) 55%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite linear',
              mixBlendMode: 'overlay',
            }}
          />
        )}
      </span>
      {isActive && !isComplete && (
        <div className="shrink-0 w-1 h-1 mt-1.5 rounded-full bg-accent animate-pulse" />
      )}
      {isComplete && (
        <span className="shrink-0 text-accent/60 mt-0.5" style={{ fontSize: '10px' }}>✓</span>
      )}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -150% 0;
          }
          100% {
            background-position: 150% 0;
          }
        }
      `}</style>
    </div>
  );
}
