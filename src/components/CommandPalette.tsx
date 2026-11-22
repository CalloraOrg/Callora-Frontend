import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import { fetchCatalog, isCatalogAbortError } from '../api/catalogApi';
import type { APIItem } from '../data/mockApis';
import './CommandPalette.css';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  name: string;
  category: 'Navigation' | 'Actions' | 'APIs';
  action: () => void;
  icon?: string;
}

// ---------------------------------------------------------------------------
// Recent-commands persistence
// ---------------------------------------------------------------------------

const RECENT_STORAGE_KEY = 'callora_cmd_recent';
const RECENT_MAX = 8;

function readRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecentIds(ids: string[]): void {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // storage quota / security errors – silently ignore
  }
}

function pushRecentId(id: string): string[] {
  const prev = readRecentIds().filter((x) => x !== id);
  const next = [id, ...prev].slice(0, RECENT_MAX);
  writeRecentIds(next);
  return next;
}

function useRecentIds() {
  const [recentIds, setRecentIds] = useState<string[]>(readRecentIds);

  const recordId = useCallback((id: string) => {
    setRecentIds(pushRecentId(id));
  }, []);

  return { recentIds, recordId };
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [catalogApis, setCatalogApis] = useState<APIItem[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  const { theme, setTheme } = useTheme();
  const { recentIds, recordId } = useRecentIds();

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const hasFetchedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad|darwin/i.test(navigator.userAgent || navigator.platform || '');

  // Lazily load catalogue APIs the first time the palette opens; abort on unmount
  useEffect(() => {
    if (!isOpen || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setCatalogStatus('loading');

    fetchCatalog(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setCatalogApis(items);
        setCatalogStatus('loaded');
      })
      .catch((err) => {
        if (controller.signal.aborted || isCatalogAbortError(err)) return;
        setCatalogStatus('error');
      });
  }, [isOpen]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Define commands
  const standardCommands: Command[] = useMemo(
    () => [
      {
        id: 'dashboard',
        name: 'Go to Dashboard',
        category: 'Navigation',
        action: () => navigate('/dashboard'),
        icon: '📊'
      },
      {
        id: 'marketplace',
        name: 'Go to Marketplace',
        category: 'Navigation',
        action: () => navigate('/marketplace'),
        icon: '🛍️'
      },
      {
        id: 'my-apis',
        name: 'Go to My APIs',
        category: 'Navigation',
        action: () => navigate('/apis/my-apis'),
        icon: '🔌'
      },
      {
        id: 'billing',
        name: 'Go to Billing',
        category: 'Navigation',
        action: () => navigate('/billing'),
        icon: '💳'
      },
      {
        id: 'publish',
        name: 'Go to Publish API',
        category: 'Navigation',
        action: () => navigate('/publish'),
        icon: '🚀'
      },
      {
        id: 'api-usage',
        name: 'Go to API Usage',
        category: 'Navigation',
        action: () => navigate('/api-usage'),
        icon: '📈'
      },
      {
        id: 'documentation',
        name: 'Go to Documentation',
        category: 'Navigation',
        action: () => navigate('/documentation'),
        icon: '📚'
      },
      {
        id: 'status',
        name: 'Go to Status Page',
        category: 'Navigation',
        action: () => navigate('/status'),
        icon: '🟢'
      },
      {
        id: 'deposit',
        name: 'Open Deposit modal',
        category: 'Actions',
        action: () => navigate('/billing?deposit=true'),
        icon: '💰'
      },
      {
        id: 'toggle-theme',
        name: 'Toggle Theme',
        category: 'Actions',
        action: () => {
          if (theme === 'dark') setTheme('light');
          else if (theme === 'light') setTheme('system');
          else setTheme('dark');
        },
        icon: '🌗'
      },
      {
        id: 'theme-dark',
        name: 'Use Dark Theme',
        category: 'Actions',
        action: () => setTheme('dark'),
        icon: '🌙'
      },
      {
        id: 'theme-light',
        name: 'Use Light Theme',
        category: 'Actions',
        action: () => setTheme('light'),
        icon: '☀️'
      },
      {
        id: 'theme-system',
        name: 'Use System Theme',
        category: 'Actions',
        action: () => setTheme('system'),
        icon: '💻'
      }
    ],
    [navigate, theme, setTheme]
  );

  const apiCommands: Command[] = useMemo(
    () =>
      catalogApis.map((api) => ({
        id: `api-${api.id}`,
        name: `Jump to ${api.name}`,
        category: 'APIs',
        action: () => navigate(`/details/${api.id}`),
        icon: '🔌'
      })),
    [catalogApis, navigate]
  );

  const allCommands = useMemo(
    () => [...standardCommands, ...apiCommands],
    [standardCommands, apiCommands]
  );

  const filteredCommands = allCommands.filter((cmd) => {
    const q = searchQuery.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  // ---------------------------------------------------------------------------
  // Recent-aware display lists
  // ---------------------------------------------------------------------------

  // Empty query → show Recent group first, then everything else.
  // Non-empty query → filtered results, but recently-used items float to top.
  const { displayGroups, flatList } = React.useMemo(() => {
    if (searchQuery === '') {
      const recentCmds = recentIds
        .map((id) => allCommands.find((c) => c.id === id))
        .filter((c): c is Command => c !== undefined);

      const recentSet = new Set(recentIds);
      const rest = allCommands.filter((c) => !recentSet.has(c.id));

      const groups: { label: string; commands: Command[] }[] = [];
      if (recentCmds.length > 0) {
        groups.push({ label: 'Recent', commands: recentCmds });
      }

      // Group the remainder by category
      const byCategory = new Map<string, Command[]>();
      for (const cmd of rest) {
        const bucket = byCategory.get(cmd.category) ?? [];
        bucket.push(cmd);
        byCategory.set(cmd.category, bucket);
      }
      for (const [label, commands] of byCategory) {
        groups.push({ label, commands });
      }

      const flat = groups.flatMap((g) => g.commands);
      return { displayGroups: groups, flatList: flat };
    } else {
      // Filter first, then sort recent ids to the top as a tie-breaker
      const matched = filteredCommands.slice().sort((a, b) => {
        const aIdx = recentIds.indexOf(a.id);
        const bIdx = recentIds.indexOf(b.id);
        const aRecent = aIdx === -1 ? Infinity : aIdx;
        const bRecent = bIdx === -1 ? Infinity : bIdx;
        return aRecent - bRecent;
      });

      // Group by category (keeping recent-sorted order within each category
      // would feel odd – so we just use a single implicit grouping by category
      // while preserving the sorted order across the full list)
      const byCategory = new Map<string, Command[]>();
      for (const cmd of matched) {
        const bucket = byCategory.get(cmd.category) ?? [];
        bucket.push(cmd);
        byCategory.set(cmd.category, bucket);
      }
      const groups = [...byCategory.entries()].map(([label, commands]) => ({
        label,
        commands,
      }));
      const flat = groups.flatMap((g) => g.commands);
      return { displayGroups: groups, flatList: flat };
    }
  }, [searchQuery, allCommands, filteredCommands, recentIds]);

  // Helper: run a command, record it, then close
  const executeCommand = useCallback(
    (cmd: Command) => {
      recordId(cmd.id);
      cmd.action();
      onClose();
    },
    [recordId, onClose]
  );

  // Reset selection index when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Open/close lifecycle: save/restore focus, lock page scroll, reset search
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = '';
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  // Keyboard navigation and focus trap while open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          flatList.length > 0 ? (prev + 1) % flatList.length : 0
        );
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          flatList.length > 0
            ? (prev - 1 + flatList.length) % flatList.length
            : 0
        );
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList.length > 0 && flatList[selectedIndex]) {
          executeCommand(flatList[selectedIndex]);
        }
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const first = focusableElements[0] as HTMLElement;
        const last = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, flatList, selectedIndex, executeCommand, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.querySelector(
      '.command-palette-item--selected'
    );
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="command-palette-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="command-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="command-palette-header">
          <svg
            className="command-palette-search-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or API name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search commands and APIs"
            aria-autocomplete="list"
            aria-controls="command-palette-list"
          />
          {searchQuery && (
            <button
              type="button"
              className="command-palette-clear-button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="command-palette-close-button"
            onClick={onClose}
            aria-label="Close palette"
          >
            Esc
          </button>
        </header>

        <main
          ref={listRef}
          id="command-palette-list"
          className="command-palette-results"
          role="listbox"
          aria-label="Commands"
        >
          {flatList.length === 0 && catalogStatus !== 'loading' && catalogStatus !== 'error' ? (
            <div className="command-palette-empty">No results found</div>
          ) : (
            <>
              {displayGroups.map((group) => (
                <React.Fragment key={group.label}>
                  <div className="command-palette-group-header">{group.label}</div>
                  {group.commands.map((cmd) => {
                    const index = flatList.indexOf(cmd);
                    const isSelected = index === selectedIndex;
                    return (
                      <div
                        key={cmd.id}
                        id={`cmd-opt-${cmd.id}`}
                        role="option"
                        aria-selected={isSelected}
                        className={`command-palette-item ${
                          isSelected ? 'command-palette-item--selected' : ''
                        }`}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <span className="command-palette-item-icon" aria-hidden="true">
                          {cmd.icon || '⚡'}
                        </span>
                        <span className="command-palette-item-name">{cmd.name}</span>
                        {isSelected && (
                          <span className="command-palette-item-hint">Enter</span>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
              {catalogStatus === 'loading' && (
                <>
                  <div className="command-palette-group-header">APIs</div>
                  <div className="command-palette-empty" role="status">
                    Loading APIs…
                  </div>
                </>
              )}
              {catalogStatus === 'error' && (
                <>
                  <div className="command-palette-group-header">APIs</div>
                  <div className="command-palette-empty" role="alert">
                    Could not load APIs
                  </div>
                </>
              )}
            </>
          )}
        </main>

        <footer className="command-palette-footer">
          <span className="command-palette-footer-hint">
            <kbd>↑↓</kbd> to navigate
          </span>
          <span className="command-palette-footer-hint">
            <kbd>↵</kbd> to select
          </span>
          <span className="command-palette-footer-hint">
            <kbd>esc</kbd> to close
          </span>
          <span className="command-palette-footer-shortcut">
            Shortcut: <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>+<kbd>K</kbd>
          </span>
        </footer>
      </div>
    </div>,
    document.body
  );
}
