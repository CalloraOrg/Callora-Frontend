import { getPref, setPref, type DensityPreference } from './userPrefs';

export { type DensityPreference };

export const DENSITY_STORAGE_KEY = 'callora.density';

export function readDensityPreference(): DensityPreference {
  return getPref('density');
}

export function persistDensityPreference(density: DensityPreference): void {
  setPref('density', density);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  }
}
