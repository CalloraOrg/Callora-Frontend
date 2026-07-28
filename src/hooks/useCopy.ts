import { useCallback, useEffect, useRef, useState } from "react";

const RESET_MS = 2000;

/**
 * Reusable copy-to-clipboard hook.
 *
 * Uses the async Clipboard API with a textarea/execCommand fallback
 * for older browsers. Exposes a `copied` flag that auto-resets after
 * 2 seconds, matching the feedback pattern used by CodeExample and
 * CopyCurlButton.
 *
 * @example
 * const { copied, handleCopy } = useCopy();
 * <button onClick={() => handleCopy("text")}>Copy</button>
 */
export default function useCopy() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), RESET_MS);
  }, []);

  return { copied, handleCopy } as const;
}
