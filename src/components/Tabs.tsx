/**
 * Tabs — accessible animated tab strip
 *
 * Animation approach
 * ──────────────────
 * Rather than injecting a <style> tag (which can be overridden by the app's
 * global CSS) or relying on CSS class transitions (which require the class
 * to already exist in the stylesheet), this component:
 *
 *   1. Keeps a direct ref to the indicator <span> DOM node.
 *   2. On every tab change, reads the active button's geometry with
 *      getBoundingClientRect() and writes `left` and `width` directly to
 *      indicatorRef.current.style — bypassing React state and paint entirely.
 *   3. The <span> has a hardcoded inline `transition` style so the browser
 *      always knows how to animate between positions, regardless of whether
 *      any external CSS has loaded.
 *
 * This means the animation cannot be accidentally reset or blocked by
 * external stylesheets because every relevant style is inline.
 *
 * WCAG 2.1 AA
 * ────────────
 * • role="tablist" + role="tab" + aria-selected + aria-controls
 * • Roving tabIndex (0 on active, -1 on others)
 * • Arrow key navigation (← →), Home, End — APG Tab Pattern
 * • Indicator: aria-hidden="true" + role="presentation" (decorative)
 * • prefers-reduced-motion: transition collapses to 0ms
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabItem = {
  id: string;
  label: string;
};

export type TabsProps = {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  tabPanelId?: (tabId: string) => string;
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Tabs({ tabs, activeTab, onChange, tabPanelId = (id) => `panel-${id}`, className }: TabsProps) {
  const navRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const initialized = useRef(false);

  const reducedMotion = useRef(typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false);

  // ── Indicator position ────────────────────────────────────────────────────
  /**
   * Write position directly to the DOM node — no setState, no re-render.
   * This ensures the transition fires reliably on every tab switch.
   */
  const moveIndicator = useCallback(() => {
    const btn = buttonRefs.current.get(activeTab);
    const nav = navRef.current;
    const span = indicatorRef.current;
    if (!btn || !nav || !span) return;

    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();

    const left = btnRect.left - navRect.left + nav.scrollLeft;
    const width = btnRect.width;

    if (!initialized.current) {
      // First paint: snap instantly, then enable transitions for future moves.
      span.style.transition = "none";
      span.style.left = `${left}px`;
      span.style.width = `${width}px`;

      // Double rAF: first frame commits the snap position,
      // second frame re-enables the transition.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!indicatorRef.current) return;
          const duration = reducedMotion.current ? "0ms" : "240ms";
          indicatorRef.current.style.transition = `left ${duration} cubic-bezier(0.4,0,0.2,1), ` + `width ${duration} cubic-bezier(0.4,0,0.2,1)`;
        });
      });

      initialized.current = true;
    } else {
      // Subsequent moves animate via the already-live transition.
      span.style.left = `${left}px`;
      span.style.width = `${width}px`;
    }
  }, [activeTab]);

  useLayoutEffect(() => {
    moveIndicator();
  }, [moveIndicator]);

  useEffect(() => {
    window.addEventListener("resize", moveIndicator, { passive: true });
    return () => window.removeEventListener("resize", moveIndicator);
  }, [moveIndicator]);

  // ── Keyboard navigation (APG Tab Pattern) ─────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const nextTab = tabs[next];
    if (nextTab) {
      onChange(nextTab.id);
      buttonRefs.current.get(nextTab.id)?.focus();
    }
  };

  // ── Ref registration ──────────────────────────────────────────────────────
  const setButtonRef = useCallback(
    (id: string) => (el: HTMLButtonElement | null) => {
      if (el) buttonRefs.current.set(id, el);
      else buttonRefs.current.delete(id);
    },
    [],
  );

  // ── Inline styles — nothing depends on external CSS loading ───────────────
  const navStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    gap: 0,
    borderBottom: "2px solid var(--line)",
    scrollbarWidth: "thin" as const,
    background: "var(--page-bg)",
    margin: 0,
    padding: 0,
  };

  const getTabStyle = (id: string): React.CSSProperties => ({
    flex: "0 0 auto",
    appearance: "none" as const,
    background: "transparent",
    border: "none",
    outline: "none",
    padding: "12px 16px",
    margin: 0,
    fontSize: "15px",
    fontWeight: activeTab === id ? 700 : 500,
    fontFamily: "inherit",
    color: activeTab === id ? "var(--text)" : "var(--muted)",
    cursor: "pointer",
    position: "relative" as const,
    whiteSpace: "nowrap" as const,
    minHeight: "44px",
    display: "inline-flex",
    alignItems: "center",
    transition: "color 240ms ease",
    userSelect: "none" as const,
  });

  // Starts invisible — moveIndicator writes left/width on mount.
  const indicatorStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "-2px",
    left: "0px",
    width: "0px",
    height: "3px",
    background: "var(--accent)",
    borderRadius: "3px 3px 0 0",
    pointerEvents: "none",
    display: "block",
    // transition is written imperatively by moveIndicator after first paint
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <nav ref={navRef} style={navStyle} className={className} aria-label="API detail navigation">
      <div role="tablist" aria-orientation="horizontal" style={{ display: "contents" }}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={setButtonRef(tab.id)}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={tabPanelId(tab.id)}
            tabIndex={activeTab === tab.id ? 0 : -1}
            style={getTabStyle(tab.id)}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sliding ink-bar — decorative, hidden from assistive technology */}
      <span ref={indicatorRef} aria-hidden="true" role="presentation" style={indicatorStyle} />
    </nav>
  );
}
