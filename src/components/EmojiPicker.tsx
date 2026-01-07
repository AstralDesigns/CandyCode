import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  x: number;
  y: number;
}

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
  '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒',
  '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
  '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶',
  '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
  '🤢', '🤮', '🤧', '🥵', '🥶', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '👻',
  '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋',
  '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇',
  '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳',
  '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋',
  '🌍', '🌎', '🌏', '🌐', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜',
  '☀️', '🌝', '🌞', '⭐', '🌟', '🌠', '☁️', '⛅', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️',
  '🔥', '💧', '🌊', '⚡', '🌈', '🧨', '✨', '🎈', '🎉', '🎊', '🧧', '🏮', '🎐', '🧧', '🎀', '🎁',
];

export default function EmojiPicker({ onSelect, onClose, x, y }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
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

  // Adjust position
  const adjustedX = Math.min(x, window.innerWidth - 260);
  const adjustedY = Math.min(y - 260, window.innerHeight - 260);

  const picker = (
    <div
      ref={pickerRef}
      className="fixed z-[10000] flex flex-col h-64 w-64 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 border backdrop-blur-xl"
      style={{ 
        top: Math.max(10, adjustedY), 
        left: Math.max(10, adjustedX),
        backgroundColor: 'var(--settings-bg)',
        borderColor: 'var(--border-color)'
      }}
    >
      <div className="p-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <input
          autoFocus
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 transition-colors"
          style={{ 
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text-primary)',
            borderColor: 'var(--input-border)',
          }}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-8 gap-1 scrollbar-hide">
        {EMOJIS.filter(e => !search || e.includes(search)).map((emoji, index) => (
          <button
            key={index}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-7 h-7 flex items-center justify-center rounded transition-colors text-lg hover:bg-white/10"
            style={{ 
              backgroundColor: 'transparent',
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <style>{`
        .hover\\:bg-white\\/10:hover {
          background-color: var(--bg-secondary);
        }
      `}</style>
    </div>
  );

  return createPortal(picker, document.body);
}
