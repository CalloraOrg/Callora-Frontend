// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from '../ThemeContext';
import CommandPalette from './CommandPalette';
import { fetchCatalog } from '../api/catalogApi';
import type { APIItem } from '../data/mockApis';

vi.mock('../api/catalogApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/catalogApi')>();
  return {
    ...actual,
    fetchCatalog: vi.fn(),
  };
});

const mockedFetchCatalog = vi.mocked(fetchCatalog);

const SAMPLE_APIS: APIItem[] = [
  {
    id: 'weather-sim',
    name: 'WeatherSim API',
    description: 'Simulated weather forecasts',
    category: 'Data',
    provider: { name: 'WeatherCo' },
    pricePerRequest: 0.01,
  },
  {
    id: 'quick-pay',
    name: 'QuickPay API',
    description: 'Instant payments',
    category: 'Payments',
    provider: { name: 'PayCo' },
    pricePerRequest: 0.02,
  },
];

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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="router-path">{location.pathname + location.search}</div>;
}

function PaletteHarness({ initialOpen = false }: { initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" data-testid="opener-btn" onClick={() => setIsOpen(true)}>
        Open Palette
      </button>
      <button type="button" data-testid="toggle-btn" onClick={() => setIsOpen((v) => !v)}>
        Toggle Palette
      </button>
      <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

describe('CommandPalette Component', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.body.innerHTML = '';
    mockedFetchCatalog.mockReset();
    mockedFetchCatalog.mockResolvedValue(SAMPLE_APIS);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderHarness = (initialOpen = false) => {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <LocationProbe />
          <PaletteHarness initialOpen={initialOpen} />
        </MemoryRouter>
      </ThemeProvider>
    );
  };

  it('is closed by default and does not fetch catalog until opened', () => {
    renderHarness(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockedFetchCatalog).not.toHaveBeenCalled();
  });

  it('opens when controlled isOpen is true and fetches catalog', async () => {
    renderHarness(true);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByPlaceholderText('Type a command or API name...')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Jump to WeatherSim API')).toBeTruthy();
    });
    expect(mockedFetchCatalog).toHaveBeenCalledTimes(1);
  });

  it('closes when Esc is pressed', async () => {
    renderHarness(true);
    expect(screen.getByRole('dialog')).toBeTruthy();

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes when backdrop is clicked', async () => {
    renderHarness(true);
    const backdrop = screen.getByRole('presentation');

    act(() => {
      fireEvent.click(backdrop);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('filters commands and live catalog APIs based on search query', async () => {
    renderHarness(true);

    await waitFor(() => {
      expect(screen.getByText('Jump to WeatherSim API')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Type a command or API name...');
    act(() => {
      fireEvent.change(input, { target: { value: 'weather' } });
    });

    expect(screen.getByText('Jump to WeatherSim API')).toBeTruthy();
    expect(screen.queryByText('Go to Dashboard')).toBeNull();
  });

  it('clears search when clear button is clicked', async () => {
    renderHarness(true);

    const input = screen.getByPlaceholderText('Type a command or API name...') as HTMLInputElement;
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
    renderHarness(true);

    // Default selection is 0 (Go to Dashboard)
    // Press ArrowDown to select index 1 (Go to Marketplace)
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowDown' });
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });

    expect(screen.getByTestId('router-path').textContent).toBe('/marketplace');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('executes item action on click', async () => {
    renderHarness(true);

    const item = screen.getByText('Go to Billing');
    act(() => {
      fireEvent.click(item);
    });

    expect(screen.getByTestId('router-path').textContent).toBe('/billing');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('navigates to /details/:id when an API command is chosen and restores focus', async () => {
    renderHarness(false);

    const opener = screen.getByTestId('opener-btn');
    opener.focus();
    expect(document.activeElement).toBe(opener);

    act(() => {
      fireEvent.click(opener);
    });

    await waitFor(() => {
      expect(screen.getByText('Jump to WeatherSim API')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(screen.getByText('Jump to WeatherSim API'));
    });

    expect(screen.getByTestId('router-path').textContent).toBe('/details/weather-sim');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('supports theme toggling actions', async () => {
    renderHarness(true);

    const lightThemeBtn = screen.getByText('Use Light Theme');
    act(() => {
      fireEvent.click(lightThemeBtn);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('traps focus correctly using Tab / Shift+Tab keys', async () => {
    renderHarness(true);

    const input = screen.getByPlaceholderText('Type a command or API name...');
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });

    const closeBtn = screen.getByLabelText('Close palette');

    act(() => {
      closeBtn.focus();
    });
    expect(document.activeElement).toBe(closeBtn);

    act(() => {
      fireEvent.keyDown(window, { key: 'Tab' });
    });
    expect(document.activeElement).toBe(input);

    act(() => {
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('handles empty catalog response while keeping static navigation commands working', async () => {
    mockedFetchCatalog.mockResolvedValue([]);
    renderHarness(true);

    await waitFor(() => {
      expect(mockedFetchCatalog).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/Jump to /)).toBeNull();
    expect(screen.getByText('Go to Dashboard')).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByText('Go to Dashboard'));
    });
    expect(screen.getByTestId('router-path').textContent).toBe('/dashboard');
  });

  it('shows error row when fetchCatalog rejects and keeps static commands working', async () => {
    mockedFetchCatalog.mockRejectedValue(new Error('Network failure'));
    renderHarness(true);

    await waitFor(() => {
      expect(screen.getByText('Could not load APIs')).toBeTruthy();
    });

    expect(screen.getByText('Go to Marketplace')).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByText('Go to Marketplace'));
    });
    expect(screen.getByTestId('router-path').textContent).toBe('/marketplace');
  });

  it('shows loading row while fetchCatalog is pending and aborts on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockedFetchCatalog.mockImplementation((signal) => {
      capturedSignal = signal;
      return new Promise(() => {
        // stays pending
      });
    });

    const { unmount } = renderHarness(true);

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Go to Dashboard')).toBeTruthy();
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('does not refetch on repeated open/close', async () => {
    renderHarness(false);

    const toggleBtn = screen.getByTestId('toggle-btn');

    act(() => {
      fireEvent.click(toggleBtn);
    });
    await waitFor(() => {
      expect(screen.getByText('Jump to WeatherSim API')).toBeTruthy();
    });
    expect(mockedFetchCatalog).toHaveBeenCalledTimes(1);

    // Close
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // Re-open
    act(() => {
      fireEvent.click(toggleBtn);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Jump to WeatherSim API')).toBeTruthy();
    expect(mockedFetchCatalog).toHaveBeenCalledTimes(1);
  });
});
