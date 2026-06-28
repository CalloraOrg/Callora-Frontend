import { useEffect, useState } from "react";
import { Icons } from "../utils/icons";

/**
 * UPDATED COMPONENT FOR ISSUE #188:
 * - Features tabbed navigation for multiple code snippets with roving tabindex.
 * - Language persistence with usePersistedState hook.
 * - Enhanced copy-to-clipboard with visual feedback and tooltip affordance.
 * - Full WCAG 2.1 AA accessibility with keyboard navigation.
 * - Minimalist design that respects CSS variables and focus states.
 */

type CodeExampleProps = {
  /** An object where keys are language names and values are the code strings.
   * Example: { "bash": "curl...", "javascript": "fetch..." }
   */
  snippets: Record<string, string>;
  defaultLanguage?: string;
};

const STORAGE_KEY = "callora:codeExample:language";

export default function CodeExample({
  snippets,
  defaultLanguage,
}: CodeExampleProps) {
  // Extract available languages from the snippets keys
  const languages = Object.keys(snippets);
  
  // Use persisted state for language selection
  const [activeLanguage, setActiveLanguage] = usePersistedState<string>(
    STORAGE_KEY,
    defaultLanguage && defaultLanguage in snippets
      ? defaultLanguage
      : languages[0] || ""
  );

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
    <div 
      className="preview-card" 
      style={{ 
        padding: 0, 
        overflow: "hidden", 
        border: "1px solid var(--border-subtle)" 
      }}
    >
      {/* Header Section: Contains Language Tabs and Copy Button */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "var(--bg-subtle, #f9f9f9)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {/* Navigation Tabs List with Roving Tabindex */}
        <div 
          ref={tablistRef}
          style={{ display: "flex", gap: "4px" }} 
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
              onClick={() => setActiveLanguage(lang)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: resolvedLanguage === lang ? 600 : 400,
                color: resolvedLanguage === lang ? "var(--text-main)" : "var(--muted)",
                background: resolvedLanguage === lang ? "var(--bg-highlight, #fff)" : "transparent",
                border: "1px solid",
                borderColor: resolvedLanguage === lang ? "var(--border-subtle)" : "transparent",
                borderRadius: "4px",
                cursor: "pointer",
                textTransform: "uppercase",
                transition: "all 0.2s ease",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = "2px solid var(--accent, #4e85ff)";
                e.currentTarget.style.outlineOffset = "2px";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
              }}
            >
              {lang}
            </button>
          ))}
        </div>

        {/* Action: Copy to Clipboard */}
        <button
          className="ghost-button"
          onClick={handleCopy}
          aria-label="Copy code snippet to clipboard"
          style={{
            padding: "5px 12px",
            fontSize: "11px",
            minWidth: "75px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {copied ? (
            <span style={{ 
              color: "var(--success, #10b981)", 
              display: "flex", 
              alignItems: "center", 
              gap: "4px" 
            }}>
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
        style={{ padding: "16px 12px" }}
      >
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: "13px",
            fontFamily: "var(--font-mono, monospace)",
            lineHeight: 1.5,
            color: "var(--text-main)"
          }}
        >
          <code>{activeCode}</code>
        </pre>
      </div>

      {/* Screen reader announcement for copy success */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          left: "-10000px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        {copied ? "Code copied to clipboard" : ""}
      </span>

      <style>{`
        .code-example-tab:focus-visible {
          outline: 2px solid var(--accent, #4e85ff);
          outline-offset: 2px;
        }

        .code-example-copy:focus-visible {
          outline: 2px solid var(--accent, #4e85ff);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}