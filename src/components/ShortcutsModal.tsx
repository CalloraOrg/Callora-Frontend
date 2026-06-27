import { useState, useEffect, useRef } from 'react';
import { SHORTCUTS } from '../hooks/useGlobalShortcuts';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Group shortcuts by category
  const groupedShortcuts = SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof SHORTCUTS>);

  // Filter shortcuts based on search query
  const filteredShortcuts = Object.entries(groupedShortcuts).map(([category, shortcuts]) => {
    const filtered = shortcuts.filter(
      (s) =>
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.key.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { category, shortcuts: filtered };
  }).filter((group) => group.shortcuts.length > 0);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    searchInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Restore focus on close
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'var(--backdrop)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="deposit-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(800px, 100%)',
          maxHeight: 'min(85vh, 900px)',
          overflow: 'auto',
          padding: '28px',
          borderRadius: '30px',
          border: '1px solid var(--line-strong)',
          background: 'var(--modal-bg)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div className="modal-header" style={{ marginBottom: '24px' }}>
          <div>
            <p className="eyebrow">Keyboard Shortcuts</p>
            <h2 id="shortcuts-title" style={{ margin: 0 }}>Shortcuts</h2>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close shortcuts"
          >
            Close
          </button>
        </div>

        {/* Search Input */}
        <div style={{ marginBottom: '24px' }}>
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--line)',
              background: 'var(--surface-soft)',
              color: 'var(--text)',
              fontSize: '1rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Shortcuts List */}
        <div style={{ display: 'grid', gap: '24px' }}>
          {filteredShortcuts.length > 0 ? (
            filteredShortcuts.map(({ category, shortcuts }) => (
              <div key={category}>
                <h3
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: '1rem',
                    color: 'var(--accent-strong)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {category}
                </h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {shortcuts.map((shortcut, index) => (
                    <div
                      key={`${category}-${index}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: 'var(--surface-soft)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <span style={{ color: 'var(--text)' }}>
                        {shortcut.description}
                      </span>
                      <kbd
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'var(--accent)',
                          color: 'white',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          fontFamily: 'monospace',
                        }}
                      >
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              No shortcuts match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
