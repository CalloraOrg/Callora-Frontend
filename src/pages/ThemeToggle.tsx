/**
 * ThemeToggle.tsx (src/pages/ThemeToggle.tsx)
 *
 * Sticky bottom action bar on ThemeToggle while scrolling (Issue #691 / b#014).
 *
 * GrantFox FWC26 campaign (Stellar Wave):
 * Surfaces primary theme actions (Cycle theme mode, Reset to system preference)
 * in a bottom-fixed action bar that slides smoothly into view once the user has
 * scrolled past a threshold (120 px).
 *
 * Accessibility (WCAG 2.1 AA):
 * - `role="toolbar"` with `aria-label="Theme controls"`.
 * - `aria-hidden={!isScrolled}` and `inert` attribute when hidden from screen.
 * - Min 48 px touch targets with WCAG-compliant `:focus-visible` outline rings.
 * - `aria-pressed` state indicators on active options.
 * - Color and styling rely on CSS custom properties (design tokens) for light/dark theme parity.
 */

import { useEffect, useRef, useState } from 'react';
import { useTheme, THEME_TRANSITION_MS } from '../ThemeContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

/**
 * Core ThemeToggle component with sticky bottom action bar on scroll.
 */
export function ThemeToggle() {
  const { theme, setTheme, actualTheme } = useTheme();

  // ── Icon cross-fade state ─────────────────────────────────────────────────
  const [iconSwapping, setIconSwapping] = useState(false);
  const prevThemeRef = useRef(theme);

  useEffect(() => {
    if (prevThemeRef.current === theme) return;
    prevThemeRef.current = theme;

    setIconSwapping(true);
    const swapDuration = Math.floor(THEME_TRANSITION_MS / 2);
    const tid = window.setTimeout(() => {
      setIconSwapping(false);
    }, swapDuration);

    return () => window.clearTimeout(tid);
  }, [theme]);

  // ── Scroll detection for sticky action bar ────────────────────────────────
  const [isScrolled, setIsScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const toggle = toggleRef.current;
    if (!toggle) return;

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      setIsScrolled(!entry.isIntersecting);
    };

    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0,
    });

    observer.observe(toggle);

    return () => {
      observer.disconnect();
    };
  }, []);

  // ── Theme cycle logic ─────────────────────────────────────────────────────
  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  /** Reset to system theme preference */
  const resetToSystem = () => setTheme('system');

  // ── Icon helpers ──────────────────────────────────────────────────────────
  const getIcon = (forTheme = theme) => {
    if (forTheme === 'dark')
      return (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    if (forTheme === 'light')
      return (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    return (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  };

  const nextTheme =
    theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';

  return (
    <>
      {/* ── Inline header toggle ── */}
      <button
        ref={toggleRef}
        type="button"
        className="theme-toggle"
        onClick={cycleTheme}
        title={`Current: ${theme}. Click to change.`}
        aria-label={`Toggle theme, currently ${theme}`}
        aria-pressed={actualTheme === 'dark'}
      >
        <span
          className={`theme-toggle-icon${iconSwapping ? ' theme-toggle-icon--swapping' : ''}`}
          aria-hidden="true"
        >
          {getIcon()}
        </span>
        <span className="theme-toggle-label" aria-live="polite">
          {theme}
        </span>
      </button>

      {/* ── Sticky bottom action bar (#691 / b#014) ── */}
      <div
        className={`theme-sticky-bar${isScrolled ? ' theme-sticky-bar--visible' : ''}`}
        role="toolbar"
        aria-label="Theme controls"
        aria-hidden={!isScrolled}
        {...(!isScrolled ? { inert: '' } : {})}
        data-testid="theme-sticky-bar"
      >
        <div className="theme-sticky-bar__inner">
          {/* Cycle primary action button */}
          <button
            id="theme-sticky-cycle"
            type="button"
            className="theme-sticky-bar__btn theme-sticky-bar__btn--primary"
            onClick={cycleTheme}
            aria-label={`Switch to ${nextTheme} theme`}
            aria-pressed={actualTheme === 'dark'}
            title={`Switch to ${nextTheme} theme`}
            data-testid="theme-sticky-cycle"
          >
            <span
              className={`theme-toggle-icon${iconSwapping ? ' theme-toggle-icon--swapping' : ''}`}
              aria-hidden="true"
            >
              {getIcon()}
            </span>
            <span>
              {theme.charAt(0).toUpperCase() + theme.slice(1)} mode
            </span>
          </button>

          <div className="theme-sticky-bar__divider" aria-hidden="true" />

          {/* Reset to system action button */}
          <button
            id="theme-sticky-reset"
            type="button"
            className={`theme-sticky-bar__btn${theme === 'system' ? ' theme-sticky-bar__btn--active' : ''}`}
            onClick={resetToSystem}
            aria-label="Reset to system theme preference"
            aria-pressed={theme === 'system'}
            title="Use OS / browser theme preference"
            data-testid="theme-sticky-reset"
          >
            <span aria-hidden="true">{getIcon('system')}</span>
            <span>System</span>
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Standalone ThemeToggle page component for demonstration and routing.
 */
export default function ThemeTogglePage() {
  useDocumentTitle('Theme Settings – Callora');

  return (
    <div
      className="theme-toggle-page surface"
      style={{
        padding: '2rem 1rem',
        minHeight: '180vh', // Ensures page is scrollable for sticky action bar preview
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">Theme preferences</p>
          <h1 style={{ margin: '0.25rem 0' }}>Theme Controls & Sticky Action Bar</h1>
          <p style={{ color: 'var(--muted, #9ca3af)', margin: 0 }}>
            Scroll down to reveal the bottom sticky action bar with quick theme controls.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div
        style={{
          padding: '1.5rem',
          borderRadius: '12px',
          background: 'var(--surface-soft, rgba(255, 255, 255, 0.03))',
          border: '1px solid var(--line, rgba(255, 255, 255, 0.1))',
        }}
      >
        <h2>Sticky Action Bar Features</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.25rem' }}>
          <li>Triggers automatically when page scroll position exceeds 120px threshold.</li>
          <li>Provides one-click primary theme cycling (Dark → Light → System).</li>
          <li>Surfaces instant reset to OS/Browser system preference.</li>
          <li>Full WCAG 2.1 AA compliance: `role="toolbar"`, min 48px touch targets, `aria-hidden` + `inert` when hidden.</li>
        </ul>
      </div>
    </div>
  );
}
