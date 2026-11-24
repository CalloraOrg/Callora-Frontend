/**
 * openapi.worker.ts
 *
 * Web Worker that runs parseOpenApiSpec off the main thread so that
 * importing a large OpenAPI specification never freezes the UI.
 *
 * Message protocol
 * ----------------
 * Incoming (from client):
 *   { id: string; text: string; filename: string }
 *
 * Outgoing (to client):
 *   { id: string; type: 'progress'; phase: 'read' | 'resolve-refs' | 'build-endpoints' }
 *   { id: string; type: 'result';   endpoints: ...; errors: ...; warnings: ...; source: ... }
 *   { id: string; type: 'error';    errors: ParseError[] }
 *
 * The worker never leaks stack traces back to the client; all uncaught
 * exceptions are caught and converted to { type: 'error' } messages.
 */

import { parseOpenApiSpec } from '../utils/openapi-parse';
import type { ParseError } from '../utils/openapi-parse';

export type WorkerInMessage = {
  id: string;
  text: string;
  filename: string;
};

export type WorkerProgressMessage = {
  id: string;
  type: 'progress';
  phase: 'read' | 'resolve-refs' | 'build-endpoints';
};

export type WorkerResultMessage = {
  id: string;
  type: 'result';
  endpoints: ReturnType<typeof parseOpenApiSpec>['endpoints'];
  errors: ParseError[];
  warnings: ParseError[];
  source: ReturnType<typeof parseOpenApiSpec>['source'];
};

export type WorkerErrorMessage = {
  id: string;
  type: 'error';
  errors: ParseError[];
};

export type WorkerOutMessage =
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerErrorMessage;

self.addEventListener('message', (event: MessageEvent<WorkerInMessage>) => {
  const { id, text, filename } = event.data;

  try {
    // Phase 1: acknowledge that the content has been received
    self.postMessage({ id, type: 'progress', phase: 'read' } satisfies WorkerProgressMessage);

    // Phase 2: the parser resolves $refs internally — announce that phase
    self.postMessage({ id, type: 'progress', phase: 'resolve-refs' } satisfies WorkerProgressMessage);

    // Run the parser (synchronous; runs fully off the main thread)
    const result = parseOpenApiSpec(text, filename);

    // Phase 3: endpoints have been built
    self.postMessage({ id, type: 'progress', phase: 'build-endpoints' } satisfies WorkerProgressMessage);

    // Send the final result
    self.postMessage({
      id,
      type: 'result',
      endpoints: result.endpoints,
      errors: result.errors,
      warnings: result.warnings,
      source: result.source,
    } satisfies WorkerResultMessage);
  } catch (err) {
    // Convert any exception to a safe error message; never forward stack traces.
    const safeMessage =
      err instanceof Error ? err.message : 'An unexpected error occurred during parsing.';

    self.postMessage({
      id,
      type: 'error',
      errors: [{ message: safeMessage }],
    } satisfies WorkerErrorMessage);
  }
});
