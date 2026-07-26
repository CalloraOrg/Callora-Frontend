import { useCallback, useEffect, useRef, useState } from "react";
import { Icons } from "../utils/icons";
import { getDefaultCodeLanguage, setDefaultCodeLanguage } from "../state/userPrefs";

/**
 * CodeExample component with tabbed navigation for multiple code snippets.
 *
 * Features:
 * - Tabbed navigation for multiple languages with roving tabindex
 * - Default language pinned via userPrefs, shared across all CodeExample instances
 * - Copy-to-clipboard with visual feedback
 * - Full WCAG 2.1 AA accessibility
 * - Dark mode support via CSS custom properties
 */

type CodeExampleProps = {
  /** An object where keys are language names and values are the code strings.
   * Example: { "bash": "curl...", "javascript": "fetch..." }
   */
  snippets: Record<string, string>;
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
   * Handles the clipboard copy action with fallback.
   * Provides immediate visual feedback.
   */
  const handleCopy = async () => {
    if (!activeCode) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(activeCode);
      } else {
        // Fallback for browsers without clipboard API
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
      // Revert the button text after 2 seconds
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  /**
   * Handles keyboard navigation in tab strip (arrow keys, Home, End).
   * Implements roving tabindex pattern.
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
      {/* Header Section: Contains Language Tabs and Copy Button */}
      <div className="no-print code-sample__header">
        {/* Navigation Tabs List with Roving Tabindex */}
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
              className={`code-sample__tab ${resolvedLanguage === lang ? 'code-sample__tab--active' : ''}`}
              onClick={() => setActiveLanguage(lang)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
            >
              {lang}
            </button>
          ))}
        </div>

        {/* Action: Copy to Clipboard */}
        <button
          className={`ghost-button code-sample__copy ${copied ? 'code-sample__copy--success' : ''}`}
          onClick={handleCopy}
          aria-label="Copy code snippet to clipboard"
        >
          {copied ? (
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Icons.Check size={14} /> Copied
            </span>
          ) : (
            "Copy"
          )}
        </button>
      </div>

      {/* Code Display Area */}
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

      {/* Screen reader announcement for copy success */}
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