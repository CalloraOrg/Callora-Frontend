import { useCallback, useId, useRef, useState } from 'react';
import { parseOpenApiSpec } from '../utils/openapi-parse';
import type { ParsedEndpoint, ParseError } from '../utils/openapi-parse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ParsedEndpoint };

export type OpenAPIImportProps = {
  /** Called when the user confirms the import. Receives the parsed endpoints. */
  onImport: (endpoints: ParsedEndpoint[]) => void;
  /** Called when the user dismisses the widget without importing. */
  onCancel?: () => void;
};

type ImportState =
  | { kind: 'idle' }
  | { kind: 'dragging' }
  | { kind: 'loading' }
  | { kind: 'preview'; endpoints: ParsedEndpoint[]; filename: string }
  | { kind: 'error'; errors: ParseError[]; filename: string };

const ACCEPTED_EXTENSIONS = ['.json', '.yaml', '.yml'];

// ---------------------------------------------------------------------------
// HTTP method badge colour helpers
// ---------------------------------------------------------------------------

function methodClass(method: string): string {
  const m = method.toLowerCase();
  if (m === 'get') return 'oai-badge oai-badge-get';
  if (m === 'post') return 'oai-badge oai-badge-post';
  if (m === 'put') return 'oai-badge oai-badge-put';
  if (m === 'delete') return 'oai-badge oai-badge-delete';
  if (m === 'patch') return 'oai-badge oai-badge-patch';
  return 'oai-badge oai-badge-default';
}

// ---------------------------------------------------------------------------
// File reading (FileReader-based for broad jsdom / browser compatibility)
// ---------------------------------------------------------------------------

/**
 * Read a File as a UTF-8 string using the FileReader API.
 * Preferred over File.text() because jsdom (used in vitest) does not
 * always implement the File.text() Promise API.
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsText(file, 'utf-8');
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UploadIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function Spinner() {
  return (
    <span className="oai-spinner" role="status" aria-label="Parsing file…">
      <span className="oai-spinner-ring" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * OpenAPIImport — self-contained widget for importing OpenAPI 3.x specifications.
 *
 * Accepts drag-and-drop or file-picker uploads of .json / .yaml / .yml files,
 * parses them using the openapi-parse utility, shows a preview of the extracted
 * endpoints, and calls `onImport` when the user confirms.
 *
 * State machine: idle → (dragging) → loading → preview | error
 */
export default function OpenAPIImport({ onImport, onCancel }: OpenAPIImportProps) {
  const [state, setState] = useState<ImportState>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRegionId = useId();
  const dropZoneId = useId();
  const helpId = useId();

  // ── File processing ────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    // Validate extension before reading.
    const lower = file.name.toLowerCase();
    const accepted = ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));

    if (!accepted) {
      setState({
        kind: 'error',
        filename: file.name,
        errors: [
          {
            message: `"${file.name}" is not a supported file type. Please upload a .json, .yaml, or .yml file.`,
          },
        ],
      });
      return;
    }

    setState({ kind: 'loading' });

    // Yield to the event loop so the loading UI renders before parsing.
    await Promise.resolve();

    let text: string;
    try {
      text = await readFileAsText(file);
    } catch {
      setState({
        kind: 'error',
        filename: file.name,
        errors: [{ message: `Could not read "${file.name}". The file may be unreadable.` }],
      });
      return;
    }

    const result = parseOpenApiSpec(text, file.name);

    if (result.errors.length > 0 && result.endpoints.length === 0) {
      setState({ kind: 'error', filename: file.name, errors: result.errors });
      return;
    }

    setState({ kind: 'preview', endpoints: result.endpoints, filename: file.name });
  }, []);

  // ── Drag-and-drop handlers ─────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setState((prev) => (prev.kind === 'idle' ? { kind: 'dragging' } : prev));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only reset if leaving the drop zone itself (not a child element).
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setState((prev) => (prev.kind === 'dragging' ? { kind: 'idle' } : prev));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      } else {
        setState({ kind: 'idle' });
      }
    },
    [processFile],
  );

  // ── File input handler ─────────────────────────────────────────────────

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so the same file can be picked again.
      e.target.value = '';
    },
    [processFile],
  );

  // ── Keyboard handler for the drop zone ────────────────────────────────

  const handleDropZoneKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const reset = useCallback(() => {
    setState({ kind: 'idle' });
    onCancel?.();
  }, [onCancel]);

  const confirmImport = useCallback(() => {
    if (state.kind !== 'preview') return;
    onImport(state.endpoints);
  }, [state, onImport]);

  // ── Render ─────────────────────────────────────────────────────────────

  const isDragging = state.kind === 'dragging';
  const isLoading = state.kind === 'loading';
  const showDropZone = state.kind === 'idle' || state.kind === 'dragging';

  return (
    <>
      <style>{STYLES}</style>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
        className="oai-file-input"
      />

      <div className="oai-wrapper">
        {/* ── Drop zone ─────────────────────────────────────────── */}
        {showDropZone && (
          <div
            id={dropZoneId}
            role="button"
            tabIndex={0}
            aria-label="Upload an OpenAPI specification file"
            aria-describedby={helpId}
            aria-busy={isLoading}
            className={`oai-dropzone${isDragging ? ' oai-dropzone-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onKeyDown={handleDropZoneKeyDown}
            data-testid="openapi-drop-zone"
          >
            <span className="oai-upload-icon">
              <UploadIcon />
            </span>
            <p className="oai-drop-heading">
              {isDragging ? 'Drop your file here' : 'Drag and drop your OpenAPI spec here'}
            </p>
            <p id={helpId} className="oai-drop-hint">
              Supports{' '}
              <code>.json</code>, <code>.yaml</code>, and <code>.yml</code>
              {' '}— OpenAPI 3.x only
            </p>
            <button
              type="button"
              className="oai-browse-btn"
              onClick={openFilePicker}
              aria-label="Browse and select an OpenAPI file"
            >
              Browse files
            </button>
          </div>
        )}

        {/* ── Loading state ──────────────────────────────────────── */}
        {isLoading && (
          <div className="oai-loading" aria-live="polite" aria-label="Parsing file">
            <Spinner />
            <p className="oai-loading-text">Parsing specification…</p>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────── */}
        {state.kind === 'error' && (
          <div
            className="oai-error-panel"
            role="alert"
            aria-live="assertive"
            id={errorRegionId}
          >
            <div className="oai-error-header">
              <span className="oai-error-icon" aria-hidden="true">⚠</span>
              <h3 className="oai-error-title">
                Could not parse{state.filename ? ` "${state.filename}"` : ' file'}
              </h3>
            </div>

            <ul className="oai-error-list" aria-label="Parse errors">
              {state.errors.map((err, idx) => (
                <li key={idx} className="oai-error-item">
                  {err.line !== undefined && (
                    <span className="oai-error-line">Line {err.line}:</span>
                  )}
                  <span className="oai-error-msg">{err.message}</span>
                </li>
              ))}
            </ul>

            <div className="oai-error-actions">
              <button type="button" className="oai-action-secondary" onClick={reset}>
                Try a different file
              </button>
            </div>
          </div>
        )}

        {/* ── Preview state ──────────────────────────────────────── */}
        {state.kind === 'preview' && (
          <div className="oai-preview-panel" aria-label="Parsed endpoint preview">
            <div className="oai-preview-header">
              <div>
                <p className="oai-preview-eyebrow">Ready to import</p>
                <h3 className="oai-preview-title">
                  {state.endpoints.length} endpoint
                  {state.endpoints.length !== 1 ? 's' : ''} found in{' '}
                  <span className="oai-preview-filename">{state.filename}</span>
                </h3>
              </div>
            </div>

            {state.endpoints.length === 0 ? (
              <p className="oai-preview-empty">
                No endpoints were found in this specification. The file is valid but the{' '}
                <code>paths</code> block is empty.
              </p>
            ) : (
              <ul className="oai-endpoint-list" aria-label="Endpoint list">
                {state.endpoints.map((ep, idx) => (
                  <li key={idx} className="oai-endpoint-item">
                    <span
                      className={methodClass(ep.method)}
                      aria-label={`HTTP method: ${ep.method}`}
                    >
                      {ep.method}
                    </span>
                    <code className="oai-endpoint-path">{ep.path}</code>
                    {ep.summary && (
                      <span className="oai-endpoint-summary">{ep.summary}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="oai-preview-actions">
              <button
                type="button"
                className="oai-action-primary"
                onClick={confirmImport}
                aria-label="Confirm import and populate the publish form"
              >
                Confirm import
              </button>
              <button
                type="button"
                className="oai-action-secondary"
                onClick={reset}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLES = `
  .oai-file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  .oai-wrapper {
    width: 100%;
  }

  /* ── Drop zone ──────────────────────────────────────────────────────── */

  .oai-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 200px;
    padding: 32px 24px;
    border: 2px dashed var(--line-strong, rgba(169, 184, 255, 0.28));
    border-radius: var(--radius-md, 16px);
    background: var(--surface-soft, rgba(255, 255, 255, 0.04));
    color: var(--muted, #93a0bf);
    cursor: pointer;
    text-align: center;
    transition:
      border-color 180ms ease,
      background 180ms ease,
      transform 180ms ease;
    user-select: none;
  }

  .oai-dropzone:hover {
    border-color: var(--accent, #4e85ff);
    background: rgba(78, 133, 255, 0.06);
  }

  .oai-dropzone:focus-visible {
    outline: 2px solid var(--accent, #4e85ff);
    outline-offset: 2px;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(78, 133, 255, 0.55));
    border-color: var(--accent, #4e85ff);
  }

  .oai-dropzone-active {
    border-color: var(--accent, #4e85ff);
    background: rgba(78, 133, 255, 0.1);
    transform: scale(1.01);
  }

  .oai-upload-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 999px;
    background: rgba(78, 133, 255, 0.12);
    color: var(--accent, #4e85ff);
    margin-bottom: 4px;
    transition: background 180ms ease;
  }

  .oai-dropzone-active .oai-upload-icon,
  .oai-dropzone:hover .oai-upload-icon {
    background: rgba(78, 133, 255, 0.2);
  }

  .oai-drop-heading {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #f3f5fb);
  }

  .oai-drop-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted, #93a0bf);
    line-height: 1.5;
  }

  .oai-drop-hint code {
    font-size: 0.8rem;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--surface-soft, rgba(255,255,255,0.06));
    border: 1px solid var(--line, rgba(169,184,255,0.16));
    color: var(--accent, #4e85ff);
  }

  .oai-browse-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
    min-height: 40px;
    padding: 0 20px;
    border-radius: 999px;
    background: rgba(78, 133, 255, 0.14);
    border: 1px solid rgba(78, 133, 255, 0.3);
    color: var(--accent, #4e85ff);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 180ms ease,
      transform 180ms ease;
  }

  .oai-browse-btn:hover {
    background: rgba(78, 133, 255, 0.22);
    transform: translateY(-1px);
  }

  .oai-browse-btn:focus-visible {
    outline: 2px solid var(--accent, #4e85ff);
    outline-offset: 2px;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(78, 133, 255, 0.55));
  }

  /* ── Loading ────────────────────────────────────────────────────────── */

  .oai-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 160px;
    padding: 32px;
    border-radius: var(--radius-md, 16px);
    background: var(--surface-soft, rgba(255,255,255,0.04));
    border: 1px solid var(--line, rgba(169,184,255,0.16));
  }

  .oai-loading-text {
    margin: 0;
    font-size: 0.9rem;
    color: var(--muted, #93a0bf);
  }

  .oai-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .oai-spinner-ring {
    display: block;
    width: 32px;
    height: 32px;
    border: 3px solid rgba(78, 133, 255, 0.2);
    border-top-color: var(--accent, #4e85ff);
    border-radius: 50%;
    animation: oai-spin 0.7s linear infinite;
  }

  @keyframes oai-spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .oai-spinner-ring {
      animation: none;
      border-top-color: var(--accent, #4e85ff);
      opacity: 0.7;
    }
  }

  /* ── Error panel ────────────────────────────────────────────────────── */

  .oai-error-panel {
    padding: 20px 24px;
    border-radius: var(--radius-md, 16px);
    background: rgba(255, 125, 141, 0.08);
    border: 1px solid rgba(255, 125, 141, 0.28);
  }

  .oai-error-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .oai-error-icon {
    font-size: 1.2rem;
    color: var(--danger, #ff7d8d);
  }

  .oai-error-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--danger, #ff7d8d);
  }

  .oai-error-list {
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }

  .oai-error-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--text, #f3f5fb);
  }

  .oai-error-line {
    flex-shrink: 0;
    font-size: 0.8rem;
    font-weight: 700;
    font-family: monospace;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 125, 141, 0.2);
    color: var(--danger, #ff7d8d);
  }

  .oai-error-msg {
    color: var(--text, #f3f5fb);
  }

  .oai-error-actions {
    display: flex;
    gap: 10px;
  }

  /* ── Preview panel ──────────────────────────────────────────────────── */

  .oai-preview-panel {
    border-radius: var(--radius-md, 16px);
    background: var(--surface-soft, rgba(255,255,255,0.04));
    border: 1px solid var(--line, rgba(169,184,255,0.16));
    overflow: hidden;
  }

  .oai-preview-header {
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--line, rgba(169,184,255,0.16));
  }

  .oai-preview-eyebrow {
    margin: 0 0 4px;
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent-strong, #1ed6a4);
  }

  .oai-preview-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #f3f5fb);
  }

  .oai-preview-filename {
    font-family: monospace;
    font-size: 0.9em;
    color: var(--accent, #4e85ff);
  }

  .oai-preview-empty {
    padding: 20px;
    margin: 0;
    font-size: 0.9rem;
    color: var(--muted, #93a0bf);
  }

  .oai-endpoint-list {
    margin: 0;
    padding: 8px 0;
    list-style: none;
    max-height: 300px;
    overflow-y: auto;
  }

  .oai-endpoint-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--line, rgba(169,184,255,0.08));
    font-size: 0.88rem;
    transition: background 120ms ease;
  }

  .oai-endpoint-item:last-child {
    border-bottom: none;
  }

  .oai-endpoint-item:hover {
    background: rgba(78, 133, 255, 0.05);
  }

  /* HTTP method badges — inherits the --method-* tokens from index.css */

  .oai-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 62px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    border: 1px solid transparent;
  }

  .oai-badge-get    { background: var(--method-get-bg, rgba(59,130,246,0.16)); color: var(--method-get-color, #60a5fa); border-color: var(--method-get-border, rgba(59,130,246,0.35)); }
  .oai-badge-post   { background: var(--method-post-bg, rgba(16,185,129,0.16)); color: var(--method-post-color, #34d399); border-color: var(--method-post-border, rgba(16,185,129,0.35)); }
  .oai-badge-put    { background: var(--method-put-bg, rgba(245,158,11,0.16)); color: var(--method-put-color, #fbbf24); border-color: var(--method-put-border, rgba(245,158,11,0.35)); }
  .oai-badge-delete { background: var(--method-delete-bg, rgba(239,68,68,0.16)); color: var(--method-delete-color, #f87171); border-color: var(--method-delete-border, rgba(239,68,68,0.35)); }
  .oai-badge-patch  { background: var(--method-patch-bg, rgba(139,92,246,0.16)); color: var(--method-patch-color, #a78bfa); border-color: var(--method-patch-border, rgba(139,92,246,0.35)); }
  .oai-badge-default { background: var(--surface-soft, rgba(255,255,255,0.06)); color: var(--muted, #93a0bf); border-color: var(--line, rgba(169,184,255,0.16)); }

  .oai-endpoint-path {
    font-size: 0.85rem;
    font-family: monospace;
    color: var(--text, #f3f5fb);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .oai-endpoint-summary {
    font-size: 0.82rem;
    color: var(--muted, #93a0bf);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .oai-preview-actions {
    display: flex;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--line, rgba(169,184,255,0.16));
  }

  /* ── Shared action buttons ──────────────────────────────────────────── */

  .oai-action-primary,
  .oai-action-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 20px;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition:
      background 180ms ease,
      transform 180ms ease,
      opacity 180ms ease;
  }

  .oai-action-primary {
    background: linear-gradient(135deg, #4e85ff, #6da6ff);
    color: #ffffff;
  }

  .oai-action-primary:hover {
    transform: translateY(-1px);
    opacity: 0.92;
  }

  .oai-action-primary:focus-visible {
    outline: 2px solid var(--accent, #4e85ff);
    outline-offset: 2px;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(78, 133, 255, 0.55));
  }

  .oai-action-secondary {
    background: var(--surface-soft, rgba(255,255,255,0.06));
    color: var(--text, #f3f5fb);
    border-color: var(--line, rgba(169,184,255,0.16));
  }

  .oai-action-secondary:hover {
    background: var(--line, rgba(169,184,255,0.16));
    transform: translateY(-1px);
  }

  .oai-action-secondary:focus-visible {
    outline: 2px solid var(--accent, #4e85ff);
    outline-offset: 2px;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(78, 133, 255, 0.55));
  }

  /* ── Responsive ─────────────────────────────────────────────────────── */

  @media (max-width: 600px) {
    .oai-dropzone {
      min-height: 160px;
      padding: 24px 16px;
    }

    .oai-endpoint-item {
      flex-wrap: wrap;
      gap: 6px;
      padding: 10px 14px;
    }

    .oai-endpoint-path {
      flex: 1 1 100%;
    }

    .oai-endpoint-summary {
      flex: 1 1 100%;
    }

    .oai-preview-actions {
      flex-direction: column;
    }

    .oai-action-primary,
    .oai-action-secondary {
      width: 100%;
    }
  }
`;
