import { useCallback, useEffect, useRef, useState } from "react";

/** How long (ms) the "Copied!" success state stays visible. */
const FEEDBACK_DURATION_MS = 2_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseCopyReturn {
  /** `true` for 2 s after a successful copy — use to show "Copied!" feedback. */
  copied: boolean;
  /**
   * `true` when the environment supports copying to the clipboard.
   *
   * The hook considers copying supported when either:
   * - `navigator.clipboard.writeText` is available (modern / HTTPS), or
   * - `document.execCommand` is available (legacy fallback).
   *
   * Use this to conditionally hide copy buttons in environments where neither
   * mechanism is present (e.g. some automated test contexts).
   */
  supported: boolean;
  /**
   * Copy `text` to the clipboard.
   *
   * Prefers the async Clipboard API; falls back to the legacy
   * `textarea + document.execCommand("copy")` path for older browsers and
   * non-HTTPS contexts.
   *
   * Returns `true` on success, `false` on failure.
   */
  handleCopy: (text: string) => Promise<boolean>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCopy — copy-to-clipboard with transient success feedback.
 *
 * Features:
 * - Wraps `navigator.clipboard.writeText` with an `execCommand` fallback so the
 *   hook works in HTTP contexts and older browsers.
 * - Sets `copied = true` for {@link FEEDBACK_DURATION_MS} ms after a successful
 *   copy to drive "Copied!" labels / checkmark icons (WCAG 2.1 SC 2.2.1).
 * - Cleans up any pending timer on unmount so React never updates unmounted state.
 * - Re-clicking before the timer expires resets the 2-second window from scratch
 *   (no flickering "Copy" → "Copied!" between rapid clicks).
 *
 * @example
 * ```tsx
 * const { copied, handleCopy } = useCopy();
 * return (
 *   <button onClick={() => handleCopy("hello")}>
 *     {copied ? "Copied!" : "Copy"}
 *   </button>
 * );
 * ```
 */
export function useCopy(): UseCopyReturn {
  const [copied, setCopied] = useState(false);
  // Keep a stable ref to the reset timer so we can cancel / restart it.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Whether this environment can copy to the clipboard at all.
   * True when either the async Clipboard API or the legacy execCommand is
   * available.  Evaluated once on mount — the value won't change during the
   * component's lifetime.
   */
  const supported =
    (typeof navigator !== "undefined" &&
      typeof navigator.clipboard?.writeText === "function") ||
    (typeof document !== "undefined" &&
      typeof document.execCommand === "function");

  // Cancel any outstanding timer — extracted so both the copy path and
  // the cleanup effect can share the same logic without a circular ref.
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Ensure we never set state after the component has unmounted.
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const handleCopy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (navigator.clipboard?.writeText) {
          // Preferred path: async Clipboard API (requires HTTPS or localhost).
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback: create an off-screen textarea, select its content, and
          // issue an `execCommand("copy")`.  Works in HTTP contexts and older
          // browsers (Safari < 13.1, some WebViews).
          const textarea = document.createElement("textarea");
          textarea.value = text;
          // Keep it invisible and out of layout.
          textarea.style.cssText =
            "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }

        // Show success feedback and reset after FEEDBACK_DURATION_MS.
        setCopied(true);
        clearTimer();
        timerRef.current = setTimeout(
          () => setCopied(false),
          FEEDBACK_DURATION_MS,
        );
        return true;
      } catch {
        // Clipboard access denied, or browser restrictions — fail silently.
        return false;
      }
    },
    [clearTimer],
  );

  return { copied, supported, handleCopy };
}

// Default export so callers can use either:
//   import useCopy from "../hooks/useCopy";          // default
//   import { useCopy } from "../hooks/useCopy";       // named
export default useCopy;
