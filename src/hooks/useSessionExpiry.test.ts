// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionExpiry } from './useSessionExpiry';

const ACTIVITY_KEY = 'callora:session:lastActivity';
const EXPIRY_KEY = 'callora:session:expired';

describe('useSessionExpiry', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // Reset activity to now
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with isExpired = false', () => {
    const { result } = renderHook(() => useSessionExpiry());
    expect(result.current.isExpired).toBe(false);
  });

  it('sets isExpired to true when timeout elapses', () => {
    const { result } = renderHook(() =>
      useSessionExpiry({ timeoutMs: 5000 }),
    );

    // Set activity to 6 seconds ago
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 6000));

    act(() => {
      vi.advanceTimersByTime(10000); // Advance past check interval
    });

    expect(result.current.isExpired).toBe(true);
  });

  it('does not expire before timeout', () => {
    const { result } = renderHook(() =>
      useSessionExpiry({ timeoutMs: 10000 }),
    );

    act(() => {
      vi.advanceTimersByTime(5000); // 5s < 10s timeout
    });

    expect(result.current.isExpired).toBe(false);
  });

  it('signalExpiry immediately sets isExpired to true', () => {
    const { result } = renderHook(() =>
      useSessionExpiry({ timeoutMs: 60000 }),
    );

    act(() => {
      result.current.signalExpiry();
    });

    expect(result.current.isExpired).toBe(true);
  });

  it('signalExpiry broadcasts to localStorage for cross-tab sync', () => {
    const { result } = renderHook(() =>
      useSessionExpiry({ timeoutMs: 60000 }),
    );

    act(() => {
      result.current.signalExpiry();
    });

    expect(localStorage.getItem(EXPIRY_KEY)).toBeTruthy();
  });

  it('dismiss resets isExpired and updates activity timestamp', () => {
    // Set activity far in the past so it expires immediately
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 60000));

    const { result } = renderHook(() =>
      useSessionExpiry({ timeoutMs: 5000 }),
    );

    // Trigger expiry
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(result.current.isExpired).toBe(true);

    // Dismiss
    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isExpired).toBe(false);
  });

  it('responds to cross-tab storage events', () => {
    const { result } = renderHook(() =>
      useSessionExpiry({ timeoutMs: 60000 }),
    );

    expect(result.current.isExpired).toBe(false);

    // Simulate cross-tab expiry broadcast
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: EXPIRY_KEY,
          newValue: String(Date.now()),
        }),
      );
    });

    expect(result.current.isExpired).toBe(true);
  });

  it('does not respond to cross-tab events when crossTabSync is false', () => {
    const { result } = renderHook(() =>
      useSessionExpiry({ timeoutMs: 60000, crossTabSync: false }),
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: EXPIRY_KEY,
          newValue: String(Date.now()),
        }),
      );
    });

    expect(result.current.isExpired).toBe(false);
  });

  it('countdown starts when redirectOnExpiry is true', () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 60000));

    const { result } = renderHook(() =>
      useSessionExpiry({
        timeoutMs: 5000,
        redirectOnExpiry: true,
        redirectDelayMs: 5000,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(result.current.isExpired).toBe(true);
    expect(result.current.countdown).toBe(5);
  });

  it('countdown decrements over time', () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 60000));

    const { result } = renderHook(() =>
      useSessionExpiry({
        timeoutMs: 5000,
        redirectOnExpiry: true,
        redirectDelayMs: 5000,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(result.current.countdown).toBe(5);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.countdown).toBe(3);
  });
});
