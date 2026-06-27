import React from 'react';
import { Icons } from '../utils/icons';
import './MethodChip.css';


type Props = {
  method: string;
};

// Mapping HTTP methods to colors (tailored for light/dark themes)
const METHOD_COLORS: Record<string, { bg: string; fg: string; icon: React.ReactNode }> = {
  GET: { bg: 'var(--method-get-bg)', fg: 'var(--method-get-fg)', icon: <Icons.Search size={14} /> },
  POST: { bg: 'var(--method-post-bg)', fg: 'var(--method-post-fg)', icon: <Icons.Mail size={14} /> },
  PUT: { bg: 'var(--method-put-bg)', fg: 'var(--method-put-fg)', icon: <Icons.Wrench size={14} /> },
  DELETE: { bg: 'var(--method-delete-bg)', fg: 'var(--method-delete-fg)', icon: <Icons.Trash size={14} /> },
  PATCH: { bg: 'var(--method-patch-bg)', fg: 'var(--method-patch-fg)', icon: <Icons.Edit size={14} /> },
};

export const MethodChip: React.FC<Props> = ({ method }) => {
  const upper = method.toUpperCase();
  const colors = METHOD_COLORS[upper] ?? {
    bg: 'var(--surface-soft)',
    fg: 'var(--text)',
    icon: <Icons.Search size={14} />,
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
      <span className="method-chip-icon" aria-hidden="true">
        {colors.icon}
      </span>
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
