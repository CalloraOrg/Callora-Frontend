export type DensityPreference = "comfortable" | "compact";

export const DENSITY_STORAGE_KEY = "callora.density";

const DEFAULT_DENSITY: DensityPreference = "comfortable";
const VALID_DENSITIES: DensityPreference[] = ["comfortable", "compact"];

export function readDensityPreference(): DensityPreference {
  if (typeof window === "undefined") {
    return DEFAULT_DENSITY;
  }

  const storedValue = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  if (storedValue && VALID_DENSITIES.includes(storedValue as DensityPreference)) {
    return storedValue as DensityPreference;
  }

  return DEFAULT_DENSITY;
}

export function persistDensityPreference(density: DensityPreference): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
}
