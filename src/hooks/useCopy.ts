import { useCallback, useEffect, useRef, useState } from "react";

export type CopyStatus = "idle" | "copied" | "failed";

type CopyState = {
  copiedKey: string | null;
  status: CopyStatus;
};

function fallbackCopy(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function useCopy(resetDelayMs = 2000) {
  const [{ copiedKey, status }, setCopyState] = useState<CopyState>({
    copiedKey: null,
    status: "idle",
  });
  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (text: string, key = text) => {
      clearResetTimer();

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else if (!fallbackCopy(text)) {
          throw new Error("Clipboard unavailable");
        }

        setCopyState({ copiedKey: key, status: "copied" });
        resetTimerRef.current = window.setTimeout(() => {
          setCopyState({ copiedKey: null, status: "idle" });
          resetTimerRef.current = null;
        }, resetDelayMs);

        return true;
      } catch {
        setCopyState({ copiedKey: key, status: "failed" });
        return false;
      }
    },
    [clearResetTimer, resetDelayMs],
  );

  useEffect(() => clearResetTimer, [clearResetTimer]);

  return { copiedKey, copy, status };
}
