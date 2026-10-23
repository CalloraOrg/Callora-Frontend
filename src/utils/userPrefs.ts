export type Theme = 'light' | 'dark' | 'system';
export type DensityPreference = 'comfortable' | 'compact';

export interface UserPrefs {
  theme: Theme;
  density: DensityPreference;
  pageSize: number;
  analyticsConsent: boolean;
}

export const DEFAULT_PREFS: UserPrefs = {
  theme: 'dark',
  density: 'comfortable',
  pageSize: 12,
  analyticsConsent: false,
};

export const PREFS_STORAGE_KEY = 'callora.prefs';

function migrateLegacyKeys(prefs: Partial<UserPrefs>): Partial<UserPrefs> {
  const updatedPrefs = { ...prefs };
  
  if (typeof window === 'undefined') return updatedPrefs;
  
  const legacyTheme = window.localStorage.getItem('callora-theme');
  if (legacyTheme && !updatedPrefs.theme) {
    if (['light', 'dark', 'system'].includes(legacyTheme)) {
      updatedPrefs.theme = legacyTheme as Theme;
    }
    window.localStorage.removeItem('callora-theme');
  }

  const legacyDensity = window.localStorage.getItem('callora.density');
  if (legacyDensity && !updatedPrefs.density) {
    if (['comfortable', 'compact'].includes(legacyDensity)) {
      updatedPrefs.density = legacyDensity as DensityPreference;
    }
    window.localStorage.removeItem('callora.density');
  }

  return updatedPrefs;
}

export function readAllPrefs(): UserPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };

  const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
  let parsed: Partial<UserPrefs> = {};

  if (raw) {
    try {
      parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        parsed = {};
      }
    } catch (e) {
      // Parse failure
      parsed = {};
    }
  }

  const migrated = migrateLegacyKeys(parsed);

  const finalPrefs: UserPrefs = {
    ...DEFAULT_PREFS,
    ...migrated,
  };

  // Ensure any migrations or fixes are persisted immediately
  if (JSON.stringify(finalPrefs) !== raw && typeof window !== 'undefined') {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(finalPrefs));
  }

  return finalPrefs;
}

export function getPref<K extends keyof UserPrefs>(key: K): UserPrefs[K] {
  const prefs = readAllPrefs();
  return prefs[key];
}

export function setPref<K extends keyof UserPrefs>(key: K, value: UserPrefs[K]): void {
  const prefs = readAllPrefs();
  prefs[key] = value;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  }
}
