import { useCallback, useEffect, useRef, useState } from "react";
import { Icons } from "../utils/icons";
import { getDefaultCodeLanguage, setDefaultCodeLanguage } from "../state/userPrefs";

/**
 * CodeExample component with tabbed navigation for multiple code snippets.
 *
 * Layout overview
 * ───────────────
 * Desktop / tablet (>375 px):
 *   Header is a flex row: [tab strip (scrollable)] [copy button]
 *
 * Narrow mobile (≤375 px)  — Issue #684:
 *   Header stacks to a column layout with a smooth CSS transition:
 *   [tab strip full-width] [copy button right-aligned]
 *   Tap targets reach 44 × 44 px (WCAG 2.5.5).
 *   Code panel scrolls horizontally so long lines never overflow the page.
 *   Tabs hint at scrollability via a right-edge fade mask.
 *
 * All layout, spacing, and breakpoint rules live in src/styles/code.css.
 * The component itself carries **no inline layout styles** so that @media
 * breakpoints in CSS can override them without specificity fights.
 *
 * Features
 * ────────
 * - Tabbed navigation for multiple languages with roving tabindex
 * - Default language pinned via userPrefs, shared across all CodeExample instances
 * - Copy-to-clipboard with visual feedback and screen-reader announcement
 * - Full WCAG 2.1 AA accessibility (keyboard navigation, aria-live, focus rings)
 * - Dark mode support via CSS custom properties
 * - prefers-reduced-motion respected in CSS
 */

type CodeExampleProps = {
  /**
   * An object where keys are language names and values are the code strings.
   * @example { "bash": "curl...", "javascript": "fetch..." }
   */
  snippets: Record<string, string>;
  /** Preferred language to show when no user preference is stored. */
  defaultLanguage?: string;
};

export default function CodeExample({
  snippets,
  defaultLanguage,
}: CodeExampleProps) {
  // Extract available languages from the snippets keys
  const languages = Object.keys(snippets);

  // Pin the user's preferred language (if set and available here), otherwise
  // fall back to this example's own defaultLanguage prop, then the first language.
  const [activeLanguage, setActiveLanguageState] = useState<string>(() => {
    const pinned = getDefaultCodeLanguage();
    if (pinned && pinned in snippets) {
      return pinned;
    }
    return defaultLanguage && defaultLanguage in snippets
      ? defaultLanguage
      : languages[0] || "";
  });

  const setActiveLanguage = useCallback((language: string) => {
    setActiveLanguageState(language);
    setDefaultCodeLanguage(language);
  }, []);

  // Validate persisted language is still in current languages list
  const resolvedLanguage = languages.includes(activeLanguage)
    ? activeLanguage
    : languages[0] || "";

  // State for copy feedback
  const [copied, setCopied] = useState(false);

  // Ref for tab list (used for keyboard navigation)
  const tablistRef = useRef<HTMLDivElement>(null);

  // Retrieve the code string based on the currently selected language
  const activeCode = snippets[resolvedLanguage] || "";

  // When the available languages change, ensure the active language remains valid.
  useEffect(() => {
    if (resolvedLanguage && resolvedLanguage in snippets) return;

    const availableLanguages = Object.keys(snippets);
    const fallback =
      defaultLanguage && defaultLanguage in snippets
        ? defaultLanguage
        : availableLanguages[0] || "";

    if (fallback !== resolvedLanguage) {
      setActiveLanguage(fallback);
    }
  }, [snippets, resolvedLanguage, defaultLanguage, setActiveLanguage]);

  /**
   * Handles the clipboard copy action with fallback for older browsers.
   * Provides immediate visual feedback via `copied` state.
   */
  const handleCopy = async () => {
    if (!activeCode) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(activeCode);
      } else {
        // Fallback for browsers without the Clipboard API
        const textarea = document.createElement("textarea");
        textarea.value = activeCode;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
      // Revert the button label after 2 seconds
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  /**
   * Keyboard navigation within the tab strip (roving tabindex pattern).
   * Supports ArrowRight, ArrowLeft, Home, End per WAI-ARIA 1.2 tabs pattern.
   */
  const handleTabKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex: number | null = null;

    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % languages.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + languages.length) % languages.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = languages.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      setActiveLanguage(languages[nextIndex]);

      // Move DOM focus to the newly selected tab
      const tabs = tablistRef.current?.querySelectorAll("[role=\"tab\"]");
      (tabs?.[nextIndex] as HTMLElement)?.focus();
    }
  };

  return (
    <div className="code-sample">
      {/*
       * Header — flex row on ≥376 px, stacked column on ≤375 px.
       *
       * .no-print suppresses the header in print mode (copy button is
       *  useless on paper and the language tabs add visual noise).
       *
       * NOTE: No inline layout styles here. All layout is driven by
       * code.css so that the @media (max-width: 375px) block can
       * override everything without a specificity battle.
       */}
      <div className="no-print code-sample__header">
        {/*
         * Tab strip — horizontally scrollable rail.
         *
         * `flex: 1 1 auto` + `min-width: 0` keeps it from pushing the
         * copy button off-screen when many languages are present.
         * On ≤375 px the CSS makes it full-width and removes the
         * flex-shrink constraint.
         */}
        <div
          ref={tablistRef}
          className="code-sample__tabs"
          role="tablist"
          aria-label="Code language"
        >
          {languages.map((lang, index) => (
            <button
              key={lang}
              role="tab"
              id={`tab-${lang}`}
              aria-selected={resolvedLanguage === lang}
              aria-controls={`tabpanel-${lang}`}
              tabIndex={resolvedLanguage === lang ? 0 : -1}
              className={`code-sample__tab${resolvedLanguage === lang ? " code-sample__tab--active" : ""}`}
              onClick={() => setActiveLanguage(lang)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
            >
              {lang}
            </button>
          ))}
        </div>

        {/*
         * Copy button — full-width on ≤375 px (set in CSS) to give a
         * comfortable 44 × 44 px minimum tap target (WCAG 2.5.5).
         */}
        <button
          className={`ghost-button code-sample__copy${copied ? " code-sample__copy--success" : ""}`}
          onClick={handleCopy}
          aria-label="Copy code snippet to clipboard"
        >
          {copied ? (
            <span className="code-sample__copy-inner">
              <Icons.Check size={14} aria-hidden="true" /> Copied
            </span>
          ) : (
            "Copy"
          )}
        </button>
      </div>

      {/*
       * Code panel — `overflow-x: auto` on the panel prevents long lines
       * from forcing the page to scroll horizontally on narrow viewports.
       * The pre inside uses `white-space: pre` on wider screens and
       * `white-space: pre-wrap` on ≤375 px (set in CSS).
       */}
      <div
        role="tabpanel"
        id={`tabpanel-${resolvedLanguage}`}
        aria-labelledby={`tab-${resolvedLanguage}`}
        tabIndex={0}
        className="code-sample__panel"
      >
        <pre className="code-sample__pre">
          <code>{activeCode}</code>
        </pre>
      </div>

      {/* Screen reader polite announcement for copy success (WCAG 4.1.3) */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {copied ? "Code copied to clipboard" : ""}
      </span>
    </div>
  );
}
