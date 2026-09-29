// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from './ThemeContext';

/** Controllable matchMedia mock so we can simulate OS theme-preference changes. */
function installMatchMedia(initialDark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    onchange: null as null | ((e: { matches: boolean }) => void),
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
    addListener: (cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeListener: (cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
    dispatchEvent: () => true,
  };
  (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = ((
    query: string,
  ) => ({ ...mql, media: query })) as typeof window.matchMedia;
  return {
    setDark(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next }));
    },
  };
}

/** jsdom doesn't always implement rAF; provide a deterministic shim. */
beforeEach(() => {
  (window as unknown as { requestAnimationFrame: typeof window.requestAnimationFrame }).requestAnimationFrame =
    ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number) as typeof window.requestAnimationFrame;
  (window as unknown as { cancelAnimationFrame: typeof window.cancelAnimationFrame }).cancelAnimationFrame =
    ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('theme-transitions-ready');
});

function renderTheme() {
  return renderHook(() => useTheme(), {
    wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
  });
}

describe('ThemeProvider preserves operability when switching themes dynamically', () => {
  it('applies the light data-theme attribute and updates actualTheme', () => {
    installMatchMedia(false);
    const { result } = renderTheme();
    act(() => result.current.setTheme('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(result.current.actualTheme).toBe('light');
  });

  it('applies the dark data-theme attribute and updates actualTheme', () => {
    installMatchMedia(false);
    const { result } = renderTheme();
    act(() => result.current.setTheme('dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(result.current.actualTheme).toBe('dark');
  });

  it('follows the OS preference in "system" mode and updates when it changes', () => {
    const media = installMatchMedia(false); // OS = light
    const { result } = renderTheme();
    act(() => result.current.setTheme('system'));
    expect(result.current.actualTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Simulate the user switching their OS to dark at runtime.
    act(() => media.setDark(true));
    expect(result.current.actualTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // And back to light.
    act(() => media.setDark(false));
    expect(result.current.actualTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('enables theme transitions after first paint (gated by theme-transitions-ready)', () => {
    installMatchMedia(false);
    vi.useFakeTimers();
    renderTheme();
    act(() => {
      vi.runAllTimers();
    });
    expect(document.documentElement.classList.contains('theme-transitions-ready')).toBe(true);
    vi.useRealTimers();
  });

  it('toggles the isTransitioning flag around a theme switch', () => {
    installMatchMedia(false);
    const { result } = renderTheme();
    act(() => result.current.setTheme('light'));
    expect(result.current.isTransitioning).toBe(true);
  });
});
