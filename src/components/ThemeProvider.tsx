import { useEffect } from 'react';
import { useStore } from '../store';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, customThemes, activeCustomThemeId, activeStandardThemeId } = useStore();

  useEffect(() => {
    const root = document.documentElement;
    // Remove all possible theme classes
    root.classList.remove(
      'theme-light', 'theme-dark', 'theme-alpha', 'theme-custom', 'theme-standard',
      'theme-catppuccin-mocha', 'theme-gruvbox', 'theme-tokyo-night', 'theme-dracula',
      'theme-solarized-dark', 'theme-monokai', 'theme-rose-pine', 'theme-graphite',
      'theme-crimson', 'theme-greenify'
    );
    
    if (theme === 'custom' && activeCustomThemeId) {
      const customTheme = customThemes.find(t => t.id === activeCustomThemeId);
      if (customTheme) {
        root.classList.add('theme-custom');
        
        // Apply all colors
        Object.entries(customTheme.colors).forEach(([key, value]) => {
          // Convert camelCase to kebab-case for CSS variables
          const cssKey = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
          root.style.setProperty(cssKey, value);
        });

        // Special handling for gradients and transparency
        root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${customTheme.colors.accentColor} 0%, ${customTheme.colors.bgSecondary} 100%)`);
        
        const opacity = customTheme.transparency;
        const hexToRgba = (hex: string, alpha: number) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        try {
          root.style.setProperty('--sidebar-bg', hexToRgba(customTheme.colors.sidebarBg, opacity));
          root.style.setProperty('--chat-bg', hexToRgba(customTheme.colors.chatBg, opacity));
        } catch (e) {
          root.style.setProperty('--sidebar-bg', customTheme.colors.sidebarBg);
          root.style.setProperty('--chat-bg', customTheme.colors.chatBg);
        }
        
        root.style.setProperty('--panel-opacity', opacity.toString());
        root.style.setProperty('--context-menu-hover-bg', customTheme.colors.contextMenuHoverBg || customTheme.colors.accentColor + '33');
      } else {
        root.classList.add('theme-alpha');
      }
    } else if (theme === 'standard' && activeStandardThemeId) {
      root.classList.add(`theme-${activeStandardThemeId}`);
      // Standard themes are defined in CSS, so we don't need to set root styles manually
      // but we should clear any residual custom theme styles
      clearInlineStyles(root);
    } else {
      root.classList.add(`theme-${theme}`);
      clearInlineStyles(root);
    }
  }, [theme, customThemes, activeCustomThemeId, activeStandardThemeId]);

  function clearInlineStyles(root: HTMLElement) {
    const variables = [
      'bg-primary', 'bg-secondary', 'text-primary', 'text-secondary', 
      'border-color', 'accent-color', 'accent-gradient', 'sidebar-bg', 
      'chat-bg', 'header-bg', 'input-bg', 'input-border', 'user-msg-bg', 
      'user-msg-border', 'indicator-color', 'button-bg', 'button-text', 
      'settings-bg', 'panel-opacity', 'context-menu-hover-bg'
    ];
    variables.forEach(v => root.style.removeProperty(`--${v}`));
  }

  return <>{children}</>;
}
