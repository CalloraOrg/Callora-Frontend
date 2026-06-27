import React, { useState } from 'react';
import './MethodChip.css';


type Props = {
  method: string;
};

// Mapping HTTP methods to colors (tailored for light/dark themes)
const METHOD_COLORS: Record<string, { bg: string; fg: string; icon: string }> = {
  GET: { bg: 'var(--method-get-bg)', fg: 'var(--method-get-fg)', icon: '🔍' },
  POST: { bg: 'var(--method-post-bg)', fg: 'var(--method-post-fg)', icon: '✉️' },
  PUT: { bg: 'var(--method-put-bg)', fg: 'var(--method-put-fg)', icon: '🛠️' },
  DELETE: { bg: 'var(--method-delete-bg)', fg: 'var(--method-delete-fg)', icon: '🗑️' },
  PATCH: { bg: 'var(--method-patch-bg)', fg: 'var(--method-patch-fg)', icon: '🩹' },
};

export const MethodChip: React.FC<Props> = ({ method }) => {
  const upper = method.toUpperCase();
  const colors = METHOD_COLORS[upper] ?? {
    bg: 'var(--method-default-bg)',
    fg: 'var(--method-default-fg)',
    icon: ''
  };

  // Tooltip visibility state for keyboard accessibility
  const [showTooltip, setShowTooltip] = useState(false);

  const description = `${upper} request`;

  return (
    <span
      className="method-chip"
      style={{ backgroundColor: colors.bg, color: colors.fg }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      aria-label={description}
    >
      {colors.icon && <span className="method-icon" aria-hidden="true">{colors.icon}</span>}
      {upper}
      {showTooltip && (
        <span className="method-tooltip" role="tooltip">
          {description}
        </span>
      )}
    </span>
  );
};

export default MethodChip;
