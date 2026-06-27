import React from "react";

interface TokenEditorProps {
  label: string;
  tokenKey: string;
  value: string;
  onChange: (nextValue: string) => void;
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{3,8}$/.test(withHash) ? withHash : trimmed;
}

export default function TokenEditor({
  label,
  tokenKey,
  value,
  onChange,
}: TokenEditorProps) {
  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = normalizeHexColor(event.target.value);
    onChange(nextValue || event.target.value);
  };

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
        value={value}
        onChange={handleTextChange}
        aria-describedby={`${tokenKey}-hint`}
      />
      <p id={`${tokenKey}-hint`} className="token-editor__hint">
        Enter a hex color such as #4E85FF.
      </p>
    </div>
  );
}
