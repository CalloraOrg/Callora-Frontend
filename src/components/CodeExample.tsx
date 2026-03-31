import { useState } from "react";

type CodeExampleProps = {
  language?: string;
  code: string;
};

export default function CodeExample({
  language = "bash",
  code,
}: CodeExampleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="preview-card" style={{ padding: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          {language.toUpperCase()}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="ghost-button"
            onClick={handleCopy}
            style={{ padding: "6px 10px" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <pre
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 13,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
