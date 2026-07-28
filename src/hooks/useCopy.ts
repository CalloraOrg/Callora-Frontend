import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_DURATION_MS = 2000;

export interface UseCopyReturn {
  /** Whether the last copy was successful and we're still showing feedback. */
  copied: boolean;
  /** Whether the browser's clipboard API is supported in this environment. */
  supported: boolean;
  /** Copy `text` to clipboard.  Returns `true` on success. */
  copy: (text: string) => Promise<boolean>;
}

/**
 * useCopy — a tiny copy-to-clipboard hook with success feedback.
 *
 * - Wraps `navigator.clipboard.writeText` with a `try/catch` so callers never
 *   need to handle permission / HTTPS errors.
 * - Sets `copied = true` for 2 seconds after a successful copy so the UI can
 *   show a transient "Copied!" label, icon, or tooltip (WCAG 2.1 SC 2.2.1).
 * - Reports `supported` so the consuming component can hide the copy button
 *   entirely when the Clipboard API is unavailable (e.g. insecure context).
 *
 * @example
 * ```tsx
 * const { copy, copied, supported } = useCopy();
 * if (!supported) return null;
 * return <button onClick={() => copy("hello")}>{copied ? "Copied!" : "Copy"}</button>;
 * ```
 */
export function useCopy(): UseCopyReturn {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported =
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function";

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Cleanup timer on unmount so we never update state after dismount.
    return () => clearTimer();
  }, [clearTimer]);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!supported) return false;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearTimer();
        timerRef.current = setTimeout(() => setCopied(false), FEEDBACK_DURATION_MS);
        return true;
      } catch {
        return false;
      }
    },
    [supported, clearTimer],
  );

  return { copy, copied, supported };
}
