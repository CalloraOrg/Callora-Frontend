// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateSnapshotUrl, parseSnapshotUrl, copySnapshotUrl } from './snapshotUrl';

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
      expect(url).toContain('endpoint=endpoint-1');
      expect(url).toContain('params=');
    });

    it('handles special characters in params', () => {
      const url = generateSnapshotUrl('/usage', {
        endpointId: 'endpoint-3',
        params: { note: 'hello "world"' },
      });
      expect(url).toContain('endpoint=endpoint-3');
      expect(() => decodeURIComponent(url.split('params=')[1])).not.toThrow();
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
  });
});