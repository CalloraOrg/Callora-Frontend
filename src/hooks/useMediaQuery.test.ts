// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

type Listener = (e: { matches: boolean }) => void;
const original = window.matchMedia;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const removeEventListener = vi.fn((_t: string, cb: Listener) => listeners.delete(cb));
  const mql = {
    matches: initial,
    media: '',
    addEventListener: (_t: string, cb: Listener) => listeners.add(cb),
    removeEventListener,
  };
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;
  const emit = (matches: boolean) => {
    mql.matches = matches;
    listeners.forEach((cb) => cb({ matches }));
  };
  return { emit, removeEventListener };
}

describe('useMediaQuery', () => {
  afterEach(() => { window.matchMedia = original; });

  it('returns the current match state', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 639px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const { emit } = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 639px)'));
    expect(result.current).toBe(false);
    act(() => emit(true));
    expect(result.current).toBe(true);
  });

  it('stops listening on unmount', () => {
    const { removeEventListener } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 639px)'));
    unmount();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });
});
