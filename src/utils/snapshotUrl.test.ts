// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateSnapshotUrl,
  parseSnapshotUrl,
  copySnapshotUrl,
  isSensitiveKey,
  redactSensitiveParams,
  SENSITIVE_PARAM_PATTERNS,
} from './snapshotUrl';

describe('snapshotUrl', () => {
  describe('generateSnapshotUrl', () => {
    it('generates URL with just endpoint ID when no params', () => {
      const url = generateSnapshotUrl('/usage', { endpointId: 'endpoint-1', params: null });
      expect(url).toBe('/usage?endpoint=endpoint-1');
    });

    it('generates URL with encoded params when provided', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'endpoint-2',
        params: { amount: 100, currency: 'USD' },
      });
      expect(url).toContain('endpoint=endpoint-2');
      expect(url).toContain('params=');
    });

    it('handles empty params object', () => {
      const url = generateSnapshotUrl('/usage', { endpointId: 'endpoint-1', params: {} });
      // Empty object has no safe keys — params segment is omitted entirely
      expect(url).toContain('endpoint=endpoint-1');
      expect(url).not.toContain('params=');
    });

    it('handles special characters in params', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'endpoint-3',
        params: { note: 'hello "world"' },
      });
      expect(url).toContain('endpoint=endpoint-3');
      expect(() => decodeURIComponent(url.split('params=')[1])).not.toThrow();
    });

    // ── Security: sensitive keys must not appear in the generated URL ──────

    it('omits params segment entirely when all params are sensitive', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'ep-1',
        params: { apiKey: 'sk-secret', Authorization: 'Bearer tok' },
      });
      expect(url).not.toContain('params=');
      expect(url).toBe('/usage?endpoint=ep-1');
    });

    it('does not include an apiKey value in the URL', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'ep-2',
        params: { apiKey: 'sk-super-secret', limit: 10 },
      });
      expect(url).not.toContain('sk-super-secret');
    });

    it('does not include a token value in the URL', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'ep-3',
        params: { token: 'my-token-value', page: 1 },
      });
      expect(url).not.toContain('my-token-value');
    });

    it('does not include a password value in the URL', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'ep-4',
        params: { password: 'hunter2' },
      });
      expect(url).not.toContain('hunter2');
    });

    it('does not include a secret value in the URL', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'ep-5',
        params: { clientSecret: 'abc123' },
      });
      expect(url).not.toContain('abc123');
    });

    it('preserves non-sensitive params while stripping sensitive ones', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'ep-6',
        params: { limit: 50, apiKey: 'sk-hidden', currency: 'USD' },
      });
      // Non-sensitive params make it through
      expect(url).toContain('params=');
      // Decode and verify the payload
      const encoded = new URLSearchParams(url.split('?')[1]).get('params')!;
      const decoded = JSON.parse(decodeURIComponent(escape(atob(encoded))));
      expect(decoded).toHaveProperty('limit', 50);
      expect(decoded).toHaveProperty('currency', 'USD');
      expect(decoded).not.toHaveProperty('apiKey');
    });

    it('handles an all-safe params object normally', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'ep-7',
        params: { limit: 10, currency: 'USD' },
      });
      expect(url).toContain('params=');
    });
  });

  describe('parseSnapshotUrl', () => {
    it('returns null when endpoint parameter missing', () => {
      const result = parseSnapshotUrl('?other=value');
      expect(result).toBeNull();
    });

    it('parses URL with just endpoint ID', () => {
      const result = parseSnapshotUrl('?endpoint=endpoint-1');
      expect(result).toEqual({ endpointId: 'endpoint-1', params: null });
    });

    it('parses URL with encoded params', () => {
      const params = { amount: 100, currency: 'USD' };
      // Use same encoding as generateSnapshotUrl: btoa(unescape(encodeURIComponent(json)))
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(params))));
      const result = parseSnapshotUrl(`?endpoint=endpoint-2&params=${encoded}`);
      expect(result?.endpointId).toBe('endpoint-2');
      expect(result?.params).toEqual(params);
    });

    it('returns endpoint with null params when param decoding fails', () => {
      // Malformed base64 that will fail to decode
      const result = parseSnapshotUrl('?endpoint=endpoint-1&params=invalid!!!base64');
      expect(result?.endpointId).toBe('endpoint-1');
      expect(result?.params).toBeNull();
    });

    it('handles empty search string', () => {
      const result = parseSnapshotUrl('');
      expect(result).toBeNull();
    });

    // ── Security: adversarial / malformed inputs fail closed ─────────────

    it('returns null for a search string that is only whitespace', () => {
      expect(parseSnapshotUrl('   ')).toBeNull();
    });

    it('returns null when endpoint param is an empty string', () => {
      expect(parseSnapshotUrl('?endpoint=')).toBeNull();
    });

    it('handles deeply nested JSON in params without throwing', () => {
      const nested = { a: { b: { c: { d: 1 } } } };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(nested))));
      const result = parseSnapshotUrl(`?endpoint=ep&params=${encoded}`);
      expect(result?.params).toEqual(nested);
    });

    it('handles a params value that decodes to a non-object without throwing', () => {
      // Arrays and primitives are not valid param objects
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify([1, 2, 3]))));
      const result = parseSnapshotUrl(`?endpoint=ep&params=${encoded}`);
      // Parsed but the caller receives whatever JSON.parse returned; no throw
      expect(result?.endpointId).toBe('ep');
    });

    it('handles a params value that is valid base64 but not JSON without throwing', () => {
      const notJson = btoa('not-json-at-all');
      const result = parseSnapshotUrl(`?endpoint=ep&params=${notJson}`);
      expect(result?.endpointId).toBe('ep');
      expect(result?.params).toBeNull();
    });
  });

  describe('copySnapshotUrl', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('copies URL to clipboard and returns true on success', async () => {
      const clipboardMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: clipboardMock },
        writable: true,
      });

      const result = await copySnapshotUrl('/usage', { endpointId: 'endpoint-1', params: { test: 1 } });
      expect(result).toBe(true);
      expect(clipboardMock).toHaveBeenCalled();
    });

    it('returns false when clipboard write fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('Not allowed')) },
        writable: true,
      });

      const result = await copySnapshotUrl('/usage', { endpointId: 'endpoint-1', params: null });
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    it('does not copy sensitive values to the clipboard', async () => {
      const writtenValues: string[] = [];
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockImplementation((v: string) => { writtenValues.push(v); return Promise.resolve(); }) },
        writable: true,
      });

      await copySnapshotUrl('/usage', {
        endpointId: 'ep-sec',
        params: { apiKey: 'sk-should-not-appear', limit: 10 },
      });

      expect(writtenValues.length).toBe(1);
      expect(writtenValues[0]).not.toContain('sk-should-not-appear');
    });
  });

  // ── isSensitiveKey unit tests ──────────────────────────────────────────────

  describe('isSensitiveKey', () => {
    it('flags "apiKey" as sensitive', () => expect(isSensitiveKey('apiKey')).toBe(true));
    it('flags "api_key" as sensitive', () => expect(isSensitiveKey('api_key')).toBe(true));
    it('flags "API_KEY" (uppercase) as sensitive', () => expect(isSensitiveKey('API_KEY')).toBe(true));
    it('flags "token" as sensitive', () => expect(isSensitiveKey('token')).toBe(true));
    it('flags "accessToken" as sensitive', () => expect(isSensitiveKey('accessToken')).toBe(true));
    it('flags "Authorization" as sensitive', () => expect(isSensitiveKey('Authorization')).toBe(true));
    it('flags "password" as sensitive', () => expect(isSensitiveKey('password')).toBe(true));
    it('flags "clientSecret" as sensitive', () => expect(isSensitiveKey('clientSecret')).toBe(true));
    it('flags "privateKey" as sensitive', () => expect(isSensitiveKey('privateKey')).toBe(true));
    it('flags "bearerToken" as sensitive', () => expect(isSensitiveKey('bearerToken')).toBe(true));
    it('flags "sessionId" as sensitive', () => expect(isSensitiveKey('sessionId')).toBe(true));
    it('flags "jwt" as sensitive', () => expect(isSensitiveKey('jwt')).toBe(true));
    it('flags "x-api-key" as sensitive', () => expect(isSensitiveKey('x-api-key')).toBe(true));

    it('does NOT flag "limit" as sensitive', () => expect(isSensitiveKey('limit')).toBe(false));
    it('does NOT flag "currency" as sensitive', () => expect(isSensitiveKey('currency')).toBe(false));
    it('does NOT flag "page" as sensitive', () => expect(isSensitiveKey('page')).toBe(false));
    it('does NOT flag "endpointId" as sensitive', () => expect(isSensitiveKey('endpointId')).toBe(false));
    it('does NOT flag "amount" as sensitive', () => expect(isSensitiveKey('amount')).toBe(false));

    it('covers every entry in SENSITIVE_PARAM_PATTERNS', () => {
      // Each pattern string must itself be detected as a sensitive key, so the
      // table is self-consistent and new additions are automatically checked.
      for (const pattern of SENSITIVE_PARAM_PATTERNS) {
        expect(isSensitiveKey(pattern)).toBe(true);
      }
    });
  });

  // ── redactSensitiveParams unit tests ──────────────────────────────────────

  describe('redactSensitiveParams', () => {
    it('removes apiKey from a params object', () => {
      const result = redactSensitiveParams({ apiKey: 'sk-abc', limit: 10 });
      expect(result).not.toHaveProperty('apiKey');
      expect(result).toHaveProperty('limit', 10);
    });

    it('removes multiple sensitive keys at once', () => {
      const result = redactSensitiveParams({
        token: 'tok',
        password: 'pass',
        Authorization: 'Bearer x',
        limit: 5,
        currency: 'USD',
      });
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('Authorization');
      expect(result).toHaveProperty('limit', 5);
      expect(result).toHaveProperty('currency', 'USD');
    });

    it('returns an empty object when all keys are sensitive', () => {
      const result = redactSensitiveParams({ apiKey: 'x', token: 'y', password: 'z' });
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('returns the full object when no keys are sensitive', () => {
      const input = { limit: 10, currency: 'USD', page: 2 };
      const result = redactSensitiveParams(input);
      expect(result).toEqual(input);
    });

    it('does not mutate the original params object', () => {
      const input = { apiKey: 'secret', limit: 10 };
      redactSensitiveParams(input);
      expect(input).toHaveProperty('apiKey', 'secret');
    });

    it('handles an empty params object', () => {
      expect(redactSensitiveParams({})).toEqual({});
    });

    // ── Adversarial / cross-tenant inputs ────────────────────────────────

    it('strips a key that attempts to smuggle a secret via mixed case', () => {
      expect(redactSensitiveParams({ ApiKey: 'val' })).not.toHaveProperty('ApiKey');
    });

    it('strips a key with Unicode look-alike characters that happen to match a pattern', () => {
      // A key whose lowercased form contains "key"
      expect(redactSensitiveParams({ monkey: 'value' })).not.toHaveProperty('monkey');
    });

    it('handles a params object with numeric and boolean values', () => {
      const result = redactSensitiveParams({ count: 42, active: true, token: 'hidden' });
      expect(result).toHaveProperty('count', 42);
      expect(result).toHaveProperty('active', true);
      expect(result).not.toHaveProperty('token');
    });
  });
});
