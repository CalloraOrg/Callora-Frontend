import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGlobalShortcuts } from './useGlobalShortcuts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dispatch a keydown event on window and return the event object. */
function fireKeyDown(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  window.dispatchEvent(event);
  return event;
}

/**
 * Focus an element by inserting it into the document body, focusing it,
 * and returning a cleanup function that removes the element afterwards.
 */
function focusElement(element: HTMLElement): () => void {
  document.body.appendChild(element);
  element.focus();
  return () => element.remove();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGlobalShortcuts', () => {
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handler = vi.fn();
    // Ensure no stale focused element bleeds across tests.
    (document.activeElement as HTMLElement | null)?.blur?.();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC1: Handler fires when body has focus
  // -------------------------------------------------------------------------
  it('calls the handler when document.body has focus', () => {
    document.body.focus();

    const { unmount } = renderHook(() => useGlobalShortcuts(handler));

    fireKeyDown('?');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.any(KeyboardEvent));

    unmount();
  });

  // -------------------------------------------------------------------------
  // AC2: Handler is skipped when an <input> is focused
  // -------------------------------------------------------------------------
  it('does NOT call the handler when an <input> is focused', () => {
    const input = document.createElement('input');
    const cleanup = focusElement(input);

    const { unmount } = renderHook(() => useGlobalShortcuts(handler));

    // Typing '?' into a search box must not trigger the shortcuts modal.
    fireKeyDown('?');
    fireKeyDown('g');

    expect(handler).not.toHaveBeenCalled();

    unmount();
    cleanup();
  });

  // -------------------------------------------------------------------------
  // AC2 (textarea): Handler is skipped when a <textarea> is focused
  // -------------------------------------------------------------------------
  it('does NOT call the handler when a <textarea> is focused', () => {
    const textarea = document.createElement('textarea');
    const cleanup = focusElement(textarea);

    const { unmount } = renderHook(() => useGlobalShortcuts(handler));

    fireKeyDown('?');
    fireKeyDown('g');

    expect(handler).not.toHaveBeenCalled();

    unmount();
    cleanup();
  });

  // -------------------------------------------------------------------------
  // AC2 (select): Handler is skipped when a <select> is focused
  // -------------------------------------------------------------------------
  it('does NOT call the handler when a <select> is focused', () => {
    const select = document.createElement('select');
    const cleanup = focusElement(select);

    const { unmount } = renderHook(() => useGlobalShortcuts(handler));

    fireKeyDown('?');

    expect(handler).not.toHaveBeenCalled();

    unmount();
    cleanup();
  });

  // -------------------------------------------------------------------------
  // AC3: Handler is skipped when a contentEditable element is focused
  //
  // jsdom does not implement the `isContentEditable` computed property
  // (it always returns undefined). We therefore stub `document.activeElement`
  // to return a fake element whose `isContentEditable` is `true`, which is
  // exactly what `useGlobalShortcuts` reads to make its guard decision.
  // -------------------------------------------------------------------------
  it('does NOT call the handler when a contentEditable element is focused', () => {
    const fakeContentEditable = {
      tagName: 'DIV',
      isContentEditable: true,
    } as unknown as Element;

    const spy = vi
      .spyOn(document, 'activeElement', 'get')
      .mockReturnValue(fakeContentEditable);

    const { unmount } = renderHook(() => useGlobalShortcuts(handler));

    fireKeyDown('?');
    fireKeyDown('g');

    expect(handler).not.toHaveBeenCalled();

    unmount();
    spy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // AC4: The listener is removed on unmount (no handler calls after unmount)
  // -------------------------------------------------------------------------
  it('removes the keydown listener when the hook is unmounted', () => {
    document.body.focus();

    const { unmount } = renderHook(() => useGlobalShortcuts(handler));

    // Verify it works before unmount.
    fireKeyDown('?');
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    handler.mockClear();

    // After unmount, further keydowns must not reach the handler.
    fireKeyDown('?');
    fireKeyDown('g');

    expect(handler).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Extra: handler fires for non-editable, non-body element (e.g. a button)
  // -------------------------------------------------------------------------
  it('calls the handler when a non-editable element (button) has focus', () => {
    const button = document.createElement('button');
    const cleanup = focusElement(button);

    const { unmount } = renderHook(() => useGlobalShortcuts(handler));

    fireKeyDown('?');

    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    cleanup();
  });
});
