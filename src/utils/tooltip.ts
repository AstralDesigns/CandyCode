// Tooltip utility for handling tooltips in scroll containers
export function initializeTooltips() {
  // Remove any existing listeners
  document.removeEventListener('mouseenter', handleTooltipMouseEnter as any, true);
  document.removeEventListener('mouseleave', handleTooltipMouseLeave as any, true);
  
  // Add event listeners for tooltips
  document.addEventListener('mouseenter', handleTooltipMouseEnter as any, true);
  document.addEventListener('mouseleave', handleTooltipMouseLeave as any, true);
}

// Auto-initialize on import
if (typeof document !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTooltips);
  } else {
    initializeTooltips();
  }
}

let tooltipElement: HTMLElement | null = null;
let currentTarget: HTMLElement | null = null;

function handleTooltipMouseEnter(e: MouseEvent) {
  const target = e.target;
  if (!target || typeof (target as any).closest !== 'function') return;
  
  const tooltipTarget = (target as HTMLElement).closest('[data-tooltip]') as HTMLElement;
  
  if (!tooltipTarget || !tooltipTarget.dataset.tooltip) return;
  
  currentTarget = tooltipTarget;
  const tooltipText = tooltipTarget.dataset.tooltip;
  
  // Remove existing tooltip
  if (tooltipElement) {
    tooltipElement.remove();
  }
  
  // Create tooltip element
  tooltipElement = document.createElement('div');
  tooltipElement.textContent = tooltipText;
  tooltipElement.className = 'custom-tooltip';
  tooltipElement.style.cssText = `
    position: fixed;
    padding: 4px 8px;
    background-color: var(--settings-bg);
    color: var(--text-primary);
    font-size: 10px;
    white-space: nowrap;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: none;
    z-index: 10000;
    /* backdrop-filter: blur(8px); */
    max-width: 300px;
    overflow-wrap: break-word;
    word-wrap: break-word;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;
  
  document.body.appendChild(tooltipElement);
  
  // Position tooltip
  const updatePosition = () => {
    if (!tooltipElement || !tooltipTarget) return;
    
    const rect = tooltipTarget.getBoundingClientRect();
    const position = tooltipTarget.dataset.tooltipPosition || 'top';
    const tooltipRect = tooltipElement.getBoundingClientRect();
    
    let top = 0;
    let left = 0;
    
    switch (position) {
      case 'bottom':
        top = rect.bottom + 8;
        left = rect.left + rect.width / 2;
        tooltipElement.style.transform = 'translateX(-50%)';
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - tooltipRect.width - 8;
        tooltipElement.style.transform = 'translateY(-50%)';
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 8;
        tooltipElement.style.transform = 'translateY(-50%)';
        break;
      default: // top
        top = rect.top - tooltipRect.height - 8;
        left = rect.left + rect.width / 2;
        tooltipElement.style.transform = 'translateX(-50%)';
        break;
    }
    
    // Ensure tooltip stays within viewport
    const padding = 8;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }
    
    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.opacity = '1';
  };
  
  // Update position after a brief delay to ensure tooltip is rendered
  requestAnimationFrame(() => {
    updatePosition();
    // Update on scroll/resize
    const updateOnMove = () => {
      if (currentTarget === tooltipTarget) {
        updatePosition();
      }
    };
    window.addEventListener('scroll', updateOnMove, true);
    window.addEventListener('resize', updateOnMove);
    
    // Store cleanup function
    (tooltipElement as any).__cleanup = () => {
      window.removeEventListener('scroll', updateOnMove, true);
      window.removeEventListener('resize', updateOnMove);
    };
  });
}

function handleTooltipMouseLeave(e: MouseEvent) {
  const target = e.target;
  if (!target || typeof (target as any).closest !== 'function') return;
  
  const tooltipTarget = (target as HTMLElement).closest('[data-tooltip]') as HTMLElement;
  
  if (!tooltipTarget || tooltipTarget !== currentTarget) return;
  
  currentTarget = null;
  
  if (tooltipElement) {
    // Cleanup event listeners
    if ((tooltipElement as any).__cleanup) {
      (tooltipElement as any).__cleanup();
    }
    tooltipElement.remove();
    tooltipElement = null;
  }
}
