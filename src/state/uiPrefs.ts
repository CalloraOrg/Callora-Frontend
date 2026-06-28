// src/state/uiPrefs.ts

export type DensityPreference = "comfortable" | "compact";

const DENSITY_STORAGE_KEY = "callora.density";

export function getDensityPreference(): DensityPreference {
  if (typeof window === "undefined") {
    return "comfortable";
  }

  const value = window.localStorage.getItem(DENSITY_STORAGE_KEY);

  return value === "compact" ? "compact" : "comfortable";
}

export function setDensityPreference(
  density: DensityPreference,
): DensityPreference {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  }

  return density;
}