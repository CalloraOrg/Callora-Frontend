// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import CompareDrawer from './CompareDrawer';
import { compareStore } from '../state/compareStore';

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

describe('CompareDrawer Component', () => {
  beforeEach(() => {
    localStorageMock.clear();
    compareStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const sampleApi = {
    id: 'api-1',
    name: 'Test API',
    pricePerCall: 0.01,
    avgLatencyMs: 45,
    uptimePercent: 99.9,
    rating: 4.8,
    ratingDistribution: { 5: 80, 4: 20, 3: 0, 2: 0, 1: 0 },
  };

  it('renders nothing when isOpen is false', () => {
    render(<CompareDrawer />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders correctly when isOpen is true with items and empty state', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    const { rerender } = render(<CompareDrawer />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Test API')).toBeTruthy();
    expect(screen.getByText('Price / call')).toBeTruthy();

    // Test empty state
    act(() => {
      compareStore.clear();
      compareStore.setOpen(true);
    });
    rerender(<CompareDrawer />);
    expect(screen.getByText('Select APIs to compare them.')).toBeTruthy();
  });

  it('announces removal and clears announcement after 3 seconds', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    render(<CompareDrawer />);

    const removeBtn = screen.getByLabelText('Remove Test API from comparison');
    act(() => {
      fireEvent.click(removeBtn);
    });

    const liveRegion = screen.getByText('Removed Test API from comparison.');
    expect(liveRegion).toBeTruthy();

    // Advance timers by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Removed Test API from comparison.')).toBeNull();
  });

  it('clears all items and announces it', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    render(<CompareDrawer />);

    const clearBtn = screen.getByLabelText('Clear all comparisons');
    act(() => {
      fireEvent.click(clearBtn);
    });

    expect(screen.getByText('Cleared all comparison items.')).toBeTruthy();
    expect(compareStore.getSnapshot().apis.length).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Cleared all comparison items.')).toBeNull();
  });

  it('closes on Escape key press', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    render(<CompareDrawer />);
    expect(screen.getByRole('dialog')).toBeTruthy();

    act(() => {
      fireEvent.keydown(document, { key: 'Escape' });
    });

    expect(compareStore.getSnapshot().isOpen).toBe(false);
  });

  it('closes on backdrop click', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    render(<CompareDrawer />);
    const overlay = document.querySelector('.compare-drawer-overlay');
    expect(overlay).toBeTruthy();

    act(() => {
      fireEvent.click(overlay!);
    });

    expect(compareStore.getSnapshot().isOpen).toBe(false);
  });
});
