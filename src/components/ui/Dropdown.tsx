
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  title?: string;
}

export default function Dropdown({ value, onChange, options, placeholder, className = '', title }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current && 
        !triggerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Calculate position
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        // Check if we're too close to the bottom of the screen
        const spaceBelow = window.innerHeight - rect.bottom;
        const estimatedHeight = Math.min(options.length * 36 + 8, 256); // approx height
        
        // If constrained by window width
        let left = rect.left;
        let width = Math.max(rect.width, 160); // Minimum width
        
        if (left + width > window.innerWidth - 10) {
            left = window.innerWidth - width - 10;
        }

        // Adjust top if not enough space below
        let top = rect.bottom + 5;
        if (spaceBelow < estimatedHeight && rect.top > estimatedHeight) {
             // Position above if space is tight below but ample above
             // Note: simpler implementation keeps it below or adjusts slightly, 
             // for full robustness we'd calculate upward positioning.
        }

        setPosition({
          top: top,
          left: left,
          width: width
        });
      }
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, options.length]);

  const selectedLabel = options.find(o => o.value === value)?.label || value || placeholder || 'Select...';

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-3 py-1.5 bg-white/5 border border-border rounded text-xs text-foreground hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        data-tooltip={title}
        data-tooltip-position="bottom"
      >
        <span className="truncate mr-2">{selectedLabel}</span>
        <ChevronDown className={`w-3 h-3 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[10000] rounded-xl shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-xl border max-h-60 overflow-y-auto custom-scrollbar dropdown-portal"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            backgroundColor: 'var(--settings-bg)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)'
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center px-3 py-2 text-xs transition-colors text-left
                ${value === option.value ? 'bg-accent/10 text-accent font-medium' : 'hover:bg-[var(--context-menu-hover-bg)]'}
              `}
            >
              {option.label}
              {value === option.value && <Check className="w-3 h-3 ml-auto" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
