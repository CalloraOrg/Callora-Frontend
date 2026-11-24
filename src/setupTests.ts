import "@testing-library/jest-dom";
import { expect, vi } from "vitest";
import { vi, beforeAll, afterEach, afterAll } from "vitest";
import type { Mock } from "vitest";
import { toHaveNoViolations } from "vitest-axe/dist/matchers";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

expect.extend({ toHaveNoViolations });
import { server } from "./mocks/server";
import { resetQuotaStore, mockConfig } from "./mocks/handlers";

// Establish API mocking before all tests.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });

  // Node 24+ / JSDOM cross-realm AbortSignal compatibility shim for MSW / undici fetch
  const nativeFetch = globalThis.fetch;
  const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      return await nativeFetch(input, init);
    } catch (err) {
      if (
        err instanceof TypeError &&
        err.message.includes("AbortSignal") &&
        init?.signal
      ) {
        if (init.signal.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        const { signal: _omittedSignal, ...restInit } = init;
        return await nativeFetch(input, restInit);
      }
      throw err;
    }
  };
  globalThis.fetch = wrappedFetch;
  if (typeof window !== "undefined") {
    window.fetch = wrappedFetch;
  }
});

// Reset any runtime request handlers and mock state after each test.
afterEach(() => {
  server.resetHandlers();
  resetQuotaStore();
  mockConfig.reset();
});

// Clean up once all tests are finished.
afterAll(() => {
  server.close();
});

// Only install browser-global mocks when a DOM is present. Under the `node`
// environment (e.g. pure-logic/contrast tests) these globals do not exist.
if (typeof window !== "undefined") {
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
  })) as unknown as Mock;

  Object.defineProperty(window, "IntersectionObserver", {
    value: mockIntersectionObserver,
    writable: true,
    configurable: true,
  });
}
