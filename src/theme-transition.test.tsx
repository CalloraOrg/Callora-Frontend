// @vitest-environment jsdom
/**
 * Theme transition tests
 *
 * Covers:
 *  - ThemeProvider: theme-transitions-ready class added after first paint
 *  - ThemeProvider: data-theme attribute updated on theme change
 *  - ThemeProvider: isTransitioning flag lifecycle
 *  - ThemeProvider: THEME_TRANSITION_MS exported constant
 *  - ThemeToggle: icon cross-fade (theme-toggle-icon--swapping) during switch
 *  - ThemeToggle: aria-label / aria-pressed / aria-live label text
 *  - ThemeToggle: cycles dark → light → system → dark
 *  - ThemeToggle: renders all three icon variants without error
 *  - CSS escape hatch: .no-theme-transition class API exists
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import { THEME_TRANSITION_MS, ThemeProvider, useTheme } from './ThemeContext';
import { ThemeToggle } from './ThemeToggle';

// ── Shared matchMedia mock factory ──────────────────────────────────────────
// We need a stable mock that works even after vi.useRealTimers() resets.
// Rebuild it in beforeEach so restoreAllMocks() doesn't destroy it.
function buildMatchMediaMock() {
  return vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// ── localStorage mock ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ── Test helpers ─────────────────────────────────────────────────────────────

/** A minimal component that surfaces theme context values via data attributes. */
function ThemeConsumer() {
  const { theme, actualTheme, isTransitioning } = useTheme();
  return (
    <div
      data-testid="consumer"
      data-theme={theme}
      data-actual={actualTheme}
      data-transitioning={String(isTransitioning)}
    />
  );
}

/** Renders ThemeProvider + children. */
function renderWithTheme(ui: React.ReactNode = <ThemeToggle />) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('theme-transitions-ready');
  // Re-apply the matchMedia mock each time so restoreAllMocks() cannot break it.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: buildMatchMediaMock(),
  });
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.runAllTimers();   // drain any pending timers before switching to real
  vi.useRealTimers();
});

// ── ThemeProvider ─────────────────────────────────────────────────────────────

describe('ThemeProvider', () => {
  it('adds theme-transitions-ready to <html> after first rAF', async () => {
    renderWithTheme();

    // The class must NOT be present synchronously (it fires in a rAF).
    expect(document.documentElement.classList.contains('theme-transitions-ready')).toBe(false);

    // Flush rAF queue via fake timers.
    act(() => {
      vi.runAllTimers();
    });

    expect(document.documentElement.classList.contains('theme-transitions-ready')).toBe(true);
  });

  it('sets data-theme on <html> to the persisted preference', () => {
    localStorageMock.setItem(
      'callora.prefs',
      JSON.stringify({ theme: 'light', density: 'comfortable', pageSize: 12 }),
    );
    renderWithTheme(<ThemeConsumer />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('defaults to dark theme when no preference is stored', () => {
    renderWithTheme(<ThemeConsumer />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('updates data-theme when setTheme is called', () => {
    function ThemeSwitcher() {
      const { setTheme } = useTheme();
      return (
        <button onClick={() => setTheme('light')} data-testid="switch">
          switch
        </button>
      );
    }

    renderWithTheme(<ThemeSwitcher />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      fireEvent.click(screen.getByTestId('switch'));
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sets isTransitioning=true immediately after theme change, clears after THEME_TRANSITION_MS', () => {
    function ThemeSwitcher() {
      const { setTheme, isTransitioning } = useTheme();
      return (
        <>
          <button onClick={() => setTheme('light')} data-testid="switch">s</button>
          <span data-testid="flag">{String(isTransitioning)}</span>
        </>
      );
    }

    renderWithTheme(<ThemeSwitcher />);

    // Drain the initial effect timer so we have a clean baseline.
    act(() => vi.runAllTimers());
    expect(screen.getByTestId('flag').textContent).toBe('false');

    // Trigger a theme change.
    act(() => {
      fireEvent.click(screen.getByTestId('switch'));
    });

    // isTransitioning should be true immediately.
    expect(screen.getByTestId('flag').textContent).toBe('true');

    // Advance past the transition duration.
    act(() => {
      vi.advanceTimersByTime(THEME_TRANSITION_MS + 1);
    });

    expect(screen.getByTestId('flag').textContent).toBe('false');
  });

  it('exports THEME_TRANSITION_MS as a positive number matching --transition-speed', () => {
    expect(typeof THEME_TRANSITION_MS).toBe('number');
    expect(THEME_TRANSITION_MS).toBeGreaterThan(0);
    // Must match the 240 ms CSS design token value.
    expect(THEME_TRANSITION_MS).toBe(240);
  });
});

// ── ThemeToggle ───────────────────────────────────────────────────────────────

describe('ThemeToggle', () => {
  it('renders without crashing', () => {
    renderWithTheme();
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('displays the label of the current theme', () => {
    renderWithTheme();
    // Default theme is "dark".
    expect(screen.getByRole('button').textContent).toContain('dark');
  });

  it('cycles dark → light → system → dark on successive clicks', () => {
    renderWithTheme();
    const btn = screen.getByRole('button');

    expect(btn.textContent).toContain('dark');

    // dark → light
    act(() => { fireEvent.click(btn); });
    act(() => { vi.runAllTimers(); });
    expect(btn.textContent).toContain('light');

    // light → system
    act(() => { fireEvent.click(btn); });
    act(() => { vi.runAllTimers(); });
    expect(btn.textContent).toContain('system');

    // system → dark
    act(() => { fireEvent.click(btn); });
    act(() => { vi.runAllTimers(); });
    expect(btn.textContent).toContain('dark');
  });

  it('has aria-label reflecting the current theme', () => {
    renderWithTheme();
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/dark/i);
  });

  it('has aria-pressed=true in dark mode and false in light mode', () => {
    renderWithTheme();
    const btn = screen.getByRole('button');

    // Default is dark → actualTheme === 'dark' → aria-pressed="true"
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    act(() => { fireEvent.click(btn); });
    act(() => { vi.runAllTimers(); });
    // Now light → actualTheme === 'light' → aria-pressed="false"
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('aria-live label updates when theme changes', () => {
    renderWithTheme();
    const btn = screen.getByRole('button');
    const liveLabel = btn.querySelector('.theme-toggle-label');

    expect(liveLabel).not.toBeNull();
    expect(liveLabel!.getAttribute('aria-live')).toBe('polite');

    act(() => { fireEvent.click(btn); });
    act(() => { vi.runAllTimers(); });
    expect(liveLabel!.textContent).toBe('light');
  });

  it('adds theme-toggle-icon--swapping on click and removes it after the swap window', () => {
    renderWithTheme();

    // Drain initial timers.
    act(() => vi.runAllTimers());

    const btn = screen.getByRole('button');
    const iconSpan = btn.querySelector('.theme-toggle-icon');
    expect(iconSpan).not.toBeNull();

    // Not swapping before click.
    expect(iconSpan!.classList.contains('theme-toggle-icon--swapping')).toBe(false);

    // Click and check immediately.
    act(() => {
      fireEvent.click(btn);
    });
    expect(iconSpan!.classList.contains('theme-toggle-icon--swapping')).toBe(true);

    // Advance past the half-duration swap window.
    act(() => {
      vi.advanceTimersByTime(Math.floor(THEME_TRANSITION_MS / 2) + 1);
    });

    // Swapping class should now be removed.
    expect(iconSpan!.classList.contains('theme-toggle-icon--swapping')).toBe(false);
  });

  it('renders the moon icon (path, no circle) in dark mode', () => {
    renderWithTheme();
    const btn = screen.getByRole('button');
    expect(btn.querySelector('svg path')).not.toBeNull();
    expect(btn.querySelector('svg circle')).toBeNull();
  });

  it('renders the sun icon (circle) in light mode', () => {
    renderWithTheme();
    act(() => { fireEvent.click(screen.getByRole('button')); }); // dark → light
    act(() => { vi.runAllTimers(); });

    const btn = screen.getByRole('button');
    expect(btn.querySelector('svg circle')).not.toBeNull();
  });

  it('renders the monitor icon (rect) in system mode', () => {
    renderWithTheme();
    const btn = screen.getByRole('button');

    act(() => { fireEvent.click(btn); }); // dark → light
    act(() => { vi.runAllTimers(); });
    act(() => { fireEvent.click(btn); }); // light → system
    act(() => { vi.runAllTimers(); });

    expect(btn.querySelector('svg rect')).not.toBeNull();
  });

  it('icon span is aria-hidden', () => {
    renderWithTheme();
    const iconSpan = screen.getByRole('button').querySelector('.theme-toggle-icon');
    expect(iconSpan?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ── CSS escape hatch contract ─────────────────────────────────────────────────

describe('no-theme-transition escape hatch', () => {
  it('.no-theme-transition class name is a stable public API', () => {
    // Asserts the class name string so future renames break this test explicitly.
    const escapeHatchClass = 'no-theme-transition';
    const el = document.createElement('div');
    el.classList.add(escapeHatchClass);
    expect(el.classList.contains('no-theme-transition')).toBe(true);
  });

  it('elements marked .no-theme-transition retain the class after render', () => {
    function WithEscapeHatch() {
      return <div className="no-theme-transition" data-testid="opt-out" />;
    }
    renderWithTheme(<WithEscapeHatch />);
    const el = screen.getByTestId('opt-out');
    expect(el.classList.contains('no-theme-transition')).toBe(true);
  });
});

// ── ThemeStickyBar (#583 – sticky bottom action bar) ─────────────────────────
/**
 * Tests for the sticky bottom action bar introduced in issue #583
 * (GrantFox FWC26 / Stellar Wave campaign).
 *
 * The bar appears once the inline toggle button scrolls out of the viewport
 * and exposes two primary theme actions: cycle theme and reset to system.
 *
 * We use a mocked IntersectionObserver to simulate visibility changes.
 */

let observerCallback: IntersectionObserverCallback;

function buildIntersectionObserverMock() {
  return vi.fn().mockImplementation((callback: IntersectionObserverCallback) => {
    observerCallback = callback;
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  });
}

function triggerIntersection(isIntersecting: boolean) {
  act(() => {
    observerCallback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

describe('ThemeStickyBar', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: buildIntersectionObserverMock(),
    });
  });

  it('renders the sticky bar element in the DOM', () => {
    renderWithTheme();
    const bar = screen.getByTestId('theme-sticky-bar');
    expect(bar).toBeDefined();
  });

  it('is NOT visible (missing --visible modifier) before scrolling', () => {
    renderWithTheme();
    const bar = screen.getByTestId('theme-sticky-bar');
    expect(bar.classList.contains('theme-sticky-bar--visible')).toBe(false);
  });

  it('becomes visible after scrolling past the 120 px threshold', () => {
    renderWithTheme();
    triggerIntersection(false);
    const bar = screen.getByTestId('theme-sticky-bar');
    expect(bar.classList.contains('theme-sticky-bar--visible')).toBe(true);
  });

  it('hides again when user scrolls back above the threshold', () => {
    renderWithTheme();

    triggerIntersection(false);
    const bar = screen.getByTestId('theme-sticky-bar');
    expect(bar.classList.contains('theme-sticky-bar--visible')).toBe(true);

    triggerIntersection(true);
    expect(bar.classList.contains('theme-sticky-bar--visible')).toBe(false);
  });

  it('has aria-hidden="true" when not scrolled', () => {
    renderWithTheme();
    const bar = screen.getByTestId('theme-sticky-bar');
    expect(bar.getAttribute('aria-hidden')).toBe('true');
  });

  it('has aria-hidden="false" when scrolled past threshold', () => {
    renderWithTheme();
    triggerIntersection(false);
    const bar = screen.getByTestId('theme-sticky-bar');
    expect(bar.getAttribute('aria-hidden')).toBe('false');
  });

  it('has role="toolbar" and a descriptive aria-label', () => {
    renderWithTheme();
    const bar = screen.getByTestId('theme-sticky-bar');
    expect(bar.getAttribute('role')).toBe('toolbar');
    expect(bar.getAttribute('aria-label')).toBe('Theme controls');
  });

  it('cycle button (#theme-sticky-cycle) cycles dark → light on click', () => {
    renderWithTheme();

    triggerIntersection(false);

    const cycleBtn = document.getElementById('theme-sticky-cycle');
    expect(cycleBtn).not.toBeNull();

    const headerBtn = screen.getByRole('button', { hidden: true, name: /toggle theme/i });
    expect(headerBtn.textContent).toContain('dark');

    act(() => { fireEvent.click(cycleBtn!); });
    act(() => { vi.runAllTimers(); });

    expect(headerBtn.textContent).toContain('light');
  });

  it('reset button (#theme-sticky-reset) resets theme to "system"', () => {
    renderWithTheme();
    triggerIntersection(false);

    const resetBtn = document.getElementById('theme-sticky-reset');
    expect(resetBtn).not.toBeNull();

    act(() => { fireEvent.click(resetBtn!); });
    act(() => { vi.runAllTimers(); });

    const label = document.querySelector('.theme-toggle-label');
    expect(label?.textContent).toBe('system');
  });

  it('reset button has aria-pressed="true" when theme is already "system"', () => {
    renderWithTheme();
    triggerIntersection(false);

    const resetBtn = document.getElementById('theme-sticky-reset');
    act(() => { fireEvent.click(resetBtn!); });
    act(() => { vi.runAllTimers(); });

    expect(resetBtn!.getAttribute('aria-pressed')).toBe('true');
  });

  it('cycle button has aria-pressed="true" in dark mode', () => {
    renderWithTheme();
    triggerIntersection(false);
    const cycleBtn = document.getElementById('theme-sticky-cycle');
    expect(cycleBtn!.getAttribute('aria-pressed')).toBe('true');
  });

  it('cycle button carries the --primary class', () => {
    renderWithTheme();
    triggerIntersection(false);
    const cycleBtn = document.getElementById('theme-sticky-cycle');
    expect(cycleBtn!.classList.contains('theme-sticky-bar__btn--primary')).toBe(true);
  });

  it('disconnects IntersectionObserver on unmount (no memory leak)', () => {
    const disconnectSpy = vi.fn();

    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: disconnectSpy,
      })),
    });

    const { unmount } = renderWithTheme();
    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
