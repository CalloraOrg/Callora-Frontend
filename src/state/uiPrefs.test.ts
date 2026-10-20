// @vitest-environment jsdom
import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DENSITY_STORAGE_KEY,
  getDensityPreference,
  setDensityPreference,
  isSectionCollapsed,
  toggleSectionCollapsed,
  setSectionCollapsed,
} from './uiPrefs';

beforeEach(() => {
  localStorage.clear();
});

// Consolidated density preference coverage (#1186). These tests previously
// lived in src/utils/density.test.ts, which tested the duplicate module that
// has been removed in favor of state/uiPrefs.ts as the single owner of the
// `callora.density` key.
describe('uiPrefs - density preferences', () => {
  it('defaults to comfortable when nothing is stored', () => {
    expect(getDensityPreference()).toBe('comfortable');
  });

  it('persists compact selections and reads them back', () => {
    expect(setDensityPreference('compact')).toBe('compact');

    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
    expect(getDensityPreference()).toBe('compact');
  });

  it('round-trips comfortable selections', () => {
    setDensityPreference('compact');
    setDensityPreference('comfortable');

    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('comfortable');
    expect(getDensityPreference()).toBe('comfortable');
  });

  it('falls back to comfortable for invalid stored values', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'invalid');

    expect(getDensityPreference()).toBe('comfortable');
  });

  it('exposes the canonical callora.density storage key', () => {
    expect(DENSITY_STORAGE_KEY).toBe('callora.density');
  });

  it('returns comfortable when localStorage.getItem throws', () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage unavailable');
      });

    try {
      expect(getDensityPreference()).toBe('comfortable');
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it('does not throw when localStorage.setItem throws', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage unavailable');
      });

    try {
      expect(() => setDensityPreference('compact')).not.toThrow();
      expect(setDensityPreference('compact')).toBe('compact');
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('returns comfortable when window is undefined (SSR)', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulate a server environment for this test
    delete globalThis.window;

    try {
      expect(getDensityPreference()).toBe('comfortable');
      expect(setDensityPreference('compact')).toBe('compact');
    } finally {
      globalThis.window = originalWindow;
    }
  });
});

describe('uiPrefs - collapsed sections', () => {
  describe('isSectionCollapsed', () => {
    it('returns false when section not stored', () => {
      expect(isSectionCollapsed('categories')).toBe(false);
    });

    it('returns true when section is stored as collapsed', () => {
      localStorage.setItem('callora.filters.collapsed', JSON.stringify(['categories']));
      expect(isSectionCollapsed('categories')).toBe(true);
    });

    it('returns false when section is stored as expanded', () => {
      // Empty array means no sections collapsed
      localStorage.setItem('callora.filters.collapsed', JSON.stringify([]));
      expect(isSectionCollapsed('categories')).toBe(false);
    });
  });

  describe('toggleSectionCollapsed', () => {
    it('returns true when collapsing an uncollapsed section', () => {
      expect(toggleSectionCollapsed('categories')).toBe(true);
      expect(isSectionCollapsed('categories')).toBe(true);
    });

    it('returns false when expanding a collapsed section', () => {
      localStorage.setItem('callora.filters.collapsed', JSON.stringify(['categories']));
      expect(toggleSectionCollapsed('categories')).toBe(false);
      expect(isSectionCollapsed('categories')).toBe(false);
    });

    it('does not affect other sections', () => {
      localStorage.setItem('callora.filters.collapsed', JSON.stringify(['price']));
      toggleSectionCollapsed('categories');
      expect(isSectionCollapsed('price')).toBe(true);
      expect(isSectionCollapsed('categories')).toBe(true);
    });
  });

  describe('setSectionCollapsed', () => {
    it('collapses a section when set to true', () => {
      setSectionCollapsed('price', true);
      expect(isSectionCollapsed('price')).toBe(true);
    });

    it('expands a section when set to false', () => {
      localStorage.setItem('callora.filters.collapsed', JSON.stringify(['price']));
      setSectionCollapsed('price', false);
      expect(isSectionCollapsed('price')).toBe(false);
    });

    it('does not affect other sections', () => {
      localStorage.setItem('callora.filters.collapsed', JSON.stringify(['categories']));
      setSectionCollapsed('price', true);
      expect(isSectionCollapsed('categories')).toBe(true);
      expect(isSectionCollapsed('price')).toBe(true);
    });
  });
});