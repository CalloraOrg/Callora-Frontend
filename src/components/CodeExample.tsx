import { useState } from "react";

/**
 * UPDATED COMPONENT FOR ISSUE #59:
 * - Features tabbed navigation for multiple code snippets.
 * - Integrated copy-to-clipboard with visual feedback toast.
 * - Accessible roles (tablist, tab) for keyboard users.
 * - Minimalist design that respects CSS variables.
 */

type CodeExampleProps = {
  /** * An object where keys are language names and values are the code strings.
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
  
  // State to manage the active language tab and the 'Copied' feedback status
  const [activeTab, setActiveTab] = useState(defaultLanguage || languages[0] || "");
  const [copied, setCopied] = useState(false);

  // Retrieve the code string based on the currently selected tab
  const activeCode = snippets[activeTab] || "";

  /**
   * Handles the clipboard copy action. 
   * Provides immediate visual feedback by changing the button text.
   */
  const handleCopy = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      // Revert the button text back to 'Copy' after 1.5 seconds
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy text: ", err);
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
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "var(--bg-subtle, #f9f9f9)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {/* Navigation Tabs List */}
        <div style={{ display: "flex", gap: "4px" }} role="tablist">
          {languages.map((lang) => (
            <button
              key={lang}
              role="tab"
              aria-selected={activeTab === lang}
              onClick={() => setActiveTab(lang)}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: activeTab === lang ? 600 : 400,
                color: activeTab === lang ? "var(--text-main)" : "var(--muted)",
                background: activeTab === lang ? "var(--bg-highlight, #fff)" : "transparent",
                border: "1px solid",
                borderColor: activeTab === lang ? "var(--border-subtle)" : "transparent",
                borderRadius: "4px",
                cursor: "pointer",
                textTransform: "uppercase",
                transition: "all 0.2s ease",
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
              ✓ Copied
            </span>
          ) : (
            "Copy"
          )}
        </button>
      </div>

      {/* Code Display Area */}
      <div style={{ padding: "16px 12px" }}>
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
    </div>
  );
}