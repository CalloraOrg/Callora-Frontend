// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultCodeLanguage, setDefaultCodeLanguage } from './userPrefs';

const STORAGE_KEY = 'callora:codeExample:language';

beforeEach(() => {
  localStorage.clear();
});

describe('userPrefs - default code sample language', () => {
  describe('getDefaultCodeLanguage', () => {
    it('returns null when no language is pinned', () => {
      expect(getDefaultCodeLanguage()).toBeNull();
    });

    it('returns the pinned language when stored', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify('python'));
      expect(getDefaultCodeLanguage()).toBe('python');
    });

    it('returns null when stored value is malformed JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json');
      expect(getDefaultCodeLanguage()).toBeNull();
    });
  });

  describe('setDefaultCodeLanguage', () => {
    it('persists the language under the shared storage key', () => {
      setDefaultCodeLanguage('javascript');
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify('javascript'));
    });

    it('overwrites a previously pinned language', () => {
      setDefaultCodeLanguage('python');
      setDefaultCodeLanguage('bash');
      expect(getDefaultCodeLanguage()).toBe('bash');
    });

    it('round-trips through getDefaultCodeLanguage', () => {
      setDefaultCodeLanguage('typescript');
      expect(getDefaultCodeLanguage()).toBe('typescript');
    });
  });
});
