import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock matchMedia for components that use it (e.g., Tabs)
// Use Object.defineProperty to properly set it on window
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock localStorage globally for tests in jsdom/node contexts
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => {
      const k = String(key);
      return store[k] !== undefined ? store[k] : null;
    },
    setItem: (key: string, value: string) => {
      const k = String(key);
      store[k] = String(value);
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      const k = String(key);
      delete store[k];
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock IntersectionObserver for components that use it (e.g., ThemeToggle sticky bar)
const mockIntersectionObserver = vi.fn().mockImplementation((callback: IntersectionObserverCallback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  trigger: (entries: IntersectionObserverEntry[]) => callback(entries, {} as IntersectionObserver),
}));

Object.defineProperty(window, "IntersectionObserver", {
  value: mockIntersectionObserver,
  writable: true,
  configurable: true,
});

// Mock scrollIntoView for jsdom (used by EndpointSearch)
Element.prototype.scrollIntoView = vi.fn();

