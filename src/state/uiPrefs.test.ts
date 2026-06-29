// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSectionCollapsed,
  toggleSectionCollapsed,
  setSectionCollapsed,
} from './uiPrefs';

beforeEach(() => {
  localStorage.clear();
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