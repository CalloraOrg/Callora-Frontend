import { getPref, setPref, type DensityPreference } from './userPrefs';

export { type DensityPreference };

export function readDensityPreference(): DensityPreference {
  return getPref('density');
}

export function persistDensityPreference(density: DensityPreference): void {
  setPref('density', density);
}
