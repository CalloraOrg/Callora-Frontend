import { useEffect, useRef, useState } from "react";
import { toCurl, type CurlRequest } from "../utils/toCurl";

/**
 * CopyCurlButton — copies a request to the clipboard as a ready-to-run `curl`
 * command and gives clear, accessible success feedback (issue #284).
 *
 * Accessibility (WCAG 2.1 AA):
 * - Real <button> with a descriptive `aria-label`.
 * - Success/failure is announced via an `aria-live="polite"` region.
 * - Focus styles rely on the app's design tokens.
 */

type CopyCurlButtonProps = {
  /** The request to serialise into a cURL command. */
  request: CurlRequest;
  /** Optional class for layout integration. */
  className?: string;
};

const RESET_MS = 2000;

export default function CopyCurlButton({
  request,
  className,
}: CopyCurlButtonProps): JSX.Element {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleReset = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setStatus("idle"), RESET_MS);
  };

  const handleCopy = async () => {
    const command = toCurl(request);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(command);
      } else {
        // Fallback for browsers without the async clipboard API.
        const textarea = document.createElement("textarea");
        textarea.value = command;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setStatus("copied");
    } catch (err) {
      console.error("Failed to copy cURL command:", err);
      setStatus("error");
    }
    scheduleReset();
  };

  const label =
    status === "copied"
      ? "Copied"
      : status === "error"
        ? "Copy failed"
        : "Copy as cURL";

  return (
    <>
      <button
        type="button"
        className={className ?? "ghost-button"}
        onClick={handleCopy}
        aria-label="Copy request as a cURL command"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.75rem",
          padding: "0.3125rem 0.75rem",
          color:
            status === "copied"
              ? "var(--success, #10b981)"
              : status === "error"
                ? "var(--danger, #ef4444)"
                : undefined,
        }}
      >
        <span aria-hidden="true">{status === "copied" ? "✓" : "⌘"}</span>
        {label}
      </button>
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          margin: "-1px",
          padding: 0,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {status === "copied"
          ? "cURL command copied to clipboard"
          : status === "error"
            ? "Failed to copy cURL command"
            : ""}
      </span>
    </>
  );
}
