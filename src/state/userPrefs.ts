// src/state/userPrefs.ts

// Default code sample language, shared across all CodeExample instances site-wide.
const DEFAULT_CODE_LANGUAGE_KEY = "callora:codeExample:language";

// Onboarding tour progress, persisted across visits.
const ONBOARDING_TOUR_KEY = "callora:onboardingTour";

export interface OnboardingTourProgress {
  completed: boolean;
  lastStep: number;
}

export const DEFAULT_ONBOARDING_TOUR_PROGRESS: OnboardingTourProgress = {
  completed: false,
  lastStep: 0,
};

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

export function getOnboardingTourProgress(): OnboardingTourProgress {
  if (typeof window === "undefined") {
    return { ...DEFAULT_ONBOARDING_TOUR_PROGRESS };
  }

  try {
    const stored = window.localStorage.getItem(ONBOARDING_TOUR_KEY);
    if (stored === null) {
      return { ...DEFAULT_ONBOARDING_TOUR_PROGRESS };
    }

    const parsed = JSON.parse(stored) as partial<OnboardingTourProgress> | null;
    if (parsed === null || typeof parsed !== "object") {
      return { ...DEFAULT_ONBOARDING_TOUR_PROGRESS };
    }

    return {
      completed: parsed.completed === true,
      lastStep:
        typeof parsed.lastStep === "number" &&
        Number.isFinite(parsed.lastStep) &&
        parsed.lastStep >= 0
          ? Math.floor(parsed.lastStep)
          : 0,
    };
  } catch {
    // Silently fail if JSON parse fails or localStorage is unavailable
    return { ...DEFAULT_ONBOARDING_TOUR_PROGRESS };
  }
}

export function setOnboardingTourProgress(
  progress: OnboardingTourProgress,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      ONBOARDING_TOUR_KEY,
      JSON.stringify({
        completed: progress.completed === true,
        lastStep:
          typeof progress.lastStep === "number" &&
          Number.isFinite(progress.lastStep) &&
          progress.lastStep >= 0
            ? Math.floor(progress.lastStep)
            : 0,
      }),
    );
  } catch {
    // Silently fail if localstorage is unavailable (private mode, quota exceeded, etc.)
  }
}
