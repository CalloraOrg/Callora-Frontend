/**
 * openapi-parse.client.ts
 *
 * Browser-side client for running parseOpenApiSpec in a Web Worker.
 *
 * Usage
 * -----
 *   const result = await parseOpenApiInWorker(text, filename, { signal, onProgress });
 *
 * When Worker is unavailable (SSR, test environments without Worker support)
 * the function falls back to synchronous main-thread parsing automatically.
 *
 * The abort signal terminates the worker immediately on cancellation, so a
 * slow parse does not keep running in the background.
 *
 * A generation counter ensures that if a second file is chosen before the
 * first parse finishes, the stale result is discarded.
 */

import { parseOpenApiSpec } from './openapi-parse';
import type { ParseResult, ParseError } from './openapi-parse';
import type { WorkerInMessage, WorkerOutMessage } from '../workers/openapi.worker';

// ---------------------------------------------------------------------------
// Size limit
// ---------------------------------------------------------------------------

/** Maximum file size accepted before posting to the worker (5 MB). */
export const OPENAPI_MAX_FILE_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type ParseProgressPhase = 'read' | 'resolve-refs' | 'build-endpoints';

export type ParseInWorkerOptions = {
  /** AbortSignal to cancel the in-flight parse and terminate the worker. */
  signal?: AbortSignal;
  /** Called with phase labels as the worker progresses. */
  onProgress?: (phase: ParseProgressPhase) => void;
};

// ---------------------------------------------------------------------------
// Worker availability check
// ---------------------------------------------------------------------------

function isWorkerAvailable(): boolean {
  return typeof globalThis.Worker === 'function';
}

// ---------------------------------------------------------------------------
// Generation counter — module-level, so callers share it
// ---------------------------------------------------------------------------

let _generation = 0;

/** Obtain the current generation id (used by the component to detect stale results). */
export function currentGeneration(): number {
  return _generation;
}

/** Increment and return the new generation id. */
export function nextGeneration(): number {
  _generation += 1;
  return _generation;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse an OpenAPI specification text in a Web Worker.
 *
 * Falls back to synchronous main-thread parsing when Worker is unavailable.
 *
 * @throws {DOMException} with name "AbortError" if `signal` is aborted.
 */
export function parseOpenApiInWorker(
  text: string,
  filename: string,
  options: ParseInWorkerOptions = {},
): Promise<ParseResult> {
  const { signal, onProgress } = options;

  // Enforce size limit before doing anything else.
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > OPENAPI_MAX_FILE_BYTES) {
    const limitMB = (OPENAPI_MAX_FILE_BYTES / (1024 * 1024)).toFixed(0);
    const fileMB = (byteLength / (1024 * 1024)).toFixed(1);
    const errors: ParseError[] = [
      {
        message: `File is too large (${fileMB} MB). The maximum supported size is ${limitMB} MB.`,
      },
    ];
    return Promise.resolve({ endpoints: [], errors, warnings: [], source: 'openapi3' });
  }

  // Check abort before starting anything.
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  // Fallback to synchronous parsing when Worker is not available (SSR, jsdom, …).
  if (!isWorkerAvailable()) {
    return Promise.resolve(parseOpenApiSpec(text, filename));
  }

  // ---------------------------------------------------------------------------
  // Worker path
  // ---------------------------------------------------------------------------

  return new Promise<ParseResult>((resolve, reject) => {
    // Vite module worker — produces a separate chunk at build time.
    const worker = new Worker(
      new URL('../workers/openapi.worker.ts', import.meta.url),
      { type: 'module' },
    );

    const id = `parse-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.terminate();
    };

    const onMessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      if (msg.id !== id) return;

      if (msg.type === 'progress') {
        onProgress?.(msg.phase);
        return;
      }

      cleanup();

      if (msg.type === 'result') {
        resolve({
          endpoints: msg.endpoints,
          errors: msg.errors,
          warnings: msg.warnings,
          source: msg.source,
        });
      } else {
        // type === 'error'
        resolve({
          endpoints: [],
          errors: msg.errors,
          warnings: [],
          source: 'openapi3',
        });
      }
    };

    const onError = (_event: ErrorEvent) => {
      cleanup();
      // Translate worker onerror into a ParseError result — never expose the raw event.
      resolve({
        endpoints: [],
        errors: [{ message: 'The parser encountered an unexpected error. Please try again.' }],
        warnings: [],
        source: 'openapi3',
      });
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    // Handle abort: terminate the worker and reject.
    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }

    // Post the work request.
    worker.postMessage({ id, text, filename } satisfies WorkerInMessage);
  });
}
