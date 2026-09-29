import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PUBLISH_API_PATH,
  extractFieldErrors,
  submitPublishApi,
  type PublishApiInput,
} from './publishApi';
import { getSessionExpiry, resetSessionExpiryForTests } from './sessionExpiry';
import { API_BASE_URL } from '../config/constants';

const INPUT: PublishApiInput = {
  apiName: 'Weather Forecast API',
  baseUrl: 'https://api.example.com',
  category: 'Weather & Environment',
  description: 'Forecasts for the next 7 days.',
  pricePerCall: 0.001,
  endpoints: [{ path: '/forecast', method: 'GET', summary: 'Get a forecast' }],
};

/** Minimal Response stand-in — jsdom does not ship a fetch implementation. */
function jsonResponse(status: number, body: unknown = undefined): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  } as unknown as Response;
}

function textResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  } as unknown as Response;
}

beforeEach(() => {
  resetSessionExpiryForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSessionExpiryForTests();
});

describe('extractFieldErrors', () => {
  it('reads an object map under `errors`', () => {
    expect(extractFieldErrors({ errors: { apiName: 'Already taken' } })).toEqual({
      apiName: 'Already taken',
    });
  });

  it('reads an object map under `fieldErrors`', () => {
    expect(extractFieldErrors({ fieldErrors: { baseUrl: 'Unreachable' } })).toEqual({
      baseUrl: 'Unreachable',
    });
  });

  it('reads an array of { field, message }', () => {
    expect(
      extractFieldErrors({ errors: [{ field: 'category', message: 'Unknown category' }] }),
    ).toEqual({ category: 'Unknown category' });
  });

  it('merges both shapes when a body carries both', () => {
    expect(
      extractFieldErrors({ errors: { a: 'one' }, fieldErrors: { b: 'two' } }),
    ).toEqual({ a: 'one', b: 'two' });
  });

  it('ignores non-string and empty messages', () => {
    expect(
      extractFieldErrors({
        errors: {
          apiName: '   ',
          baseUrl: 42,
          category: null,
          pricePerCall: { nested: 'object' },
        },
      }),
    ).toEqual({});
  });

  it('ignores entries with a blank field name', () => {
    expect(extractFieldErrors({ errors: [{ field: '', message: 'nope' }] })).toEqual({});
  });

  it('returns an empty object for non-object bodies', () => {
    expect(extractFieldErrors(null)).toEqual({});
    expect(extractFieldErrors('boom')).toEqual({});
    expect(extractFieldErrors(undefined)).toEqual({});
  });

  it('returns an empty object when the body has no error container', () => {
    expect(extractFieldErrors({ message: 'Bad request' })).toEqual({});
  });
});

describe('submitPublishApi', () => {
  it('POSTs the payload to the publish endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_123' }));

    await submitPublishApi(INPUT, { fetchImpl, idempotencyKey: 'key-1' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}${PUBLISH_API_PATH}`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(INPUT);
  });

  it('sends the Idempotency-Key header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_123' }));

    await submitPublishApi(INPUT, { fetchImpl, idempotencyKey: 'key-abc' });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBe('key-abc');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('generates its own idempotency key when none is supplied', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_123' }));

    await submitPublishApi(INPUT, { fetchImpl });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('issues exactly one request per call', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_123' }));

    await submitPublishApi(INPUT, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('passes an abort signal through to fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_123' }));

    await submitPublishApi(INPUT, { fetchImpl });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('honours a url override', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, {}));

    await submitPublishApi(INPUT, { fetchImpl, url: 'https://staging.callora.com/v1/apis' });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://staging.callora.com/v1/apis');
  });

  describe('success', () => {
    it('reports success with the listing id on 201', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_123' }));
      await expect(submitPublishApi(INPUT, { fetchImpl })).resolves.toEqual({
        kind: 'success',
        listingId: 'api_123',
      });
    });

    it('accepts a 200 with a nested listing id', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { api: { id: 'api_9' } }));
      await expect(submitPublishApi(INPUT, { fetchImpl })).resolves.toEqual({
        kind: 'success',
        listingId: 'api_9',
      });
    });

    it('accepts a 204 with no body', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(204));
      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result.kind).toBe('success');
      expect(result.kind === 'success' && result.listingId).toBeUndefined();
    });

    it('accepts a 200 whose body is not JSON', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(textResponse(200));
      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result.kind).toBe('success');
    });
  });

  describe('401', () => {
    it('reports unauthorized without throwing', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Token expired' }));
      await expect(submitPublishApi(INPUT, { fetchImpl })).resolves.toEqual({
        kind: 'unauthorized',
      });
    });

    it('raises the session-expiry signal', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, {}));

      await submitPublishApi(INPUT, { fetchImpl });

      expect(getSessionExpiry()?.reason).toBe('unauthorized');
    });

    it('treats 419 as an expired session too', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(419, {}));

      await expect(submitPublishApi(INPUT, { fetchImpl })).resolves.toEqual({
        kind: 'unauthorized',
      });
      expect(getSessionExpiry()?.reason).toBe('unauthorized');
    });

    it('does not leak the server message as a field error', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse(401, { errors: { apiName: 'nope' } }),
      );
      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result.kind).toBe('unauthorized');
    });
  });

  describe('field errors', () => {
    it('maps a 422 field error', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(422, { errors: { apiName: 'That name is taken.' } }));

      await expect(submitPublishApi(INPUT, { fetchImpl })).resolves.toEqual({
        kind: 'fieldErrors',
        fields: { apiName: 'That name is taken.' },
      });
    });

    it('maps a 409 duplicate-name conflict', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(409, { errors: { apiName: 'Already published.' } }));

      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result).toEqual({ kind: 'fieldErrors', fields: { apiName: 'Already published.' } });
    });

    it('maps an unreachable base URL from a 400', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(400, { errors: { baseUrl: 'Base URL is unreachable.' } }));

      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result.kind === 'fieldErrors' && result.fields.baseUrl).toBe('Base URL is unreachable.');
    });

    it('does not raise a session signal for a 422', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422, { errors: { apiName: 'x' } }));

      await submitPublishApi(INPUT, { fetchImpl });

      expect(getSessionExpiry()).toBeNull();
    });
  });

  describe('other 4xx', () => {
    it('falls back to a generic message when the body carries no fields', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, {}));
      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result).toEqual({
        kind: 'error',
        message: 'The server rejected this listing. Please review the details and try again.',
        retryable: false,
      });
    });

    it('surfaces the server message when present', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(403, { message: 'Publishing is restricted.' }));
      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result).toEqual({
        kind: 'error',
        message: 'Publishing is restricted.',
        retryable: false,
      });
    });

    it('marks 429 as retryable', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(429, {}));
      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result.kind === 'error' && result.retryable).toBe(true);
    });

    it('copes with a non-JSON error body', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(textResponse(400));
      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result.kind).toBe('error');
    });
  });

  describe('5xx', () => {
    it('reports a retryable error', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result).toEqual({
        kind: 'error',
        message:
          'The Callora API is unavailable right now. Your draft is saved — please try again.',
        retryable: true,
      });
    });

    it('surfaces a 503 message from the server', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(503, { message: 'Upstream unavailable' }));
      const result = await submitPublishApi(INPUT, { fetchImpl });
      expect(result.kind === 'error' && result.message).toBe('Upstream unavailable');
    });
  });

  describe('transport failures', () => {
    it('reports a network error when fetch rejects', async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(submitPublishApi(INPUT, { fetchImpl })).resolves.toEqual({
        kind: 'error',
        message: 'Network error. Check your connection and try again.',
        retryable: true,
      });
    });

    it('reports a timeout distinctly from a network error', async () => {
      const fetchImpl = vi.fn().mockImplementation(
        (url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );

      const result = await submitPublishApi(INPUT, { fetchImpl, timeoutMs: 10 });

      expect(result).toEqual({
        kind: 'error',
        message: 'The request timed out. Your draft is saved — please try again.',
        retryable: true,
      });
    });

    it('aborts the in-flight request when the budget elapses', async () => {
      let captured: AbortSignal | null = null;
      const fetchImpl = vi.fn().mockImplementation(
        (url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            captured = init.signal as AbortSignal;
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );

      await submitPublishApi(INPUT, { fetchImpl, timeoutMs: 10 });

      expect(captured!.aborted).toBe(true);
    });

    it('degrades gracefully when fetch is unavailable entirely', async () => {
      const result = await submitPublishApi(INPUT, { fetchImpl: undefined as unknown as typeof fetch });
      expect(result.kind).toBe('error');
      expect(result.kind === 'error' && result.retryable).toBe(true);
    });
  });
});
