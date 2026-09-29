import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFormPersistence } from './useFormPersistence';

type Draft = { name: string; count: number };

const KEY = 'test:draft';
const EMPTY: Draft = { name: '', count: 0 };

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFormPersistence', () => {
  it('returns the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    expect(result.current.value).toEqual(EMPTY);
    expect(result.current.isRestored).toBe(false);
  });

  it('restores a stored draft on mount', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: 'Weather API', count: 2 }));
    const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    expect(result.current.value).toEqual({ name: 'Weather API', count: 2 });
    expect(result.current.isRestored).toBe(true);
  });

  it('writes to storage on change', () => {
    const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));

    act(() => result.current.setValue({ name: 'Weather API', count: 1 }));

    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({
      name: 'Weather API',
      count: 1,
    });
  });

  it('supports functional updates like useState', () => {
    const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));

    act(() => result.current.setValue({ name: 'A', count: 1 }));
    act(() => result.current.setValue((prev) => ({ ...prev, count: prev.count + 1 })));

    expect(result.current.value).toEqual({ name: 'A', count: 2 });
  });

  it('does not write to storage on the mount render', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not rewrite a restored value on mount', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: 'Weather API', count: 2 }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    expect(setItem).not.toHaveBeenCalled();
  });

  it('survives a reload with the draft intact', () => {
    const first = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    act(() => first.result.current.setValue({ name: 'Weather API', count: 3 }));
    first.unmount();

    const second = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    expect(second.result.current.value).toEqual({ name: 'Weather API', count: 3 });
  });

  it('falls back to the initial value when the stored value is corrupt JSON', () => {
    localStorage.setItem(KEY, 'not json at all');
    const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    expect(result.current.value).toEqual(EMPTY);
    expect(result.current.isRestored).toBe(false);
  });

  it('rejects a stored value that fails the shape guard', () => {
    const isDraft = (candidate: unknown): candidate is Draft =>
      typeof candidate === 'object' &&
      candidate !== null &&
      typeof (candidate as Draft).name === 'string' &&
      typeof (candidate as Draft).count === 'number';

    localStorage.setItem(KEY, JSON.stringify({ legacy: true }));
    const { result } = renderHook(() => useFormPersistence(KEY, EMPTY, { isValid: isDraft }));

    expect(result.current.value).toEqual(EMPTY);
    expect(result.current.isRestored).toBe(false);
  });

  it('accepts a stored value that passes the shape guard', () => {
    const isDraft = (candidate: unknown): candidate is Draft =>
      typeof candidate === 'object' &&
      candidate !== null &&
      typeof (candidate as Draft).name === 'string';

    localStorage.setItem(KEY, JSON.stringify({ name: 'OK', count: 9 }));
    const { result } = renderHook(() => useFormPersistence(KEY, EMPTY, { isValid: isDraft }));
    expect(result.current.value).toEqual({ name: 'OK', count: 9 });
  });

  describe('discard', () => {
    it('removes the stored copy while keeping the current value', () => {
      const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
      act(() => result.current.setValue({ name: 'Weather API', count: 1 }));

      act(() => result.current.discard());

      expect(localStorage.getItem(KEY)).toBeNull();
      // Still in memory, so a success screen can render what was submitted.
      expect(result.current.value).toEqual({ name: 'Weather API', count: 1 });
    });

    it('does not resurrect the key after discarding', () => {
      const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
      act(() => result.current.setValue({ name: 'Weather API', count: 1 }));

      act(() => result.current.discard());
      act(() => result.current.setValue({ name: 'Second API', count: 2 }));

      expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({
        name: 'Second API',
        count: 2,
      });
    });

    it('replaces the value when given one, without writing it back', () => {
      const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
      act(() => result.current.setValue({ name: 'Weather API', count: 1 }));

      act(() => result.current.discard(EMPTY));

      expect(result.current.value).toEqual(EMPTY);
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('clears the restored flag', () => {
      localStorage.setItem(KEY, JSON.stringify({ name: 'Weather API', count: 2 }));
      const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
      expect(result.current.isRestored).toBe(true);

      act(() => result.current.discard());
      expect(result.current.isRestored).toBe(false);
    });

    it('leaves a clean mount for the next session', () => {
      const first = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
      act(() => first.result.current.setValue({ name: 'Weather API', count: 1 }));
      act(() => first.result.current.discard());
      first.unmount();

      const second = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
      expect(second.result.current.value).toEqual(EMPTY);
      expect(second.result.current.isRestored).toBe(false);
    });
  });

  it('keeps working when storage rejects writes (private mode / quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    expect(() => act(() => result.current.setValue({ name: 'Weather API', count: 1 }))).not.toThrow();
    // State still updates; only the reload guarantee is lost.
    expect(result.current.value).toEqual({ name: 'Weather API', count: 1 });
  });

  it('keeps working when storage rejects reads', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    expect(result.current.value).toEqual(EMPTY);
  });

  it('keeps working when removing the key throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const { result } = renderHook(() => useFormPersistence<Draft>(KEY, EMPTY));
    act(() => result.current.setValue({ name: 'Weather API', count: 1 }));
    expect(() => act(() => result.current.discard())).not.toThrow();
  });

  it('isolates separate keys from one another', () => {
    const a = renderHook(() => useFormPersistence<Draft>('test:a', EMPTY));
    const b = renderHook(() => useFormPersistence<Draft>('test:b', EMPTY));

    act(() => a.result.current.setValue({ name: 'A', count: 1 }));
    act(() => b.result.current.setValue({ name: 'B', count: 2 }));

    expect(a.result.current.value).toEqual({ name: 'A', count: 1 });
    expect(b.result.current.value).toEqual({ name: 'B', count: 2 });
  });
});
