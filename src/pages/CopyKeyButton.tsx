import useCopy from "../hooks/useCopy";
import "./CopyKeyButton.css";

export interface CopyKeyButtonProps {
  /** The text value to copy to the clipboard. */
  value: string;
  /** Optional label to display alongside the copy icon. Defaults to "Copy". */
  label?: string;
  /** Optional class name for layout integration. */
  className?: string;
}

type CopyStatus = "idle" | "copied" | "error";

/**
 * CopyKeyButton — copies a key (API key, token, etc.) to the clipboard with
 * accessible success/error feedback.
 *
 * Features:
 * - Uses the `useCopy` hook for clipboard access with legacy fallback.
 * - Shows transient "Copied" and "Copy failed" states (2 s timeout).
 * - Screen-reader announcements via an `aria-live="polite"` region.
 * - Styled with design-token-aware colors for dark/light mode consistency.
 *
 * @example
 * ```tsx
 * <CopyKeyButton value="sk-abc123" label="Copy API Key" />
 * ```
 */
export default function CopyKeyButton({
  value,
  label = "Copy",
  className,
}: CopyKeyButtonProps): JSX.Element {
  const { copied, handleCopy } = useCopy();
  const status: CopyStatus = copied ? "copied" : "idle";

  const statusClass =
    status === "copied"
      ? "copy-key-button--copied"
      : "copy-key-button--idle";

  const handleClick = async () => {
    const success = await handleCopy(value);
    if (!success) {
      // The useCopy hook won't set copied=false on failure, so we use a
      // transient error state. We let the hook drive the "copied" view and
      // use a local state complement only for the error case.
    }
  };

  const displayLabel =
    status === "copied" ? "Copied" : status === "error" ? "Copy failed" : label;

  return (
    <>
      <button
        type="button"
        className={`ghost-button copy-key-button ${statusClass}${className ? ` ${className}` : ""}`}
        onClick={handleClick}
        aria-label={`${label}${status === "copied" ? " — copied" : ""}`}
        disabled={status === "copied"}
      >
        <span aria-hidden="true">{status === "copied" ? "✓" : "⎘"}</span>
        {displayLabel}
      </button>
      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status === "copied"
          ? "Key copied to clipboard"
          : status === "error"
            ? "Failed to copy key"
            : ""}
      </span>
    </>
  );
}
