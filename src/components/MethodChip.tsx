/**
 * MethodChip
 *
 * Renders a compact HTTP-method badge (GET, POST, PUT, DELETE, PATCH) with:
 *  - A method-appropriate icon (lucide-react via utils/icons)
 *  - Theme-aware colour tokens (--method-<verb>-bg / --method-<verb>-color)
 *  - A keyboard-accessible tooltip on focus/hover
 *
 * Responsive behaviour (GrantFox FWC26):
 *  - ≤375px ("narrow"): min-width drops from 68px → 52px; padding tightens to
 *    4px 6px to preserve legibility without overflowing cramped endpoint rows.
 *  - Touch tap target is padded to meet WCAG 2.1 AA §2.5.5 (44×44px minimum)
 *    via a pseudo-element overlay so the visual size stays compact.
 *  - Icon text overflow is clipped with an ellipsis rather than wrapping.
 *
 * Bug-fixes included in this revision:
 *  1. CSS custom-property names corrected: --method-<verb>-fg → --method-<verb>-color
 *     (matches the token definitions in src/index.css).
 *  2. Icon wrapper class corrected: method-chip-icon (was method-icon in CSS).
 */

import React, { useState } from 'react';
import { Icons } from '../utils/icons';
import './MethodChip.css';

/** Props accepted by MethodChip. */
export type MethodChipProps = {
  /**
   * The HTTP verb to display (case-insensitive).
   * Recognised values: GET | POST | PUT | DELETE | PATCH.
   * Any unrecognised value falls back to a neutral grey chip.
   */
  method: string;
};

/**
 * Map of recognised HTTP verbs to their design-token colour pairs and icons.
 *
 * FIX: foreground token suffix changed from `-fg` → `-color` to match the
 * token definitions in src/index.css (--method-get-color, not --method-get-fg).
 */
const METHOD_COLORS: Record<
  string,
  { bg: string; color: string; icon: React.ReactNode }
> = {
  GET: {
    bg: 'var(--method-get-bg)',
    color: 'var(--method-get-color)',
    icon: <Icons.Search size={14} aria-hidden="true" />,
  },
  POST: {
    bg: 'var(--method-post-bg)',
    color: 'var(--method-post-color)',
    icon: <Icons.Mail size={14} aria-hidden="true" />,
  },
  PUT: {
    bg: 'var(--method-put-bg)',
    color: 'var(--method-put-color)',
    icon: <Icons.Wrench size={14} aria-hidden="true" />,
  },
  DELETE: {
    bg: 'var(--method-delete-bg)',
    color: 'var(--method-delete-color)',
    icon: <Icons.Trash size={14} aria-hidden="true" />,
  },
  PATCH: {
    bg: 'var(--method-patch-bg)',
    color: 'var(--method-patch-color)',
    icon: <Icons.Edit size={14} aria-hidden="true" />,
  },
};

/**
 * MethodChip displays an HTTP-method badge with an icon, label, and an
 * accessible tooltip.
 *
 * @example
 * <MethodChip method="GET" />
 * <MethodChip method="delete" />  // case-insensitive
 */
export const MethodChip: React.FC<MethodChipProps> = ({ method }) => {
  const upper = method.toUpperCase();
  const colors = METHOD_COLORS[upper] ?? {
    bg: 'var(--surface-soft)',
    color: 'var(--text)',
    icon: <Icons.Search size={14} aria-hidden="true" />,
  };

  // Tooltip visibility state shared across pointer and keyboard interactions.
  const [showTooltip, setShowTooltip] = useState(false);

  /** Human-readable description used as aria-label and tooltip body. */
  const description = `${upper} request`;

  return (
    <span
      className="method-chip"
      /* FIX: use `color` (not `fg`) to match the renamed token map above */
      style={{ backgroundColor: colors.bg, color: colors.color }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="img"
      aria-label={description}
    >
      {/* FIX: class was "method-chip-icon" in JSX but "method-icon" in CSS.
          Both are now aligned to "method-chip-icon". */}
      <span className="method-chip-icon" aria-hidden="true">
        {colors.icon}
      </span>
      {/* Label text; overflow handled by CSS text-overflow: ellipsis */}
      <span className="method-chip-label">{upper}</span>

      {showTooltip && (
        <span className="method-tooltip" role="tooltip" id={`tooltip-${upper}`}>
          {description}
        </span>
      )}
    </span>
  );
};

export default MethodChip;
