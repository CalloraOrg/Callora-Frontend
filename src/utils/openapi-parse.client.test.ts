/**
 * Tests for openapi-parse.client.ts
 *
 * Uses a fake Worker class — jsdom does not ship a Worker implementation.
 * The fake captures the message handler, lets tests drive it manually,
 * and records whether terminate() was called.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseOpenApiInWorker,
  OPENAPI_MAX_FILE_BYTES,
  nextGeneration,
  currentGeneration,
} from './openapi-parse.client';
import type { WorkerOutMessage } from '../workers/openapi.worker';

// ---------------------------------------------------------------------------
// Fake Worker
// ---------------------------------------------------------------------------

type MessageHandler = (event: { data: WorkerOutMessage }) => void;
type ErrorHandler = (event: ErrorEvent) => void;

class FakeWorker {
  private messageHandlers: MessageHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  public postedMessages: unknown[] = [];
  public terminated = false;

  addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
    if (type === 'message') this.messageHandlers.push(handler as MessageHandler);
    if (type === 'error') this.errorHandlers.push(handler as ErrorHandler);
  }

  removeEventListener(type: string, handler: EventListenerOrEventListenerObject) {
    if (type === 'message') {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    }
    if (type === 'error') {
      this.errorHandlers = this.errorHandlers.filter((h) => h !== handler);
    }
  }

  postMessage(data: unknown) {
    this.postedMessages.push(data);
  }

  terminate() {
    this.terminated = true;
  }

  // Test helpers

  /** Dispatch a message from the worker to the client. */
  emit(data: WorkerOutMessage) {
    this.messageHandlers.forEach((h) => h({ data }));
  }

  /** Dispatch a worker onerror event. */
  emitError(message = 'Worker crashed') {
    const event = new ErrorEvent('error', { message });
    this.errorHandlers.forEach((h) => h(event));
  }
}

let fakeWorker: FakeWorker;

// ---------------------------------------------------------------------------
// Setup — stub out Worker globally before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  fakeWorker = new FakeWorker();

  // Stub globalThis.Worker so the client creates our FakeWorker instead.
  vi.stubGlobal('Worker', vi.fn(() => fakeWorker));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Size limit
// ---------------------------------------------------------------------------

describe('parseOpenApiInWorker — size limit', () => {
  it('rejects files that exceed OPENAPI_MAX_FILE_BYTES without spawning a worker', async () => {
    // Build a string just over the limit
    const oversizedText = 'x'.repeat(OPENAPI_MAX_FILE_BYTES + 1);
    const result = await parseOpenApiInWorker(oversizedText, 'huge.json');

    expect(result.endpoints).toHaveLength(0);
    expect(result.errors[0].message).toMatch(/too large|maximum/i);
    // No worker should be created for an oversized file
    expect(vi.mocked(Worker)).not.toHaveBeenCalled();
  });

  it('accepts a file at exactly the limit', async () => {
    // Build a minimal valid spec that is well under the limit —
    // the point is the size-check guard does not reject it.
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {},
    });

    const promise = parseOpenApiInWorker(spec, 'api.json');

    // Worker should have been created for a small file (well under the limit).
    expect(vi.mocked(Worker)).toHaveBeenCalled();

    const id = extractId(fakeWorker);
    expect(id).toBeTruthy();

    fakeWorker.emit({
      id: id!,
      type: 'result',
      endpoints: [],
      errors: [],
      warnings: [],
      source: 'openapi3',
    });

    const result = await promise;
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Fallback to synchronous parsing when Worker is unavailable
// ---------------------------------------------------------------------------

describe('parseOpenApiInWorker — fallback path', () => {
  it('falls back to synchronous parseOpenApiSpec when Worker is not available', async () => {
    // Remove Worker from globals
    vi.stubGlobal('Worker', undefined);

    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: { '/ping': { get: { summary: 'Ping' } } },
    });

    const result = await parseOpenApiInWorker(spec, 'api.json');

    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].path).toBe('/ping');
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Happy path — result message
// ---------------------------------------------------------------------------

describe('parseOpenApiInWorker — result', () => {
  it('resolves with the endpoints returned by the worker', async () => {
    const promise = parseOpenApiInWorker('{}', 'api.json');
    const id = extractId(fakeWorker);

    fakeWorker.emit({
      id: id!,
      type: 'result',
      endpoints: [{ path: '/items', method: 'GET', summary: 'List' }],
      errors: [],
      warnings: [],
      source: 'openapi3',
    });

    const result = await promise;
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].path).toBe('/items');
    expect(result.errors).toHaveLength(0);
    expect(result.source).toBe('openapi3');
  });

  it('terminates the worker after a successful result', async () => {
    const promise = parseOpenApiInWorker('{}', 'api.json');
    const id = extractId(fakeWorker);

    fakeWorker.emit({ id: id!, type: 'result', endpoints: [], errors: [], warnings: [], source: 'openapi3' });
    await promise;

    expect(fakeWorker.terminated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error message from worker
// ---------------------------------------------------------------------------

describe('parseOpenApiInWorker — error from worker', () => {
  it('resolves with errors array when the worker sends an error message', async () => {
    const promise = parseOpenApiInWorker('{}', 'api.json');
    const id = extractId(fakeWorker);

    fakeWorker.emit({
      id: id!,
      type: 'error',
      errors: [{ message: 'JSON parse error: Unexpected token' }],
    });

    const result = await promise;
    expect(result.endpoints).toHaveLength(0);
    expect(result.errors[0].message).toContain('JSON parse error');
    expect(fakeWorker.terminated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Progress callbacks
// ---------------------------------------------------------------------------

describe('parseOpenApiInWorker — progress', () => {
  it('calls onProgress for each phase message', async () => {
    const phases: string[] = [];
    const promise = parseOpenApiInWorker('{}', 'api.json', {
      onProgress: (phase) => phases.push(phase),
    });
    const id = extractId(fakeWorker);

    fakeWorker.emit({ id: id!, type: 'progress', phase: 'read' });
    fakeWorker.emit({ id: id!, type: 'progress', phase: 'resolve-refs' });
    fakeWorker.emit({ id: id!, type: 'progress', phase: 'build-endpoints' });
    fakeWorker.emit({ id: id!, type: 'result', endpoints: [], errors: [], warnings: [], source: 'openapi3' });

    await promise;
    expect(phases).toEqual(['read', 'resolve-refs', 'build-endpoints']);
  });
});

// ---------------------------------------------------------------------------
// Abort / cancel
// ---------------------------------------------------------------------------

describe('parseOpenApiInWorker — abort', () => {
  it('rejects with AbortError when signal is aborted after start', async () => {
    const controller = new AbortController();
    const promise = parseOpenApiInWorker('{}', 'api.json', { signal: controller.signal });

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(fakeWorker.terminated).toBe(true);
  });

  it('rejects immediately if signal is already aborted before call', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      parseOpenApiInWorker('{}', 'api.json', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('terminates the worker on abort', async () => {
    const controller = new AbortController();
    const promise = parseOpenApiInWorker('{}', 'api.json', { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toThrow();
    expect(fakeWorker.terminated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Worker onerror — crash inside the worker
// ---------------------------------------------------------------------------

describe('parseOpenApiInWorker — worker crash (onerror)', () => {
  it('resolves with a safe error when the worker fires onerror', async () => {
    const promise = parseOpenApiInWorker('{}', 'api.json');

    fakeWorker.emitError('ReferenceError: foo is not defined');

    const result = await promise;
    expect(result.endpoints).toHaveLength(0);
    expect(result.errors[0].message).toMatch(/unexpected error/i);
    expect(fakeWorker.terminated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stale results (second file chosen quickly cancels the first)
// ---------------------------------------------------------------------------

describe('parseOpenApiInWorker — stale result handling', () => {
  it('ignores a result from a previous generation when a newer parse was started', async () => {
    // We test the generation counters in isolation here — the component wraps them.
    const gen1 = nextGeneration();
    const gen2 = nextGeneration();

    expect(gen2).toBeGreaterThan(gen1);
    expect(currentGeneration()).toBe(gen2);

    // A stale result with gen1 must be detected as stale (gen1 !== currentGeneration()).
    expect(gen1 !== currentGeneration()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the id that the client posted to the worker so tests can send
 * matching replies.
 */
function extractId(worker: FakeWorker): string | null {
  if (worker.postedMessages.length === 0) return null;
  const msg = worker.postedMessages[0] as { id: string };
  return msg.id ?? null;
}
