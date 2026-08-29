// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '../ThemeContext';
import { ThemeToggle } from './ThemeToggle';

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
  return { setDark: (v: boolean) => { mql.matches = v; listeners.forEach((l) => l({ matches: v })); } };
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe('ThemeToggle stays operable and announces theme changes', () => {
  it('exposes an accessible name and a polite live region that reflects the theme', () => {
    installMatchMedia(false);
    renderToggle();

    const toggle = screen.getByRole('button', { name: /toggle theme/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed');

    // The label is a polite live region that announces the active theme.
    const live = within(toggle).getByText(/dark|light|system/i);
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps the toggle in the accessibility tree after switching to light', () => {
    installMatchMedia(false);
    renderToggle();

    const toggle = screen.getByRole('button', { name: /toggle theme/i }) as HTMLButtonElement;
    act(() => {
      toggle.click(); // dark -> light
    });

    const updated = screen.getByRole('button', { name: /toggle theme/i });
    expect(updated).toBeInTheDocument();
    expect(updated.getAttribute('aria-label')).toMatch(/light/i);
  });

  it('the sticky action bar is inert/aria-hidden until revealed (no stray announcements)', () => {
    installMatchMedia(false);
    renderToggle();
    const bar = screen.getByTestId('theme-sticky-bar');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar).toHaveAttribute('inert');
  });
});
