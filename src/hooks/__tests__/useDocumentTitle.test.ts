// src/hooks/__tests__/useDocumentTitle.test.ts
import { renderHook } from '@testing-library/react';
import useDocumentTitle from '../../hooks/useDocumentTitle';

describe('useDocumentTitle', () => {
  const originalTitle = document.title;
  const originalMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;

  afterEach(() => {
    // Restore original title and description after each test
    document.title = originalTitle;
    if (originalMeta) {
      const content = originalMeta.getAttribute('content') ?? '';
      originalMeta.setAttribute('content', content);
    } else {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.remove();
    }
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.remove();
  });

  test('sets provided title and description', () => {
    const title = 'Test Page';
    const description = 'Test description';
    const { unmount } = renderHook(() => useDocumentTitle(title, description));
    expect(document.title).toBe(title);
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(meta).toBeTruthy();
    expect(meta.getAttribute('content')).toBe(description);
    unmount();
    // After unmount, title and description should be restored
    expect(document.title).toBe(originalTitle);
    if (originalMeta) {
      expect(meta.getAttribute('content')).toBe(originalMeta.getAttribute('content'));
    }
  });

  test('falls back to Callora when title is undefined', () => {
    const { unmount } = renderHook(() => useDocumentTitle(undefined));
    expect(document.title).toBe('Callora');
    unmount();
    expect(document.title).toBe(originalTitle);
  });

  test('adds robots meta when noindex is true and removes it on unmount', () => {
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    const { unmount } = renderHook(() =>
      useDocumentTitle('Billing – Callora', undefined, { noindex: true }),
    );
    const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    expect(robots).toBeTruthy();
    expect(robots?.getAttribute('content')).toBe('noindex, nofollow');

    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  test('restores an existing robots meta tag on unmount', () => {
    const existing = document.createElement('meta');
    existing.name = 'robots';
    existing.content = 'index, follow';
    document.head.appendChild(existing);

    const { unmount } = renderHook(() =>
      useDocumentTitle('Billing – Callora', undefined, { noindex: true }),
    );
    expect(existing.getAttribute('content')).toBe('noindex, nofollow');

    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBe(existing);
    expect(existing.getAttribute('content')).toBe('index, follow');
  });

  test('leaves head untouched when noindex option is absent', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Marketplace – Callora'));
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });
});
