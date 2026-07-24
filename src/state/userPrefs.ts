// src/state/userPrefs.ts

// Default code sample language, shared across all CodeExample instances site-wide.
const DEFAULT_CODE_LANGUAGE_KEY = "callora:codeExample:language";

export function getDefaultCodeLanguage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(DEFAULT_CODE_LANGUAGE_KEY);
    return stored !== null ? (JSON.parse(stored) as string) : null;
  } catch {
    // Silently fail if JSON parse fails or localStorage is unavailable
    return null;
  }
}

export function setDefaultCodeLanguage(language: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DEFAULT_CODE_LANGUAGE_KEY,
      JSON.stringify(language),
    );
  } catch {
    // Silently fail if localStorage is unavailable (private mode, quota exceeded, etc.)
  }
}
