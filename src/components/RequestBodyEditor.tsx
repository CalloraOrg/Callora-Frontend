/**
 * RequestBodyEditor
 *
 * A controlled textarea that validates its JSON content against a JSON Schema
 * in real time, displaying inline, accessible error/success feedback.
 *
 * Features
 * ─────────
 * • Live JSON parse check — surface syntax errors before schema validation.
 * • Schema validation    — runs `validateAgainstSchema` on every change when
 *   a schema is supplied.
 * • Accessible           — uses aria-describedby, aria-invalid, role="alert",
 *   and aria-live regions to meet WCAG 2.1 AA.
 * • Design-token aware   — colours, radius, and type are consumed exclusively
 *   from CSS custom properties so dark/light mode works automatically.
 * • No external deps     — relies only on the repo's own schema-validate util.
 *
 * Props
 * ─────
 * value      — The current textarea string (controlled).
 * onChange   — Called with the new raw string on every keystroke.
 * schema     — Optional JSON Schema to validate against.  When omitted only
 *              JSON-syntax checking is performed.
 * id         — Optional id forwarded to the <textarea>; defaults to a stable
 *              generated value so aria relationships always resolve.
 * placeholder — Forwarded verbatim to the <textarea>.
 * rows        — Forwarded to <textarea>; defaults to 6.
 * disabled    — Disables the textarea and suppresses validation UI.
 * label       — Accessible label text shown above the editor.
 *              Defaults to "Request Body (JSON)".
 *
 * Validation state
 * ────────────────
 * idle    — value is empty (no schema provided).
 * ok      — JSON is valid and (if schema provided) passes all constraints.
 * syntax  — JSON cannot be parsed.
 * invalid — JSON is valid but fails one or more schema constraints.
 */

import { useId, useMemo } from 'react';
import { validateAgainstSchema } from '../utils/schema-validate';
import type { JsonSchema } from '../utils/schema-validate';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type { JsonSchema };

export type RequestBodyEditorProps = {
  /** The current raw string content (controlled). */
  value: string;
  /** Fired on every change with the new raw string. */
  onChange: (value: string) => void;
  /**
   * Optional JSON Schema (Draft-07 subset / OpenAPI 3.x) to validate the
   * parsed JSON against.  When undefined, only JSON syntax is checked.
   */
  schema?: JsonSchema;
  /** Forwarded to the underlying <textarea>. */
  id?: string;
  /** Placeholder text shown in the empty textarea. */
  placeholder?: string;
  /** Number of visible rows; defaults to 6. */
  rows?: number;
  /** Disables the textarea and hides validation feedback. */
  disabled?: boolean;
  /** Visible + accessible label.  Defaults to "Request Body (JSON)". */
  label?: string;
};

// ---------------------------------------------------------------------------
// Validation state helpers
// ---------------------------------------------------------------------------

type ValidationState =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'syntax'; message: string }
  | { status: 'invalid'; errors: string[] };

/** Derive the current validation state from the raw editor value + schema. */
function deriveValidation(raw: string, schema: JsonSchema | undefined): ValidationState {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '{}') return { status: 'idle' };

  // Step 1 — JSON syntax check
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof SyntaxError ? err.message : String(err);
    return { status: 'syntax', message: msg };
  }

  // Step 2 — Schema validation (only when schema is provided)
  if (schema !== undefined) {
    const result = validateAgainstSchema(parsed, schema);
    if (!result.valid) {
      return { status: 'invalid', errors: result.errors };
    }
  }

  return { status: 'ok' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const STYLES = `
.rbe-root {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rbe-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0.02em;
}

/* Wrapper gives us the coloured left-border accent */
.rbe-shell {
  position: relative;
  border-radius: var(--radius-md, 12px);
  border: 1.5px solid var(--line);
  background: var(--surface-soft);
  transition: border-color var(--transition-speed, 240ms);
  overflow: hidden;
}

.rbe-shell:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.rbe-shell[data-state="ok"] {
  border-color: var(--success);
}

.rbe-shell[data-state="error"] {
  border-color: var(--danger);
}

.rbe-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 13px;
  line-height: 1.65;
  resize: vertical;
}

.rbe-textarea::placeholder {
  color: var(--muted);
  opacity: 0.7;
}

.rbe-textarea:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Status bar below the textarea */
.rbe-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 20px; /* reserve space to prevent layout shift */
  font-size: 12px;
}

.rbe-status-ok {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--success);
  font-weight: 500;
}

.rbe-status-ok svg {
  flex-shrink: 0;
}

.rbe-error-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rbe-error-item {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  color: var(--danger);
  line-height: 1.4;
}

.rbe-error-item svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.rbe-schema-hint {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
  opacity: 0.8;
}
`;

export default function RequestBodyEditor({
  value,
  onChange,
  schema,
  id: externalId,
  placeholder = '{\n  "key": "value"\n}',
  rows = 6,
  disabled = false,
  label = 'Request Body (JSON)',
}: RequestBodyEditorProps) {
  const generatedId = useId();
  const textareaId = externalId ?? `rbe-${generatedId}`;
  const statusId = `${textareaId}-status`;

  // Re-derive validation only when value or schema changes
  const validation = useMemo(
    () => (disabled ? ({ status: 'idle' } as ValidationState) : deriveValidation(value, schema)),
    [value, schema, disabled],
  );

  // Determine shell data-state for CSS styling
  const shellState =
    validation.status === 'ok'
      ? 'ok'
      : validation.status === 'syntax' || validation.status === 'invalid'
        ? 'error'
        : 'default';

  // aria-invalid should be true only when there are real errors
  const isInvalid = validation.status === 'syntax' || validation.status === 'invalid';

  return (
    <>
      {/* Scoped styles — injected once per mount */}
      <style>{STYLES}</style>

      <div className="rbe-root">
        {/* Visible label — also serves as the accessible name */}
        <label className="rbe-label" htmlFor={textareaId}>
          {label}
        </label>

        {/* Coloured border shell */}
        <div className="rbe-shell" data-state={shellState}>
          <textarea
            id={textareaId}
            className="rbe-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-label={label}
            aria-describedby={statusId}
            aria-invalid={isInvalid || undefined}
          />
        </div>

        {/* Inline validation feedback — aria-live so screen readers announce changes */}
        <div
          id={statusId}
          className="rbe-status"
          role="status"
          aria-live="polite"
          aria-atomic="false"
        >
          {validation.status === 'ok' && (
            <span className="rbe-status-ok">
              {/* Checkmark icon */}
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M3.5 6.5L5.5 8.5L9.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Valid JSON{schema !== undefined ? ' — passes schema validation' : ''}
            </span>
          )}

          {(validation.status === 'syntax' || validation.status === 'invalid') && (
            <ul className="rbe-error-list" aria-label="Validation errors">
              {validation.status === 'syntax' ? (
                <li className="rbe-error-item">
                  {/* X icon */}
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2" />
                    <path
                      d="M4.5 4.5L8.5 8.5M8.5 4.5L4.5 8.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>
                    <strong>JSON syntax error:</strong> {validation.message}
                  </span>
                </li>
              ) : (
                validation.errors.map((err, i) => (
                  <li key={i} className="rbe-error-item">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2" />
                      <path
                        d="M4.5 4.5L8.5 8.5M8.5 4.5L4.5 8.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>{err}</span>
                  </li>
                ))
              )}
            </ul>
          )}

          {validation.status === 'idle' && schema !== undefined && (
            <span className="rbe-schema-hint" aria-hidden="true">
              Schema validation active — enter a JSON body to validate.
            </span>
          )}
        </div>
      </div>
    </>
  );
}
