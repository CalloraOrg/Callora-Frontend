import React from "react";
import type { ContrastCheckResult } from "../utils/contrast";

interface TokenEditorProps {
  label: string;
  tokenKey: string;
  value: string;
  onChange: (nextValue: string) => void;
  /**
   * Optional WCAG checks for this token. Each pair is rendered as a badge with
   * its measured ratio and a pass/fail verdict, so a designer sees the result
   * of an edit without leaving the playground.
   */
  contrast?: ContrastCheckResult | ContrastCheckResult[];
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{3,8}$/.test(withHash) ? withHash : trimmed;
}

/** Render a ratio, or name the problem when the colour cannot be parsed. */
function formatRatio(ratio: number | null): string {
  return ratio === null ? "invalid colour" : `${ratio.toFixed(2)}:1`;
}

export default function TokenEditor({
  label,
  tokenKey,
  value,
  onChange,
  contrast,
}: TokenEditorProps) {
  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = normalizeHexColor(event.target.value);
    onChange(nextValue || event.target.value);
  };

  const contrastChecks =
    contrast === undefined ? [] : Array.isArray(contrast) ? contrast : [contrast];

  return (
    <div className="token-editor">
      <div className="token-editor__header">
        <label className="token-editor__label" htmlFor={tokenKey}>
          {label}
        </label>
        <input
          id={tokenKey}
          aria-label={`${label} token`}
          className="token-editor__swatch"
          type="color"
          value={value.startsWith("#") ? value : "#4e85ff"}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <input
        className="token-editor__input"
        type="text"
        aria-label={`${label} hex value`}
        value={value}
        onChange={handleTextChange}
        aria-describedby={`${tokenKey}-hint`}
      />
      <p id={`${tokenKey}-hint`} className="token-editor__hint">
        Enter a hex color such as #4E85FF.
      </p>

      {contrastChecks.map((check) => (
        <p
          key={check.id}
          className="token-editor__contrast"
          data-testid={`contrast-${check.id}`}
          aria-live="polite"
        >
          <span className="token-editor__contrast-label">{check.label}:</span>{" "}
          <strong className="token-editor__contrast-ratio">
            {formatRatio(check.ratio)}
          </strong>{" "}
          <span
            className={`token-editor__contrast-status ${
              check.passes ? "pass" : "fail"
            }`}
            data-testid={`contrast-${check.id}-status`}
          >
            {check.ratio === null
              ? "Invalid colour"
              : check.passes
                ? "Passes AA"
                : "Fails AA"}
          </span>
        </p>
      ))}
    </div>
  );
}
