// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../ThemeContext';
import { ThemeToggle, default as ThemeTogglePage } from './ThemeToggle';
import { getPref } from '../utils/userPrefs';

// ── Shared matchMedia mock factory ──────────────────────────────────────────
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
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function renderThemeToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

function renderThemeTogglePage() {
  return render(
    <ThemeProvider>
      <ThemeTogglePage />
    </ThemeProvider>,
  );
}

describe('ThemeToggle & Sticky Bottom Action Bar (#691 / b#014)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: buildMatchMediaMock(),
    });
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    });
  });

  afterEach(cleanup);

  it('renders inline toggle button and sticky bottom action bar', () => {
    renderThemeToggle();

    const inlineToggle = screen.getByRole('button', { name: /toggle theme/i });
    expect(inlineToggle).toBeTruthy();

    const stickyBar = screen.getByTestId('theme-sticky-bar');
    expect(stickyBar).toBeTruthy();
    expect(stickyBar.getAttribute('role')).toBe('toolbar');
    expect(stickyBar.getAttribute('aria-label')).toBe('Theme controls');
  });

  it('hides sticky bottom action bar when window.scrollY <= 120', () => {
    renderThemeToggle();

    const stickyBar = screen.getByTestId('theme-sticky-bar');
    expect(stickyBar.classList.contains('theme-sticky-bar--visible')).toBe(false);
    expect(stickyBar.getAttribute('aria-hidden')).toBe('true');
  });

  it('reveals sticky bottom action bar when window.scrollY > 120', () => {
    renderThemeToggle();

    const stickyBar = screen.getByTestId('theme-sticky-bar');
    expect(stickyBar.classList.contains('theme-sticky-bar--visible')).toBe(false);

    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 150, configurable: true });
      fireEvent.scroll(window);
    });

    expect(stickyBar.classList.contains('theme-sticky-bar--visible')).toBe(true);
    expect(stickyBar.getAttribute('aria-hidden')).toBe('false');
  });

  it('cycles theme mode when sticky primary cycle button is clicked', () => {
    renderThemeToggle();

    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
      fireEvent.scroll(window);
    });

    const cycleBtn = screen.getByTestId('theme-sticky-cycle');
    expect(cycleBtn).toBeTruthy();

    fireEvent.click(cycleBtn);
    expect(getPref('theme')).toBe('light');
  });

  it('resets to system theme preference when sticky reset button is clicked', () => {
    renderThemeToggle();

    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
      fireEvent.scroll(window);
    });

    const resetBtn = screen.getByTestId('theme-sticky-reset');
    expect(resetBtn).toBeTruthy();

    fireEvent.click(resetBtn);
    expect(resetBtn.getAttribute('aria-pressed')).toBe('true');
    expect(getPref('theme')).toBe('system');
  });

  it('renders full ThemeTogglePage with heading and overview', () => {
    renderThemeTogglePage();
    expect(screen.getByText('Theme Controls & Sticky Action Bar')).toBeTruthy();
    expect(screen.getByText('Sticky Action Bar Features')).toBeTruthy();
  });
});
