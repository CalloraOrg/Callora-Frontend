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
});
