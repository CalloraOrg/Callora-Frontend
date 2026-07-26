export type DensityPreference = "comfortable" | "compact";

// export const DENSITY_STORAGE_KEY = 'callora.density';

const VALID: DensityPreference[] = ["comfortable", "compact"];

export const DENSITY_STORAGE_KEY = "callora.density";

export function readDensityPreference(): DensityPreference {
  try {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (stored && (VALID as string[]).includes(stored)) {
      return stored as DensityPreference;
    }
  } catch {
    // localStorage unavailable (SSR / private browsing)
  }
  return "comfortable";
}

export function persistDensityPreference(density: DensityPreference): void {
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    // localStorage unavailable
  }
}
