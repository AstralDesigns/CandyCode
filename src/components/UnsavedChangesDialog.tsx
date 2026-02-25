import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { X } from 'lucide-react';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClose: () => void;
  onSave: () => void;
}

export default function UnsavedChangesDialog({ isOpen, onClose, onConfirmClose, onSave }: UnsavedChangesDialogProps) {
  const { theme, customThemes, activeCustomThemeId } = useStore();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;

  // Get theme colors
  const getThemeColors = () => {
    if (theme === 'light') {
      return {
        bg: 'rgba(255, 255, 255, 0.98)',
        border: 'rgba(203, 213, 225, 0.5)',
        text: '#0f172a',
        textMuted: '#64748b',
        buttonBg: 'rgba(226, 232, 240, 0.8)',
        buttonText: '#0f172a',
        dangerBg: 'rgba(239, 68, 68, 0.9)',
        dangerText: '#ffffff',
        successBg: 'rgba(34, 197, 94, 0.9)',
        successText: '#ffffff',
      };
    }

    if (theme === 'custom' && activeCustomThemeId) {
      const customTheme = customThemes.find(t => t.id === activeCustomThemeId);
      if (customTheme) {
        return {
          bg: customTheme.colors.bgPrimary + 'f5',
          border: customTheme.colors.borderColor,
          text: customTheme.colors.textPrimary,
          textMuted: customTheme.colors.textSecondary,
          buttonBg: customTheme.colors.bgSecondary,
          buttonText: customTheme.colors.textPrimary,
          dangerBg: customTheme.colors.accentColor + 'e6',
          dangerText: customTheme.colors.bgPrimary,
          successBg: '#22c55ee6',
          successText: '#ffffff',
        };
      }
    }

    // Default dark theme (alpha/dark)
    return {
      bg: 'rgba(15, 23, 42, 0.98)',
      border: 'rgba(255, 255, 255, 0.1)',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      buttonBg: 'rgba(30, 41, 59, 0.8)',
      buttonText: '#f8fafc',
      dangerBg: 'rgba(239, 68, 68, 0.9)',
      dangerText: '#ffffff',
      successBg: 'rgba(34, 197, 94, 0.9)',
      successText: '#ffffff',
    };
  };

  const colors = getThemeColors();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md mx-4 transform transition-all duration-300 ${
          isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        style={{
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 transition-colors"
          style={{ color: colors.textMuted }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full"
            style={{ backgroundColor: colors.dangerBg + '33' }}>
            <svg
              className="w-6 h-6"
              style={{ color: colors.dangerBg }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Title */}
          <h3
            className="text-xl font-semibold text-center mb-2"
            style={{ color: colors.text }}
          >
            Unsaved Changes
          </h3>

          {/* Description */}
          <p
            className="text-center mb-6"
            style={{ color: colors.textMuted }}
          >
            You have unsaved changes that will be permanently lost if you close without saving.
          </p>

          {/* Warning note */}
          <div
            className="px-4 py-3 rounded-lg mb-6 text-sm"
            style={{
              backgroundColor: colors.dangerBg + '1a',
              border: `1px solid ${colors.dangerBg}40`
            }}
          >
            <p style={{ color: colors.textMuted }}>
              <span style={{ color: colors.dangerBg, fontWeight: 600 }}>Warning:</span> Changes not saved in the last 5 seconds will be lost permanently.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {/* Cancel button */}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: colors.buttonBg,
                color: colors.buttonText,
                border: `1px solid ${colors.border}`,
              }}
            >
              Cancel
            </button>

            {/* Save button */}
            <button
              onClick={onSave}
              className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: colors.successBg,
                color: colors.successText,
                border: 'none',
                boxShadow: '0 4px 14px 0 rgba(34, 197, 94, 0.39)',
              }}
            >
              Save
            </button>

            {/* Close without saving button */}
            <button
              onClick={onConfirmClose}
              className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: colors.dangerBg,
                color: colors.dangerText,
                border: 'none',
                boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.39)',
              }}
            >
              Close without Saving
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
