import React from 'react';

export type FieldStatus = 'idle' | 'error' | 'success';

export type FormFieldCounter = {
  /** Current number of characters entered. */
  current: number;
  /** Maximum number of characters allowed. */
  max: number;
};

export type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  status: FieldStatus;
  /**
   * Optional live character counter. When provided, a 'n / max' counter is
   * rendered below the field and referenced from the input via aria-describedby.
   */
  counter?: FormFieldCounter;
  children: React.ReactElement;
};

const CheckIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 13 13"
    fill="none"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '5px' }}
  >
    <path
      d="M2 6.5L5 9.5L11 3.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
	);

/**
 * FormField — accessible wrapper for form inputs.
 *
 * Renders a label (with optional required marker and success tick), the field
 * itself, an optional hint, an error region that is always present in the
 * DOM so screen readers can reference it via aria-describedby even before an
 * error occurs. The child input element receives aria-invalid and
 * aria-describedby via React.cloneElement.
 *
 * Errors are surfaced only after the field has been touched (blurred) or the
 * form has been submitted — the parent controls this via the `status` prop.
 *
 * When a `counter` is provided, a live 'n / max' counter is rendered and
 * referenced from the input via aria-describedby. The counter is only
 * announced politely (aria-live="polite") when the remaining count is under
 * 50 characters, so screen readers are not chattered on every keystroke.
 */
export default function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  status,
  counter,
  children,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : undefined;
  const counterId = counter ? `${id}-counter` : undefined;

  const existingDescribedBy = children.props['aria-describedby'];
  const describedBy = [existingDescribedBy, hintId, counterId, errorId]
    .filter(Boolean)
    .join(' ');

  const enhancedChild = React.cloneElement(children, {
    'aria-invalid': status === 'error' ? true : undefined,
    'aria-describedby': describedBy,
  });

  const remaining = counter ? counter.max - counter.current : 0;
  const nearLimit = counter !== undefined && remaining < 50;
  const overLimit = counter !== undefined && counter.current > counter.max;

  return (
    <>
      <style>{FF_STYLES}</style>
      <div className="ff-field">
        <label className="ff-label" htmlFor={id}>
          {label}
          {required && (
            <span className="ff-required" aria-hidden="true">
              {' '}*
            </span>
          )}
          {status === 'success' && (
            <span className="ff-check" aria-label="valid">
              <CheckIcon />
            </span>
          )}
        </label>
        {enhancedChild}
        {hint && (
          <p id={hintId} className="ff-hint">
            {hint}
          </p>
        )}
        {counter && (
          <p
            id={counterId}
            className={`lf-counter${overLimit ? ' ff-counter--over' : ''}${nearLimit && !overLimit ? ' ff-counter--near' : ''}`}
            aria-live={nearLimit ? 'polite' : 'off' }
            aria-atomic="true"
          >
            {counter.current} / {counter.max}
          </p>
        )}
        <p
          id={ErrorId}
          className={`ff-error${status === 'error' && error ? ' ff-error--visible' : ''}`}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          {status === 'error' && error ? error : ''}
        </p>
      </div>
    </>
  );
}

const FF_STYLES = `
  .ff-field {
    display: grid;
    gap: 6px;
  }

  .ff-label {
    display: flex;
    align-items: center;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text, #f3f5fb);
  }

  .ff-required {
    color: var(--danger, #ff7d8d);
    margin-left: 2px;
  }

  .ff-check {
    display: inline-flex;
    align-items: center;
    color: var(--success, #73f2bb);
    margin-left: 6px;
    line-height: 1;
  }

  .ff-hint {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted, #93a0bf);
  }

  .ff-counter {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted, #93a0bf);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .ff-counter--near {
    color: var(--warning, #ffcb66);
  }

  .ff-counter--over {
    color: var(--danger, #ff7d8d);
    font-weight: 600;
  }

  .ff-error {
    margin: 0;
    min-height: 1.2em;
    font-size: 0.82rem;
    color: transparent;
    transition: color 160ms ease;
  }

  .ff-error--visible {
    color: var(--danger, #ff7d8d);
  }

  /* Error border state for inputs inside a FormField */
  .ff-field:has([aria-invalid="true"]) .pa-input,
  .ff-field:has([aria-invalid="true"]) .pa-textarea,
  .ff-field:has([aria-invalid="true"]) .pa-select {
    border-color: var(--danger, #ff7d8d);
    background: rgba(255, 125, 141, 0.06);
  }

  /* Success border state */
  .ff-field:has(.ff-check) .pa-input,
  .ff-field:has(.ff-check) .pa-textarea,
  .ff-field:has(.ff-check) .pa-select {
    border-color: var(--success, #73f2bb);
  }
`;
