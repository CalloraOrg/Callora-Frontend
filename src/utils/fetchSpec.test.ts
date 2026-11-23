// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSpecFromUrl, deriveFilename } from './fetchSpec';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Response-like object that streams a body. */
function makeResponse(
  body: string,
  {
    status = 200,
    statusText = 'OK',
    contentType = 'application/json',
    contentLength,
  }: {
    status?: number;
    statusText?: string;
    contentType?: string;
    contentLength?: number;
  } = {},
): Response {
  const headers = new Headers({ 'content-type': contentType });
  if (contentLength !== undefined) {
    headers.set('content-length', String(contentLength));
  }
  return new Response(body, { status, statusText, headers });
}

/** Build a Response whose body ReadableStream delivers chunks with delays. */
function makeSlowResponse(body: string, chunkDelayMs: number): Response {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  let pos = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (pos < bytes.length) {
            controller.enqueue(bytes.slice(pos, pos + 10));
            pos += 10;
          } else {
            controller.close();
          }
          resolve();
        }, chunkDelayMs);
      });
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// deriveFilename
// ---------------------------------------------------------------------------

describe('deriveFilename', () => {
  it('uses .json from the URL path when present', () => {
    const url = new URL('https://example.com/specs/petstore.json');
    expect(deriveFilename(url, null)).toBe('petstore.json');
  });

  it('uses .yaml from the URL path when present', () => {
    const url = new URL('https://example.com/api/openapi.yaml');
    expect(deriveFilename(url, null)).toBe('openapi.yaml');
  });

  it('uses .yml from the URL path when present', () => {
    const url = new URL('https://example.com/api/spec.yml');
    expect(deriveFilename(url, null)).toBe('spec.yml');
  });

  it('falls back to content-type yaml when path has no known extension', () => {
    const url = new URL('https://example.com/api/spec');
    expect(deriveFilename(url, 'application/yaml')).toBe('spec.yaml');
  });

  it('falls back to content-type json when path has no known extension', () => {
    const url = new URL('https://example.com/api/spec');
    expect(deriveFilename(url, 'application/json')).toBe('spec.json');
  });

  it('defaults to spec.json when neither path nor content-type gives a clue', () => {
    const url = new URL('https://example.com/');
    expect(deriveFilename(url, null)).toBe('spec.json');
  });
});

// ---------------------------------------------------------------------------
// Scheme and URL validation
// ---------------------------------------------------------------------------

describe('fetchSpecFromUrl — scheme checks', () => {
  it('rejects a javascript: URL without a network request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchSpecFromUrl('javascript:alert(1)');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/not supported/i);
    }
  });

  it('rejects a file: URL without a network request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchSpecFromUrl('file:///etc/passwd');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/not supported/i);
    }
  });

  it('rejects an http:// URL for a non-localhost host', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchSpecFromUrl('http://example.com/api.json');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/https/i);
    }
  });

  it('allows http://localhost', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse('{"openapi":"3.0.0","paths":{}}')),
    );

    const result = await fetchSpecFromUrl('http://localhost:3000/api.json');
    // Should attempt the fetch (not reject due to scheme)
    expect(result).not.toMatchObject({ kind: 'fetchError' });
  });

  it('allows http://127.0.0.1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse('{"openapi":"3.0.0","paths":{}}')),
    );

    const result = await fetchSpecFromUrl('http://127.0.0.1:8080/spec.json');
    expect(result).not.toMatchObject({ kind: 'fetchError' });
  });

  it('rejects a totally invalid URL', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchSpecFromUrl('not a url at all');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/not a valid URL/i);
    }
  });

  it('rejects a credentialed URL without a network request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchSpecFromUrl('https://user:pass@example.com/api.json');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/credentials/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Successful fetch
// ---------------------------------------------------------------------------

describe('fetchSpecFromUrl — successful fetch', () => {
  it('returns the response text and a derived filename for a JSON URL', async () => {
    const body = '{"openapi":"3.0.0","paths":{}}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(body)));

    const result = await fetchSpecFromUrl('https://example.com/petstore.json');

    expect(result).not.toMatchObject({ kind: 'fetchError' });
    if (result.kind !== 'fetchError') {
      expect(result.text).toBe(body);
      expect(result.filename).toBe('petstore.json');
    }
  });

  it('returns the response text and a derived filename for a YAML URL', async () => {
    const body = 'openapi: 3.0.0\npaths: {}';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse(body, { contentType: 'text/yaml' })),
    );

    const result = await fetchSpecFromUrl('https://example.com/openapi.yaml');

    expect(result).not.toMatchObject({ kind: 'fetchError' });
    if (result.kind !== 'fetchError') {
      expect(result.text).toBe(body);
      expect(result.filename).toBe('openapi.yaml');
    }
  });

  it('derives filename from content-type when the path has no extension', async () => {
    const body = '{"openapi":"3.0.0"}';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse(body, { contentType: 'application/json' })),
    );

    const result = await fetchSpecFromUrl('https://example.com/spec');

    expect(result).not.toMatchObject({ kind: 'fetchError' });
    if (result.kind !== 'fetchError') {
      expect(result.filename).toBe('spec.json');
    }
  });
});

// ---------------------------------------------------------------------------
// Size cap — Content-Length header
// ---------------------------------------------------------------------------

describe('fetchSpecFromUrl — size cap via Content-Length', () => {
  it('rejects when Content-Length exceeds the limit without reading the body', async () => {
    const tooLarge = 3 * 1024 * 1024; // 3 MiB > default 2 MiB

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse('x', { contentLength: tooLarge }),
      ),
    );

    const result = await fetchSpecFromUrl('https://example.com/huge.json');

    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/too large/i);
    }
  });

  it('allows when Content-Length is within the limit', async () => {
    const body = '{"openapi":"3.0.0","paths":{}}';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse(body, { contentLength: body.length })),
    );

    const result = await fetchSpecFromUrl('https://example.com/api.json');
    expect(result).not.toMatchObject({ kind: 'fetchError' });
  });

  it('respects a custom maxBytes limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse('x', { contentLength: 200 })),
    );

    const result = await fetchSpecFromUrl('https://example.com/api.json', {
      maxBytes: 100,
    });

    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/too large/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Size cap — streamed body
// ---------------------------------------------------------------------------

describe('fetchSpecFromUrl — size cap via streamed body', () => {
  it('rejects when the streamed body exceeds the limit', async () => {
    const bigBody = 'x'.repeat(3 * 1024 * 1024); // 3 MiB

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(bigBody)));

    const result = await fetchSpecFromUrl('https://example.com/api.json');

    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/too large/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('fetchSpecFromUrl — timeout', () => {
  it('returns a timeout error when the request exceeds timeoutMs', async () => {
    vi.useRealTimers();

    // fetch blocks until the AbortSignal fires (simulating a very slow server).
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            const signal = init?.signal as AbortSignal | undefined;
            if (signal) {
              signal.addEventListener('abort', () =>
                reject(new DOMException('The operation was aborted.', 'AbortError')),
              );
            }
          }),
      ),
    );

    const result = await fetchSpecFromUrl('https://example.com/api.json', {
      timeoutMs: 50, // 50 ms — fast enough for unit tests
    });

    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/timed out/i);
    }

    vi.useFakeTimers();
  }, 10_000);
});

// ---------------------------------------------------------------------------
// HTTP errors
// ---------------------------------------------------------------------------

describe('fetchSpecFromUrl — HTTP errors', () => {
  it('returns an error for a 404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse('Not Found', { status: 404, statusText: 'Not Found' })),
    );

    const result = await fetchSpecFromUrl('https://example.com/missing.json');

    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/404/);
    }
  });

  it('returns an error for a 500 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
      ),
    );

    const result = await fetchSpecFromUrl('https://example.com/api.json');

    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/500/);
    }
  });
});

// ---------------------------------------------------------------------------
// TypeError → CORS/network hint
// ---------------------------------------------------------------------------

describe('fetchSpecFromUrl — CORS / network failures', () => {
  it('returns the CORS guidance message when fetch throws a TypeError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const result = await fetchSpecFromUrl('https://example.com/api.json');

    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/cross-origin/i);
      expect(result.errors[0].message).toMatch(/download the file/i);
    }
  });
});

// ---------------------------------------------------------------------------
// AbortController cancellation
// ---------------------------------------------------------------------------

describe('fetchSpecFromUrl — cancellation', () => {
  it('returns a cancellation error when the caller aborts', async () => {
    vi.useRealTimers(); // AbortController needs real event loop for this test
    const controller = new AbortController();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((_, reject) => {
            controller.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );

    const promise = fetchSpecFromUrl('https://example.com/api.json', {
      signal: controller.signal,
    });

    controller.abort();
    const result = await promise;

    expect(result).toMatchObject({ kind: 'fetchError' });
    if (result.kind === 'fetchError') {
      expect(result.errors[0].message).toMatch(/cancel/i);
    }

    vi.useFakeTimers();
  });
});
