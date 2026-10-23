import { useEffect } from 'react';

/**
 * useBeforeUnload — Warns the user before closing/refreshing the page when
 * there are unsaved changes.
 *
 * Registers a native `beforeunload` handler that fires the browser's
 * "unsaved changes" dialog when `hasUnsavedChanges` is true.
 *
 * SSR-safe: checks typeof window before attaching.
 */
export function useBeforeUnload(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasUnsavedChanges) return;

    const handler = (event: BeforeUnloadEvent) => {
      // Standard — shows browser's built-in confirmation dialog
      event.preventDefault();
      // Legacy support for older browsers
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [hasUnsavedChanges]);
}
