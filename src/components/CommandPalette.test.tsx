// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ThemeProvider } from '../ThemeContext';
import CommandPalette from './CommandPalette';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('CommandPalette Component', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Setup a basic document structure
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <ThemeProvider>
        <CommandPalette />
      </ThemeProvider>
    );
  };

  it('is closed by default', () => {
    renderComponent();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens when Cmd+K is pressed', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByPlaceholderText('Type a command or API name...')).toBeTruthy();
  });

  it('closes when Esc is pressed', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });
    expect(screen.getByRole('dialog')).toBeTruthy();

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes when backdrop is clicked', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const backdrop = screen.getByRole('presentation');
    
    act(() => {
      fireEvent.click(backdrop);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('filters commands and APIs based on search query', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const input = screen.getByPlaceholderText('Type a command or API name...');
    
    act(() => {
      fireEvent.change(input, { target: { value: 'weather' } });
    });

    // WeatherSim API should be shown
    expect(screen.getByText('Jump to WeatherSim API')).toBeTruthy();
    // Other pages shouldn't show up unless they match "weather"
    expect(screen.queryByText('Go to Dashboard')).toBeNull();
  });

  it('clears search when clear button is clicked', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const input = screen.getByPlaceholderText('Type a command or API name...');
    act(() => {
      fireEvent.change(input, { target: { value: 'billing' } });
    });

    expect(input.value).toBe('billing');
    const clearButton = screen.getByLabelText('Clear search');

    act(() => {
      fireEvent.click(clearButton);
    });

    expect(input.value).toBe('');
  });

  it('navigates through items with ArrowUp / ArrowDown and executes on Enter', async () => {
    // Spy on history.pushState and popstate dispatch
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    // Default selection is 0 (Go to Dashboard)
    // Press ArrowDown to select index 1 (Go to Marketplace)
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowDown' });
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });

    expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/marketplace');
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(PopStateEvent));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('executes item action on click', async () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const item = screen.getByRole('option', { name: 'Go to Billing' });
    act(() => {
      fireEvent.click(item);
    });

    expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/billing');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('supports theme toggling actions', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    // Find the toggle theme command
    const lightThemeBtn = screen.getByRole('option', { name: 'Use Light Theme' });
    
    act(() => {
      fireEvent.click(lightThemeBtn);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('traps focus correctly using Tab / Shift+Tab keys', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const input = screen.getByPlaceholderText('Type a command or API name...');
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });

    const closeBtn = screen.getByLabelText('Close palette');
    
    // Press Tab while on close button (last focusable element) to cycle back to input
    act(() => {
      closeBtn.focus();
    });
    expect(document.activeElement).toBe(closeBtn);

    act(() => {
      fireEvent.keyDown(window, { key: 'Tab' });
    });
    expect(document.activeElement).toBe(input);

    // Press Shift+Tab while on input (first focusable element) to cycle to close button
    act(() => {
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('matches WeatherSim API with fuzzy query "wthr"', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const input = screen.getByPlaceholderText('Type a command or API name...');
    
    act(() => {
      fireEvent.change(input, { target: { value: 'wthr' } });
    });

    expect(screen.getByRole('option', { name: 'Jump to WeatherSim API' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Go to Dashboard' })).toBeNull();
  });

  it('matches "dep" to deposit command', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const input = screen.getByPlaceholderText('Type a command or API name...');
    
    act(() => {
      fireEvent.change(input, { target: { value: 'dep' } });
    });

    expect(screen.getByRole('option', { name: 'Open Deposit modal' })).toBeTruthy();
  });

  it('orders results by match score (best match first)', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const input = screen.getByPlaceholderText('Type a command or API name...');
    
    act(() => {
      fireEvent.change(input, { target: { value: 'wea' } });
    });

    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveTextContent('Jump to WeatherSim API');
  });

  it('highlights matched characters in results', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const input = screen.getByPlaceholderText('Type a command or API name...');
    
    act(() => {
      fireEvent.change(input, { target: { value: 'wea' } });
    });

    const weatherOption = screen.getByRole('option', { name: 'Jump to WeatherSim API' });
    const highlights = weatherOption.querySelectorAll('.command-palette-match-highlight');
    expect(highlights.length).toBeGreaterThan(0);
    const highlightText = Array.from(highlights).map(h => h.textContent).join('');
    expect(highlightText.toLowerCase()).toContain('wea');
  });

  it('screen readers read plain option name without highlights', async () => {
    renderComponent();
    
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, ctrlKey: true });
    });

    const input = screen.getByPlaceholderText('Type a command or API name...');
    
    act(() => {
      fireEvent.change(input, { target: { value: 'wea' } });
    });

    const weatherOption = screen.getByRole('option', { name: 'Jump to WeatherSim API' });
    const srText = weatherOption.querySelector('.command-palette-item-name-sr');
    expect(srText).toBeTruthy();
    expect(srText?.textContent).toBe('Jump to WeatherSim API');
  });
});
