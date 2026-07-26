import { useEffect, useRef, useState } from 'react';
import { useTheme, THEME_TRANSITION_MS } from './ThemeContext';

/**
 * ThemeToggle
 *
 * Cycles through dark → light → system → dark.
 *
 * Icon cross-fade: when the theme changes the icon wrapper receives the
 * `.theme-toggle-icon--swapping` class for half the transition duration,
 * hiding the outgoing icon.  The class is removed after the outgoing SVG
 * has been replaced with the incoming one, producing a clean fade-out →
 * swap → fade-in sequence that is coordinated with the CSS color transition.
 *
 * Sticky action bar (#583 – GrantFox FWC26 / Stellar Wave campaign):
 * A bottom-fixed action bar slides into view once the user has scrolled
 * past a threshold (120 px).  It surfaces the two primary theme actions
 * (cycle and reset to system) so they remain accessible without scrolling
 * back to the toggle in the header.
 *
 *   - Fully keyboard-navigable (Tab order, focus-visible ring).
 *   - WCAG 2.1 AA: min 48 px touch targets, role="toolbar", descriptive
 *     aria-labels, aria-pressed on the cycle button.
 *   - Respects prefers-reduced-motion for slide-in animation.
 *   - Design-token + dark-mode consistent (uses var(--surface), var(--accent),
 *     var(--line), var(--text), var(--muted), var(--shadow)).
 *   - Responsive: full-width on narrow viewports, centred pill on wide.
 */
export function ThemeToggle() {
  const { theme, setTheme, actualTheme } = useTheme();

  // ── Icon cross-fade state ─────────────────────────────────────────────────
  // Track whether the icon is mid-swap (opacity = 0) for the cross-fade.
  const [iconSwapping, setIconSwapping] = useState(false);
  const prevThemeRef = useRef(theme);

  useEffect(() => {
    if (prevThemeRef.current === theme) return;
    prevThemeRef.current = theme;

    // Fade out the outgoing icon over the first half of the transition.
    setIconSwapping(true);
    const swapDuration = Math.floor(THEME_TRANSITION_MS / 2);
    const tid = window.setTimeout(() => {
      setIconSwapping(false);
    }, swapDuration);

    return () => window.clearTimeout(tid);
  }, [theme]);

  // ── Scroll detection for sticky action bar ────────────────────────────────
  /**
   * The bar becomes visible once the user has scrolled more than
   * SCROLL_THRESHOLD pixels.  We use a passive scroll listener on
   * `window` so it does not block the main thread.
   */
  const SCROLL_THRESHOLD = 120;
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    // Evaluate immediately in case the page is already scrolled (e.g. after a
    // browser restore or hash navigation).
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Theme cycle logic ─────────────────────────────────────────────────────
  const cycleTheme = () => {
    if (theme === 'dark')        setTheme('light');
    else if (theme === 'light')  setTheme('system');
    else                         setTheme('dark');
  };

  /** Reset to the system-resolved preference. */
  const resetToSystem = () => setTheme('system');

  // ── Icon helpers ──────────────────────────────────────────────────────────
  const getIcon = (forTheme = theme) => {
    if (forTheme === 'dark') return (
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
    if (forTheme === 'light') return (
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
    // system
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

  // ── Next-theme label for the cycle button's aria-label ───────────────────
  const nextTheme =
    theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';

  return (
    <>
      {/* ── Inline toggle (always visible in the header) ── */}
      <button
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
        <span className="theme-toggle-label" aria-live="polite">{theme}</span>
      </button>

      {/* ── Sticky bottom action bar (#583) ───────────────────────────────
          Slides up once the user scrolls past SCROLL_THRESHOLD.
          Hidden from AT when not visible via aria-hidden + inert attribute.
          role="toolbar" groups the related actions semantically.
      ─────────────────────────────────────────────────────────────────── */}
      <div
        className={`theme-sticky-bar${isScrolled ? ' theme-sticky-bar--visible' : ''}`}
        role="toolbar"
        aria-label="Theme controls"
        /* Remove from tab order and hide from AT when not visible */
        aria-hidden={!isScrolled}
        /* inert keeps focus from landing on hidden bar in browsers that support it */
        {...(!isScrolled ? { inert: '' } : {})}
        data-testid="theme-sticky-bar"
      >
        {/* Inner pill that constrains width on wide viewports */}
        <div className="theme-sticky-bar__inner">
          {/* ── Cycle button ── */}
          <button
            id="theme-sticky-cycle"
            className="theme-sticky-bar__btn theme-sticky-bar__btn--primary"
            onClick={cycleTheme}
            aria-label={`Switch to ${nextTheme} theme`}
            aria-pressed={actualTheme === 'dark'}
            title={`Switch to ${nextTheme} theme`}
          >
            <span
              className={`theme-toggle-icon${iconSwapping ? ' theme-toggle-icon--swapping' : ''}`}
              aria-hidden="true"
            >
              {getIcon()}
            </span>
            <span>
              {/* Capitalize the theme name for display */}
              {theme.charAt(0).toUpperCase() + theme.slice(1)} mode
            </span>
          </button>

          {/* ── Divider ── */}
          <div className="theme-sticky-bar__divider" aria-hidden="true" />

          {/* ── Reset to system button ── */}
          <button
            id="theme-sticky-reset"
            className={`theme-sticky-bar__btn${theme === 'system' ? ' theme-sticky-bar__btn--active' : ''}`}
            onClick={resetToSystem}
            aria-label="Reset to system theme preference"
            aria-pressed={theme === 'system'}
            title="Use OS / browser theme preference"
          >
            {/* Monitor / system icon */}
            <span aria-hidden="true">{getIcon('system')}</span>
            <span>System</span>
          </button>
        </div>
      </div>
    </>
  );
}
