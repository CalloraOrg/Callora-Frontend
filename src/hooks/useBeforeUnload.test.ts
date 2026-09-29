// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBeforeUnload } from './useBeforeUnload';

describe('useBeforeUnload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers beforeunload listener when hasUnsavedChanges is true', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useBeforeUnload(true));

    expect(addSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });

  it('removes beforeunload listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useBeforeUnload(true));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });

  it('does not register listener when hasUnsavedChanges is false', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useBeforeUnload(false));

    const beforeunloadCalls = addSpy.mock.calls.filter(
      (call) => call[0] === 'beforeunload',
    );
    expect(beforeunloadCalls).toHaveLength(0);
  });

  it('prevents default on beforeunload when hasUnsavedChanges is true', () => {
    const handler = vi.fn();
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (event: string, cb: EventListenerOrEventListenerObject) => {
        if (event === 'beforeunload') {
          handler.mockImplementation(cb);
        }
      },
    );

    renderHook(() => useBeforeUnload(true));

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    Object.defineProperty(event, 'returnValue', {
      value: '',
      writable: true,
    });

    handler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe('');
  });
});
