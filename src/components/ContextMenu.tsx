import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  divider?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Adjust position if menu goes off screen
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 350);

  const menu = (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[200px] rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-xl border"
      style={{ 
        top: adjustedY, 
        left: adjustedX,
        backgroundColor: 'var(--settings-bg)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-primary)'
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => (
        <div key={index}>
          {item.divider && (
            <div 
              className="h-px my-1 mx-2" 
              style={{ backgroundColor: 'var(--border-color)', opacity: 0.5 }}
            />
          )}
          {!item.divider && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                onClose();
              }}
              disabled={item.disabled}
              className={`
                w-full flex items-center gap-3 px-3 py-1.5 mx-1.5 rounded-lg w-[calc(100%-12px)] text-sm transition-colors
                ${item.disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[var(--context-menu-hover-bg)]'}
              `}
              style={{ 
                color: 'inherit',
                backgroundColor: 'transparent' 
              }}
            >
              {item.icon && <span className="w-4 h-4 flex items-center justify-center opacity-70">{item.icon}</span>}
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <span className="text-[10px] opacity-40 font-mono tracking-tighter ml-4">
                  {item.shortcut}
                </span>
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return createPortal(menu, document.body);
}
