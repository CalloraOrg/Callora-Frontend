import { useEffect, useCallback } from 'react';

export interface Shortcut {
  key: string;
  description: string;
  category: string;
}

export const SHORTCUTS: Shortcut[] = [
  // Global
  { key: '?', description: 'Open shortcuts help', category: 'Global' },
  { key: 'Esc', description: 'Close modals', category: 'Global' },
  
  // Navigation
  { key: 'g h', description: 'Go to Dashboard', category: 'Navigation' },
  { key: 'g m', description: 'Go to Marketplace', category: 'Navigation' },
  { key: 'g b', description: 'Go to Billing', category: 'Navigation' },
  
  // Plan
  { key: 'u', description: 'Upgrade plan', category: 'Plan' },
  
  // Marketplace
  { key: '/', description: 'Focus search bar', category: 'Marketplace' },
  { key: 'c', description: 'Add/remove focused API card to comparison', category: 'Marketplace' },
  
  // ApiDetailPage
  { key: 'Esc', description: 'Go back to Marketplace', category: 'ApiDetailPage' },
  { key: '1-5', description: 'Switch tabs (1=Overview, 2=Documentation, 3=Pricing, 4=Examples, 5=Reviews)', category: 'ApiDetailPage' },
  { key: 's', description: 'Select recommended pricing plan', category: 'Pricing' },
];


export function useGlobalShortcuts(handler: (event: KeyboardEvent) => void) {
  const isFormField = useCallback((element: Element | null): boolean => {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    const isEditable = (element as HTMLElement).isContentEditable;
    const isInput = ['input', 'textarea', 'select'].includes(tagName);
    return isInput || isEditable;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFormField(document.activeElement)) {
        return;
      }
      handler(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handler, isFormField]);
}
