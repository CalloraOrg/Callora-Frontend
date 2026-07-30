import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPref, setPref, readAllPrefs, PREFS_STORAGE_KEY, DEFAULT_PREFS } from './userPrefs';

describe('userPrefs', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns default preferences when no data in localStorage', () => {
    const prefs = readAllPrefs();
    expect(prefs).toEqual(DEFAULT_PREFS);
  });

  it('migrates legacy theme key on first load', () => {
    window.localStorage.setItem('callora-theme', 'light');
    const prefs = readAllPrefs();
    
    expect(prefs.theme).toBe('light');
    expect(window.localStorage.getItem('callora-theme')).toBeNull(); // Should be removed
    
    const savedNewPrefs = JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY) || '{}');
    expect(savedNewPrefs.theme).toBe('light');
  });

  it('migrates legacy density key on first load', () => {
    window.localStorage.setItem('callora.density', 'compact');
    const prefs = readAllPrefs();
    
    expect(prefs.density).toBe('compact');
    expect(window.localStorage.getItem('callora.density')).toBeNull(); // Should be removed
  });

  it('ignores invalid legacy values during migration', () => {
    window.localStorage.setItem('callora-theme', 'invalid-theme');
    window.localStorage.setItem('callora.density', 'invalid-density');
    
    const prefs = readAllPrefs();
    expect(prefs.theme).toBe('dark'); // Fallback to default
    expect(prefs.density).toBe('comfortable'); // Fallback to default
  });

  it('handles JSON parse failures gracefully', () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, '{invalid json');
    const prefs = readAllPrefs();
    
    expect(prefs).toEqual(DEFAULT_PREFS); // Should recover and return defaults
  });

  it('merges stored prefs with defaults if fields are missing', () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ theme: 'light' }));
    const prefs = readAllPrefs();
    
    expect(prefs.theme).toBe('light');
    expect(prefs.density).toBe('comfortable'); // From defaults
  });

  it('allows getting and setting single preferences', () => {
    setPref('pageSize', 24);
    expect(getPref('pageSize')).toBe(24);
    
    const raw = JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY) || '{}');
    expect(raw.pageSize).toBe(24);
  });
});
