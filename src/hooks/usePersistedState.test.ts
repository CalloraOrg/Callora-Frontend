// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePersistedState } from './usePersistedState';

describe('usePersistedState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns_default_value_when_key_absent', () => {
    const { result, unmount } = renderHook(() =>
      usePersistedState<string>('absent-1', 'default')
    );
    expect(result.current[0]).toBe('default');
    unmount();
  });

  it('returns_stored_value_when_key_exists', () => {
    localStorage.setItem('stored-1', JSON.stringify('saved'));
    const { result, unmount } = renderHook(() =>
      usePersistedState<string>('stored-1', 'default')
    );
    expect(result.current[0]).toBe('saved');
    unmount();
  });

  it('falls_back_to_default_when_stored_value_is_malformed_json', () => {
    localStorage.setItem('bad-1', 'not valid json');
    const { result, unmount } = renderHook(() =>
      usePersistedState<string>('bad-1', 'fallback')
    );
    expect(result.current[0]).toBe('fallback');
    unmount();
  });
});
