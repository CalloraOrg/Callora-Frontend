// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormPersistence } from './useFormPersistence';

const TEST_KEY = 'test:form-persistence';

interface TestForm {
  name: string;
  value: string;
}

const DEFAULT_FORM: TestForm = { name: '', value: '' };

describe('useFormPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores data from localStorage on mount', () => {
    const savedData: TestForm = { name: 'Test API', value: 'hello' };
    localStorage.setItem(TEST_KEY, JSON.stringify(savedData));

    const setter = vi.fn();
    const { result } = renderHook(() =>
      useFormPersistence(TEST_KEY, DEFAULT_FORM, setter),
    );

    expect(result.current.wasRestored).toBe(true);
    expect(setter).toHaveBeenCalledWith(savedData);
  });

  it('does not restore when restoreOnMount is false', () => {
    const savedData: TestForm = { name: 'Saved', value: 'data' };
    localStorage.setItem(TEST_KEY, JSON.stringify(savedData));

    const setter = vi.fn();
    renderHook(() =>
      useFormPersistence(TEST_KEY, DEFAULT_FORM, setter, {
        restoreOnMount: false,
      }),
    );

    expect(setter).not.toHaveBeenCalled();
  });

  it('does not restore when localStorage is empty', () => {
    const setter = vi.fn();
    const { result } = renderHook(() =>
      useFormPersistence(TEST_KEY, DEFAULT_FORM, setter),
    );

    expect(result.current.wasRestored).toBe(false);
    expect(setter).not.toHaveBeenCalled();
  });

  it('saves data to localStorage after restore (debounced)', () => {
    const setter = vi.fn();
    renderHook(() =>
      useFormPersistence(TEST_KEY, DEFAULT_FORM, setter, { debounceMs: 100 }),
    );

    // Trigger a re-render with new data
    const newData: TestForm = { name: 'New', value: 'data' };
    const { result, rerender } = renderHook(
      ({ data }) => useFormPersistence(TEST_KEY, data, setter, { debounceMs: 100 }),
      { initialProps: { data: DEFAULT_FORM } },
    );

    rerender({ data: newData });

    // Before debounce fires, localStorage should be empty
    expect(localStorage.getItem(TEST_KEY)).toBeNull();

    // After debounce fires
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(localStorage.getItem(TEST_KEY)).toBe(JSON.stringify(newData));
  });

  it('clearDraft removes data from localStorage', () => {
    localStorage.setItem(TEST_KEY, JSON.stringify({ name: 'test', value: 'val' }));

    const setter = vi.fn();
    const { result } = renderHook(() =>
      useFormPersistence(TEST_KEY, DEFAULT_FORM, setter),
    );

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('hasDraft returns true when data exists in localStorage', () => {
    localStorage.setItem(TEST_KEY, JSON.stringify({ name: 'test', value: 'val' }));

    const setter = vi.fn();
    const { result } = renderHook(() =>
      useFormPersistence(TEST_KEY, DEFAULT_FORM, setter),
    );

    expect(result.current.hasDraft).toBe(true);
  });

  it('hasDraft returns false when localStorage is empty', () => {
    const setter = vi.fn();
    const { result } = renderHook(() =>
      useFormPersistence(TEST_KEY, DEFAULT_FORM, setter),
    );

    expect(result.current.hasDraft).toBe(false);
  });

  it('handles corrupted JSON gracefully', () => {
    localStorage.setItem(TEST_KEY, 'not-valid-json{{{');

    const setter = vi.fn();
    const { result } = renderHook(() =>
      useFormPersistence(TEST_KEY, DEFAULT_FORM, setter),
    );

    // Should not restore corrupted data
    expect(result.current.wasRestored).toBe(false);
    expect(setter).not.toHaveBeenCalled();
  });

  it('cleans up debounce timer on unmount', () => {
    const setter = vi.fn();
    const { unmount } = renderHook(() =>
      useFormPersistence(TEST_KEY, DEFAULT_FORM, setter, { debounceMs: 200 }),
    );

    unmount();

    // No error should occur after unmount
    act(() => {
      vi.advanceTimersByTime(300);
    });
  });
});
