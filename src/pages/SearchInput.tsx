/**
 * SearchInput — Interactive Search Input component with color-blind safe status chips
 * and tabular numeric formatting.
 *
 * GrantFox FWC26 campaign (Stellar Wave) requirement:
 * 1. Augment status indicators with subtle pattern overlays defined in src/styles/patterns.css
 *    so that SearchInput status chips are distinguishable to color-blind users by shape/texture
 *    as well as color, satisfying WCAG 2.1 AA (1.4.1 Use of Color).
 * 2. Apply font-variant-numeric: tabular-nums on amounts/counts in SearchInput so digits
 *    align vertically across light and dark themes.
 */

import { useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import type { StatusVariant } from '../components/StatusBadge';

export type SearchStatusFilter = StatusVariant | 'all';

export interface SearchInputProps {
  /** Current text query */
  value: string;
  /** Callback fired on input change */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Callback fired on Enter key or trigger button */
  onSearch?: () => void;
  /** Currently selected status filter chip */
  selectedStatus?: SearchStatusFilter;
  /** Callback fired when a status chip is toggled */
  onStatusChange?: (status: SearchStatusFilter) => void;
  /** List of status options to present as filter chips */
  statusOptions?: SearchStatusFilter[];
  /** Optional mapping of status filter to item count */
  statusCounts?: Partial<Record<SearchStatusFilter, number>>;
  /** Optional result count to display alongside the input */
  resultCount?: number;
  /** Optional total count display */
  totalCount?: number;
  /** Optional numeric amount value display */
  amount?: number;
  /** Optional custom class name */
  className?: string;
}

const DEFAULT_STATUS_OPTIONS: SearchStatusFilter[] = [
  'all',
  'operational',
  'degraded',
  'error',
  'pending',
];

const STATUS_LABELS: Record<SearchStatusFilter, string> = {
  all: 'All Statuses',
  operational: 'Operational',
  success: 'Operational',
  degraded: 'Degraded',
  warning: 'Degraded',
  error: 'Error',
  down: 'Down',
  pending: 'Pending',
  maintenance: 'Maintenance',
};

const PATTERN_KEYS: Record<SearchStatusFilter, string> = {
  all: 'none',
  operational: 'baseline',
  success: 'baseline',
  degraded: 'opposite-stripes',
  warning: 'opposite-stripes',
  error: 'stripes',
  down: 'stripes',
  pending: 'dots',
  maintenance: 'crosshatch',
};

const PATTERN_DESCRIPTIONS: Record<SearchStatusFilter, string> = {
  all: 'no pattern',
  operational: 'solid baseline',
  success: 'solid baseline',
  degraded: 'opposite diagonal stripes',
  warning: 'opposite diagonal stripes',
  error: 'diagonal stripes',
  down: 'diagonal stripes',
  pending: 'dot pattern',
  maintenance: 'crosshatch pattern',
};

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search APIs, status, keywords...',
  onSearch,
  selectedStatus = 'all',
  onStatusChange,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  statusCounts,
  resultCount,
  totalCount,
  amount,
  className = '',
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onChange('');
      inputRef.current?.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onSearch?.();
    }
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div
      className={['search-input-container', 'numeric-tabular', 'tabular-nums', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        width: '100%',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
        }}
        role="search"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ color: 'var(--text-secondary, #9ca3af)', flexShrink: 0 }}
        >
          <path
            d="M21 21l-4.35-4.35"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="11"
            cy="11"
            r="6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <input
          ref={inputRef}
          type="search"
          aria-label="Search query input"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="search-input-field tabular-nums numeric-tabular"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary, #f9fafb)',
            width: '100%',
            fontSize: '0.875rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        />

        {typeof amount === 'number' && (
          <span
            className="search-input-amount tabular-nums numeric-tabular"
            data-testid="search-amount-display"
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-primary, #f9fafb)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-chip, rgba(255, 255, 255, 0.05))',
            }}
          >
            ${amount.toLocaleString()}
          </span>
        )}

        {typeof resultCount === 'number' && (
          <span
            className="search-input-result-count tabular-nums numeric-tabular"
            data-testid="search-result-count"
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--text-secondary, #9ca3af)',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-chip, rgba(255, 255, 255, 0.05))',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </span>
        )}

        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search query"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              color: 'var(--text-secondary, #9ca3af)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {statusOptions.length > 0 && (
        <div
          className="search-status-chips"
          role="group"
          aria-label="Filter search by status"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          {statusOptions.map((st) => {
            const isSelected = selectedStatus === st;
            const label = STATUS_LABELS[st];
            const patternKey = PATTERN_KEYS[st];
            const patternDesc = PATTERN_DESCRIPTIONS[st];
            const patternClass = st === 'all' ? '' : `sb-pattern-${st} search-status-pattern-${st}`;

            const count =
              statusCounts?.[st] ??
              (st === 'all' ? (totalCount ?? statusCounts?.all) : undefined);

            return (
              <button
                key={st}
                type="button"
                aria-pressed={isSelected}
                aria-label={
                  count !== undefined
                    ? `Status filter: ${label} (${count})`
                    : `Status filter: ${label}`
                }
                aria-description={
                  st === 'all'
                    ? 'Show all status items'
                    : `Color-blind safe status chip: ${label} with ${patternDesc}`
                }
                data-status={st}
                data-pattern={patternKey}
                onClick={() => onStatusChange?.(st)}
                className={[
                  'search-status-chip',
                  'numeric-tabular',
                  'tabular-nums',
                  patternClass,
                  isSelected ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                  border: isSelected
                    ? '1.5px solid var(--accent-primary, #6366f1)'
                    : '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                  backgroundColor:
                    st === 'all'
                      ? isSelected
                        ? 'var(--bg-selected, rgba(99, 102, 241, 0.2))'
                        : 'var(--bg-chip, rgba(255, 255, 255, 0.05))'
                      : `var(--sb-${st}-bg, rgba(255, 255, 255, 0.05))`,
                  color:
                    st === 'all'
                      ? 'var(--text-primary, #f9fafb)'
                      : `var(--sb-${st}-fg, #f9fafb)`,
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 0 1px var(--accent-primary, #6366f1)' : 'none',
                }}
              >
                {st !== 'all' && (
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: '0.45em',
                      height: '0.45em',
                      borderRadius: '50%',
                      backgroundColor: `var(--sb-${st}-fg, currentColor)`,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span>{label}</span>
                {count !== undefined && (
                  <span
                    className="search-status-chip-count numeric-tabular tabular-nums"
                    data-testid={`search-status-count-${st}`}
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: '0.7rem',
                      opacity: 0.85,
                      marginLeft: '0.15rem',
                    }}
                  >
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SearchInput;

