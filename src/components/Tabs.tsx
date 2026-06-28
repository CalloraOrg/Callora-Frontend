/**
 * Tabs
 *
 * A fully accessible, animated tab-strip component with a smooth sliding
 * indicator that follows the active tab.
 *
 * Accessibility (WCAG 2.1 AA)
 * ────────────────────────────
 * • Renders a `<nav>` containing a `role="tablist"`.
 * • Each button has `role="tab"`, `aria-selected`, and `aria-controls` that
 *   points to the matching `role="tabpanel"`.
 * • Arrow-key navigation (← →) moves focus between tabs, matching the
 *   ARIA Authoring Practices Guide (APG) Tab Pattern.
 * • Home / End jump to first / last tab.
 * • The sliding indicator is `aria-hidden`; the selected state is conveyed
 *   through `aria-selected` only, so it is not double-announced.
 *
 * Animation
 * ──────────
 * • A single absolutely-positioned `<span>` (the "ink bar") slides between
 *   tabs by reading each button's `offsetLeft` + `offsetWidth` via a ref
 *   callback.  This avoids layout-thrashing `getBoundingClientRect` on every
 *   render and produces a silky CSS transition.
 * • `prefers-reduced-motion: reduce` — when the user has requested less
 *   motion, the transition duration is set to 0 ms via an inline CSS
 *   custom property, so the indicator snaps instantly instead of animating.
 * • The indicator height, colour, and border-radius are all driven by CSS
 *   custom properties so dark / light mode works automatically.
 *
 * Dark / light mode
 * ─────────────────
 * All colours come from the repo's design tokens (--accent, --text, --muted,
 * --line, --page-bg, --transition-speed).  No hardcoded hex values.
 *
 * Responsive
 * ──────────
 * The nav is `overflow-x: auto` with `scrollbar-width: thin` so it scrolls
 * gracefully on narrow viewports without wrapping.  The indicator repositions
 * correctly after scroll because it is absolutely positioned relative to the
 * tab-list's own coordinate space.
 *
 * Props
 * ─────
 * tabs        — ordered list of { id, label } descriptors.
 * activeTab   — id of the currently selected tab (controlled).
 * onChange    — called with the new tab id when the user selects a tab.
 * tabPanelId  — optional function (tabId) => string that produces the id of
 *               each panel element for aria-controls.  Defaults to
 *               `(id) => \`panel-\${id}\``.
 * className   — forwarded to the outer <nav> element.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TabItem = {
  /** Unique identifier, also used as the aria-controls target suffix. */
  id: string;
  /** Human-readable label rendered inside the button. */
  label: string;
};

export type TabsProps = {
  /** Ordered list of tabs to render. */
  tabs: TabItem[];
  /** The currently selected tab id (controlled). */
  activeTab: string;
  /** Fired when the user activates a different tab. */
  onChange: (id: string) => void;
  /**
   * Maps a tab id to the id of its associated panel element.
   * Defaults to `(id) => \`panel-\${id}\``.
   */
  tabPanelId?: (tabId: string) => string;
  /** Extra class names forwarded to the outer <nav>. */
  className?: string;
};

// ---------------------------------------------------------------------------
// Indicator geometry
// ---------------------------------------------------------------------------

type IndicatorStyle = {
  left: number;
  width: number;
};

// ---------------------------------------------------------------------------
// Scoped component styles
// ---------------------------------------------------------------------------

const STYLES = `
/* ── Tabs nav wrapper ────────────────────────────────────────────────────── */
.tabs-nav {
  position: relative;       /* stacking context for the indicator */
  display: flex;
  gap: 0;
  /* Border below the entire strip */
  border-bottom: 1px solid var(--line);
  /* Horizontal scroll on narrow viewports */
  overflow-x: auto;
  scrollbar-width: thin;
  /* Lift above page content when sticky (parent decides position:sticky) */
  background: var(--page-bg);
  /* Reserve space for the indicator so it isn't clipped */
  padding-bottom: 0;
}

/* ── Individual tab button ───────────────────────────────────────────────── */
.tabs-tab {
  flex: 0 0 auto;
  /* Reset browser defaults */
  appearance: none;
  background: transparent;
  border: none;
  outline: none;
  /* Spacing */
  padding: 12px 4px;
  margin: 0 12px;
  /* Typography */
  font-size: 15px;
  font-weight: 400;
  font-family: inherit;
  color: var(--muted);
  cursor: pointer;
  /* Relative so the button sits above the indicator layer */
  position: relative;
  white-space: nowrap;
  /* Colour transition only — the indicator handles the underline transition */
  transition: color var(--transition-speed, 240ms) ease,
              font-weight var(--transition-speed, 240ms) ease;
  /* Touch-friendly */
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.tabs-tab:first-child {
  margin-left: 0;
}

.tabs-tab[aria-selected="true"] {
  color: var(--text);
  font-weight: 600;
}

.tabs-tab:hover:not([aria-selected="true"]) {
  color: var(--text);
}

/* Focus ring — keyboard only */
.tabs-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  box-shadow: var(--focus-ring);
  border-radius: 4px;
}

/* ── Sliding ink-bar indicator ───────────────────────────────────────────── */
.tabs-indicator {
  position: absolute;
  bottom: -1px;      /* sit on top of the border-bottom */
  height: 2px;
  background: var(--accent);
  border-radius: 2px 2px 0 0;
  /* The transition duration is overridden to 0ms when
     prefers-reduced-motion: reduce is active (see JS below).          */
  transition:
    left   var(--tabs-indicator-duration, var(--transition-speed, 240ms)) cubic-bezier(0.4, 0, 0.2, 1),
    width  var(--tabs-indicator-duration, var(--transition-speed, 240ms)) cubic-bezier(0.4, 0, 0.2, 1);
  /* Screen readers must not announce this decorative element */
  aria-hidden: true;
  pointer-events: none;
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Tabs({
  tabs,
  activeTab,
  onChange,
  tabPanelId = (id) => `panel-${id}`,
  className,
}: TabsProps) {
  // Map each tab id → its button element so we can measure geometry.
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Indicator position in the nav's own coordinate space.
  const [indicator, setIndicator] = useState<IndicatorStyle>({ left: 0, width: 0 });

  // Whether the user prefers reduced motion.
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  // Ref to the nav element — needed to compute relative left offset.
  const navRef = useRef<HTMLElement | null>(null);

  /** Re-measure the active button and update the indicator geometry. */
  const updateIndicator = useCallback(() => {
    const btn = buttonRefs.current.get(activeTab);
    const nav = navRef.current;
    if (!btn || !nav) return;

    // Use offsetLeft / offsetWidth (integer pixels, no forced reflow risk
    // when called outside of paint).
    setIndicator({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
    });
  }, [activeTab]);

  // Run after DOM paint so offsetLeft is accurate (useLayoutEffect ensures
  // we read layout before the browser paints the new frame).
  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Also update on window resize (e.g. font-size change, zoom).
  useEffect(() => {
    const onResize = () => updateIndicator();
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [updateIndicator]);

  // ── Keyboard navigation (APG Tab Pattern) ──────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      onChange(nextTab.id);
      // Move focus to the newly activated tab
      buttonRefs.current.get(nextTab.id)?.focus();
    }
  };

  // ── Ref callback — register/unregister button refs ─────────────────────
  const setButtonRef = useCallback(
    (id: string) => (el: HTMLButtonElement | null) => {
      if (el) {
        buttonRefs.current.set(id, el);
      } else {
        buttonRefs.current.delete(id);
      }
    },
    [],
  );

  return (
    <>
      <style>{STYLES}</style>

      <nav
        ref={navRef}
        className={['tabs-nav', className].filter(Boolean).join(' ')}
        aria-label="API detail navigation"
      >
        {/* Accessible tab-list */}
        <div
          role="tablist"
          aria-orientation="horizontal"
          style={{ display: 'contents' }}
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={setButtonRef(tab.id)}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={tabPanelId(tab.id)}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className="tabs-tab"
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sliding ink-bar indicator — decorative, hidden from AT */}
        <span
          className="tabs-indicator"
          aria-hidden="true"
          style={{
            left: indicator.left,
            width: indicator.width,
            // Override transition duration to 0ms for reduced-motion users.
            // The CSS variable is picked up by the .tabs-indicator rule.
            ['--tabs-indicator-duration' as string]: prefersReducedMotion.current
              ? '0ms'
              : undefined,
          }}
        />
      </nav>
    </>
  );
}
