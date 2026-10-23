/**
 * ParamsBuilder
 *
 * A dual-mode parameters editor for API test calls.
 *
 * Modes
 * ─────
 * • Form   — Add typed key/value rows (string / number / boolean).
 *            Each row exposes: key input, type selector, value input, remove
 *            button, with tab order: key → type → value → remove.
 * • Raw    — A plain JSON textarea (mirrors RequestBodyEditor conventions).
 *            Switching form→raw serialises rows; raw→form parses and shows
 *            inline errors if the JSON is malformed or not an object.
 *
 * Props
 * ─────
 * value     — Controlled serialised JSON string (the "source of truth" the
 *              parent component stores).
 * onChange  — Called with the updated JSON string after every mutation.
 * disabled  — Disables all inputs.
 * label     — Heading for the parameters section.
 *
 * Acceptance criteria (issue #150)
 * ─────────────────────────────────
 * ✓ Form and raw modes round-trip without data loss.
 * ✓ Invalid raw JSON surfaces a non-blocking inline error.
 * ✓ Tab order flows key → type → value → remove per row.
 * ✓ Empty state shows "No parameters yet" with an Add CTA.
 */

import { useId, useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three value types a row can carry. */
export type ParamType = 'string' | 'number' | 'boolean';

/** One key/value/type row in form mode. */
export interface ParamRow {
  /** Stable client-side id so React reconciliation is correct. */
  id: string;
  key: string;
  type: ParamType;
  value: string;
}

export interface ParamsBuilderProps {
  /** Controlled serialised JSON string (e.g. '{"limit":10}'). */
  value: string;
  /** Fired with the updated JSON string after every mutation. */
  onChange: (json: string) => void;
  /** Disables all inputs. */
  disabled?: boolean;
  /** Section heading. Defaults to "Parameters". */
  label?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _rowCounter = 0;
function nextId() {
  return `pb-row-${++_rowCounter}`;
}

/** Coerce a raw string into the appropriate JS value based on type. */
function coerce(type: ParamType, raw: string): string | number | boolean {
  if (type === 'boolean') return raw === 'true';
  if (type === 'number') {
    const n = Number(raw);
    return isNaN(n) ? 0 : n;
  }
  return raw;
}

/** Serialise rows to a compact JSON object string. */
function rowsToJson(rows: ParamRow[]): string {
  const obj: Record<string, unknown> = {};
  for (const row of rows) {
    if (row.key.trim() === '') continue; // skip unnamed params
    obj[row.key.trim()] = coerce(row.type, row.value);
  }
  return JSON.stringify(obj, null, 2);
}

/**
 * Parse a JSON string into ParamRow[].
 * Returns null and a message when parsing fails or the top-level is not an object.
 */
function jsonToRows(raw: string): { rows: ParamRow[]; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '{}') {
    return { rows: [], error: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof SyntaxError ? err.message : String(err);
    return { rows: [], error: `JSON syntax error: ${msg}` };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { rows: [], error: 'Parameters must be a JSON object ({ … }).' };
  }
  const obj = parsed as Record<string, unknown>;
  const rows: ParamRow[] = Object.entries(obj).map(([key, val]) => {
    let type: ParamType = 'string';
    let value = String(val);
    if (typeof val === 'number') { type = 'number'; value = String(val); }
    else if (typeof val === 'boolean') { type = 'boolean'; value = String(val); }
    return { id: nextId(), key, type, value };
  });
  return { rows, error: null };
}

// ---------------------------------------------------------------------------
// Scoped styles
// ---------------------------------------------------------------------------

const STYLES = `
/* ── ParamsBuilder root ──────────────────────────────────────────────── */
.pb-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Header bar (label + mode toggle + count badge) ──────────────────── */
.pb-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pb-heading {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0.02em;
  margin: 0;
}

.pb-count {
  font-size: 11px;
  font-weight: 600;
  background: var(--surface-soft);
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 1px 8px;
  line-height: 1.6;
}

.pb-mode-toggle {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0;
  border: 1.5px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}

.pb-mode-btn {
  background: transparent;
  border: none;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: background var(--transition-speed, 240ms), color var(--transition-speed, 240ms);
  line-height: 1.6;
}

.pb-mode-btn:hover:not(:disabled) {
  background: var(--surface-soft);
  color: var(--text);
}

.pb-mode-btn[aria-pressed="true"] {
  background: var(--accent);
  color: #fff;
}

.pb-mode-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.pb-mode-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Parse error banner (raw → form) ──────────────────────────────────── */
.pb-parse-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 125, 141, 0.08);
  border: 1px solid var(--danger, #ff7d8d);
  border-radius: 8px;
  color: var(--danger, #ff7d8d);
  font-size: 12px;
  line-height: 1.5;
}

/* ── Empty state ──────────────────────────────────────────────────────── */
.pb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  border: 1.5px dashed var(--line);
  border-radius: var(--radius-md, 12px);
  background: var(--surface-soft);
  text-align: center;
}

.pb-empty-text {
  font-size: 13px;
  color: var(--muted);
  margin: 0;
}

/* ── Form rows ────────────────────────────────────────────────────────── */
.pb-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.params-builder__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  transition: border-color var(--transition-speed, 240ms);
}

.params-builder__row:focus-within {
  border-color: var(--accent);
}

/* Inputs inside the row */
.pb-key-input,
.pb-value-input,
.pb-type-select {
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 13px;
  color: var(--text);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  transition: border-color var(--transition-speed, 240ms);
}

.pb-key-input::placeholder,
.pb-value-input::placeholder {
  color: var(--muted);
  opacity: 0.7;
}

.pb-key-input:focus-visible,
.pb-value-input:focus-visible,
.pb-type-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: var(--accent);
}

.pb-key-input:disabled,
.pb-value-input:disabled,
.pb-type-select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Type selector auto-width */
.pb-type-select {
  width: auto;
  min-width: 90px;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2393a0bf'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 24px;
  cursor: pointer;
}

/* Remove button */
.pb-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 1.5px solid transparent;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--transition-speed, 240ms), border-color var(--transition-speed, 240ms), background var(--transition-speed, 240ms);
}

.pb-remove-btn:hover:not(:disabled) {
  color: var(--danger, #ff7d8d);
  border-color: var(--danger, #ff7d8d);
  background: rgba(255, 125, 141, 0.08);
}

.pb-remove-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.pb-remove-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ── Add button ───────────────────────────────────────────────────────── */
.pb-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 6px 14px;
  background: transparent;
  border: 1.5px solid var(--accent);
  border-radius: 8px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-speed, 240ms), color var(--transition-speed, 240ms);
  line-height: 1.4;
}

.pb-add-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.pb-add-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.pb-add-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Raw textarea shell ───────────────────────────────────────────────── */
.pb-raw-shell {
  border: 1.5px solid var(--line);
  border-radius: var(--radius-md, 12px);
  background: var(--surface-soft);
  overflow: hidden;
  transition: border-color var(--transition-speed, 240ms);
}

.pb-raw-shell:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.pb-raw-shell[data-state="error"] {
  border-color: var(--danger, #ff7d8d);
}

.pb-raw-shell[data-state="ok"] {
  border-color: var(--success, #73f2bb);
}

.pb-raw-textarea {
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

.pb-raw-textarea::placeholder {
  color: var(--muted);
  opacity: 0.7;
}

.pb-raw-textarea:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Raw status bar ───────────────────────────────────────────────────── */
.pb-raw-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 20px;
  font-size: 12px;
}

.pb-raw-status-ok {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--success, #73f2bb);
  font-weight: 500;
}

.pb-raw-error {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  color: var(--danger, #ff7d8d);
  line-height: 1.4;
}
`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** SVG cross ("✕") used on the remove button. */
function IconRemove() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Small "+" icon for the Add button. */
function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" focusable="false">
      <path d="M6.5 1.5V11.5M1.5 6.5H11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Checkmark icon for the raw status bar. */
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" focusable="false">
      <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** X-circle icon for raw errors. */
function IconXCircle() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" focusable="false">
      <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 4.5L8.5 8.5M8.5 4.5L4.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ParamsBuilder({
  value,
  onChange,
  disabled = false,
  label = 'Parameters',
}: ParamsBuilderProps) {
  const headingId = useId();
  const rawStatusId = useId();

  // ── Mode ────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'form' | 'raw'>('form');

  // ── Form state ──────────────────────────────────────────────────────────
  const [rows, setRows] = useState<ParamRow[]>(() => jsonToRows(value).rows);

  // ── Raw JSON state ───────────────────────────────────────────────────────
  // rawText is the textarea content when in raw mode.
  const [rawText, setRawText] = useState(value);

  // ── Raw validation ───────────────────────────────────────────────────────
  const [rawValidation, setRawValidation] = useState<
    { status: 'idle' } | { status: 'ok' } | { status: 'error'; message: string }
  >({ status: 'idle' });

  // ── Mode-switch parse error (raw → form) ──────────────────────────────
  const [switchError, setSwitchError] = useState<string | null>(null);

  // ── Keep rawText in sync when the external `value` prop changes ─────────
  // (e.g. when the parent resets params on endpoint change)
  useEffect(() => {
    if (mode === 'raw') {
      setRawText(value);
    } else {
      const { rows: parsed } = jsonToRows(value);
      setRows(parsed);
    }
    // We intentionally only react to `value` prop changes here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // ── Validate raw JSON live ────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'raw') return;
    const trimmed = rawText.trim();
    if (trimmed === '' || trimmed === '{}') {
      setRawValidation({ status: 'idle' });
      return;
    }
    try {
      JSON.parse(rawText);
      setRawValidation({ status: 'ok' });
    } catch (err) {
      const msg = err instanceof SyntaxError ? err.message : String(err);
      setRawValidation({ status: 'error', message: msg });
    }
  }, [rawText, mode]);

  // ── Row → JSON → parent ─────────────────────────────────────────────
  const commitRows = useCallback(
    (nextRows: ParamRow[]) => {
      setRows(nextRows);
      onChange(rowsToJson(nextRows));
    },
    [onChange],
  );

  // ── Raw text → parent ─────────────────────────────────────────────────
  const handleRawChange = useCallback(
    (next: string) => {
      setRawText(next);
      // Always propagate — parent decides whether to act on invalid JSON.
      onChange(next);
    },
    [onChange],
  );

  // ── Switch to raw mode ────────────────────────────────────────────────
  const switchToRaw = () => {
    setSwitchError(null);
    const serialised = rowsToJson(rows);
    setRawText(serialised);
    onChange(serialised);
    setMode('raw');
  };

  // ── Switch to form mode ───────────────────────────────────────────────
  const switchToForm = () => {
    setSwitchError(null);
    const { rows: parsed, error } = jsonToRows(rawText);
    if (error) {
      setSwitchError(error);
      return; // Stay in raw mode, surface the error inline.
    }
    setRows(parsed);
    onChange(rowsToJson(parsed));
    setMode('form');
  };

  // ── Row mutations ─────────────────────────────────────────────────────
  const addRow = () => {
    commitRows([...rows, { id: nextId(), key: '', type: 'string', value: '' }]);
  };

  const updateRow = (id: string, field: keyof Omit<ParamRow, 'id'>, val: string) => {
    const next = rows.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: val };
      // When switching type to boolean, default the value to 'true' so it
      // serialises correctly without the user having to touch the select.
      if (field === 'type' && val === 'boolean' && r.value !== 'true' && r.value !== 'false') {
        updated.value = 'true';
      }
      return updated;
    });
    commitRows(next);
  };

  const removeRow = (id: string) => {
    commitRows(rows.filter((r) => r.id !== id));
  };

  // ── Render ────────────────────────────────────────────────────────────
  const rawShellState =
    rawValidation.status === 'ok'
      ? 'ok'
      : rawValidation.status === 'error'
        ? 'error'
        : 'default';

  return (
    <>
      <style>{STYLES}</style>

      <div className="pb-root" aria-labelledby={headingId}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="pb-header">
          <span id={headingId} className="pb-heading">
            {label}
          </span>

          {mode === 'form' && (
            <span className="pb-count" aria-label={`${rows.length} parameter${rows.length !== 1 ? 's' : ''}`}>
              {rows.length}
            </span>
          )}

          <div className="pb-mode-toggle" role="group" aria-label="Editor mode">
            <button
              type="button"
              className="pb-mode-btn"
              aria-pressed={mode === 'form'}
              onClick={switchToForm}
              disabled={disabled}
            >
              Form
            </button>
            <button
              type="button"
              className="pb-mode-btn"
              aria-pressed={mode === 'raw'}
              onClick={switchToRaw}
              disabled={disabled}
            >
              Raw JSON
            </button>
          </div>
        </div>

        {/* ── Switch error (raw → form failed) ──────────────────────── */}
        {switchError && (
          <div className="pb-parse-error" role="alert" aria-live="assertive">
            <IconXCircle />
            <span>
              <strong>Cannot switch to Form:</strong> {switchError}
            </span>
          </div>
        )}

        {/* ── Form mode ──────────────────────────────────────────────── */}
        {mode === 'form' && (
          <>
            {rows.length === 0 ? (
              <div className="pb-empty">
                <p className="pb-empty-text">No parameters yet.</p>
                <button
                  type="button"
                  className="pb-add-btn"
                  onClick={addRow}
                  disabled={disabled}
                >
                  <IconPlus />
                  Add parameter
                </button>
              </div>
            ) : (
              <>
                <div className="pb-rows" role="list" aria-label="Parameter rows">
                  {rows.map((row, index) => (
                    <div
                      key={row.id}
                      className="params-builder__row"
                      role="listitem"
                      aria-label={`Parameter ${index + 1}`}
                    >
                      {/* Key */}
                      <input
                        type="text"
                        className="pb-key-input"
                        placeholder="key"
                        value={row.key}
                        onChange={(e) => updateRow(row.id, 'key', e.target.value)}
                        disabled={disabled}
                        aria-label={`Parameter ${index + 1} key`}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                      />

                      {/* Type */}
                      <select
                        className="pb-type-select"
                        value={row.type}
                        onChange={(e) => updateRow(row.id, 'type', e.target.value as ParamType)}
                        disabled={disabled}
                        aria-label={`Parameter ${index + 1} type`}
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                      </select>

                      {/* Value */}
                      {row.type === 'boolean' ? (
                        <select
                          className="pb-value-input pb-type-select"
                          value={row.value}
                          onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                          disabled={disabled}
                          aria-label={`Parameter ${index + 1} value`}
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          type={row.type === 'number' ? 'number' : 'text'}
                          className="pb-value-input"
                          placeholder="value"
                          value={row.value}
                          onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                          disabled={disabled}
                          aria-label={`Parameter ${index + 1} value`}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                        />
                      )}

                      {/* Remove */}
                      <button
                        type="button"
                        className="pb-remove-btn"
                        onClick={() => removeRow(row.id)}
                        disabled={disabled}
                        aria-label={`Remove parameter ${index + 1}${row.key ? ` (${row.key})` : ''}`}
                      >
                        <IconRemove />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="pb-add-btn"
                  onClick={addRow}
                  disabled={disabled}
                >
                  <IconPlus />
                  Add parameter
                </button>
              </>
            )}
          </>
        )}

        {/* ── Raw JSON mode ──────────────────────────────────────────── */}
        {mode === 'raw' && (
          <div>
            <div
              className="pb-raw-shell"
              data-state={rawShellState}
            >
              <textarea
                className="pb-raw-textarea"
                value={rawText}
                onChange={(e) => handleRawChange(e.target.value)}
                placeholder={'{\n  "key": "value"\n}'}
                rows={6}
                disabled={disabled}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                aria-label="Raw JSON parameters"
                aria-describedby={rawStatusId}
                aria-invalid={rawValidation.status === 'error' || undefined}
              />
            </div>

            {/* Inline status for raw mode */}
            <div
              id={rawStatusId}
              className="pb-raw-status"
              role="status"
              aria-live="polite"
              aria-atomic="false"
            >
              {rawValidation.status === 'ok' && (
                <span className="pb-raw-status-ok">
                  <IconCheck />
                  Valid JSON
                </span>
              )}
              {rawValidation.status === 'error' && (
                <span className="pb-raw-error">
                  <IconXCircle />
                  <span>
                    <strong>JSON syntax error:</strong> {rawValidation.message}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
