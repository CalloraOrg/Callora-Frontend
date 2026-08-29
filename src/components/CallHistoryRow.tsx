/**
 * CallHistoryRow — renders one row in the API call history table.
 *
 * When the optional `compareWith` prop is supplied the expanded "Response"
 * section switches from a plain JSON dump to a line-by-line diff view
 * showing additions (green), removals (red), and unchanged context lines.
 *
 * Accessibility
 * -------------
 * • Each diff line carries an aria-label of "Added: …" / "Removed: …" /
 *   "Unchanged: …" so screen-reader users receive the same information as
 *   sighted users.
 * • The diff table uses role="table" with column headers so the line-number
 *   gutter is announced correctly.
 * • All colours come from CSS custom properties so both light and dark themes
 *   are handled automatically.
 *
 * Design tokens (see src/styles/tokens.css and src/index.css)
 * ---------------
 * --diff-added-bg / --diff-added-fg / --diff-added-gutter-bg
 * --diff-removed-bg / --diff-removed-fg / --diff-removed-gutter-bg
 * --diff-unchanged-bg / --diff-unchanged-fg / --diff-unchanged-gutter-bg
 */

import { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { formatPrice } from '../utils/format';
import { diffJson, hasDifferences } from '../utils/diff';
import type { DiffLine } from '../utils/diff';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CallRecord = {
  id: string;
  timestamp: Date;
  endpoint: string;
  status: 'success' | 'error';
  responseTime: number;
  cost: number;
  request?: unknown;
  response?: unknown;
};

type Props = {
  call: CallRecord;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  /**
   * When provided, the expanded response section renders a diff against the
   * response of this second call instead of a plain JSON dump.
   *
   * The current `call` is treated as "before" (A); `compareWith` is "after" (B).
   */
  compareWith?: CallRecord;
  /**
   * tabIndex for the row's expand/collapse button. Virtualized tables use
   * roving tabindex (0 on the active row, -1 elsewhere) so only one row is
   * in the tab order at a time; defaults to 0 (normal button behavior).
   */
  viewButtonTabIndex?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Status icon using design tokens — no hardcoded hex values. */
function StatusIcon({ status }: { status: 'success' | 'error' }) {
  if (status === 'success') {
    return (
      <CheckCircle
        aria-hidden="true"
        size="var(--status-icon-size, 16px)"
        color="var(--status-success-icon-color)"
        data-testid="icon-success"
      />
    );
  }
  return (
    <XCircle
      aria-hidden="true"
      size="var(--status-icon-size, 16px)"
      color="var(--status-error-icon-color)"
      data-testid="icon-error"
    />
  );
}

/**
 * Renders a single diff line inside the diff table body.
 *
 * Sign prefix ("+"/"-"/" ") is included in the aria-label and visually via
 * the gutter cell so colour is never the only indicator (WCAG 1.4.1).
 */
function DiffLineRow({ line, index }: { line: DiffLine; index: number }) {
  const sign = line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' ';
  const ariaLabel = `${line.type === 'added' ? 'Added' : line.type === 'removed' ? 'Removed' : 'Unchanged'}: ${line.value}`;

  return (
    <tr
      className={`diff-line diff-line--${line.type}`}
      aria-label={ariaLabel}
      data-diff-type={line.type}
      key={index}
    >
      {/* Line number — "before" column */}
      <td
        className="diff-line__gutter diff-line__gutter--a"
        aria-hidden="true"
      >
        {line.lineA ?? ''}
      </td>
      {/* Line number — "after" column */}
      <td
        className="diff-line__gutter diff-line__gutter--b"
        aria-hidden="true"
      >
        {line.lineB ?? ''}
      </td>
      {/* Sign (+/-/ ) */}
      <td
        className="diff-line__sign"
        aria-hidden="true"
      >
        {sign}
      </td>
      {/* Line content */}
      <td className="diff-line__content">
        <code>{line.value}</code>
      </td>
    </tr>
  );
}

/**
 * Renders the diff view for two `response` values.
 *
 * When the responses are identical a short "No differences" notice is shown
 * instead of repeating all lines unchanged.
 */
function ResponseDiff({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const lines: DiffLine[] = diffJson(before, after);
  const hasChanges = hasDifferences(lines);

  if (!hasChanges) {
    return (
      <p className="diff-no-changes" role="status">
        Responses are identical — no differences found.
      </p>
    );
  }

  return (
    <div className="diff-wrapper" role="region" aria-label="Response diff">
      <table
        className="diff-table"
        role="table"
        aria-label="Line-by-line response diff"
      >
        <thead className="sr-only">
          <tr>
            <th scope="col">Line (before)</th>
            <th scope="col">Line (after)</th>
            <th scope="col">Change</th>
            <th scope="col">Content</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <DiffLineRow key={i} line={line} index={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CallHistoryRow({
  call,
  expanded,
  onToggleExpand,
  compareWith,
  viewButtonTabIndex = 0,
}: Props) {
  /**
   * Track whether the diff is showing "raw" or "diff" mode.
   * Diff mode is only relevant when `compareWith` is provided.
   * Defaults to 'diff' when a comparison target is set.
   */
  const [viewMode, setViewMode] = useState<'raw' | 'diff'>(
    compareWith ? 'diff' : 'raw',
  );

  // Keep viewMode in sync if compareWith is removed after mount
  const effectiveMode = compareWith ? viewMode : 'raw';

  // ── Aria-live announcement for status changes (Issue #683) ───────────────
  const [announcement, setAnnouncement] = useState('');
  const previousStatusRef = useRef(call.status);

  useEffect(() => {
    if (previousStatusRef.current !== call.status) {
      setAnnouncement(`Call status updated to ${call.status}.`);
      previousStatusRef.current = call.status;
    }
  }, [call.status]);

  return (
    <>
      <div className="table-row">
        <span>{formatTimestamp(call.timestamp)}</span>
        <span className="endpoint-cell">{call.endpoint}</span>
        {/* Status cell — icon + label; icon color driven by CSS custom properties */}
        <span
          className={`status-cell ${call.status}`}
          data-pattern={call.status === 'success' ? 'baseline' : 'stripes'}
          aria-label={call.status === 'success' ? 'Success' : 'Error'}
        >
          <StatusIcon status={call.status} />
          {call.status}
        </span>
        <span>{formatTime(call.responseTime)}</span>
        <span>{formatPrice(call.cost)} USDC</span>
        <span>
          <button
            className="ghost-button"
            onClick={() => onToggleExpand(call.id)}
            aria-expanded={expanded}
            aria-controls={`call-details-${call.id}`}
            tabIndex={viewButtonTabIndex}
          >
            {expanded ? 'Hide' : 'View'}
          </button>
        </span>
      </div>

      {/* Screen reader polite announcement for status changes (WCAG 4.1.3) */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      {expanded && (
        <div
          id={`call-details-${call.id}`}
          className="expanded-details"
          role="region"
          aria-label="Call details"
        >
          <div className="detail-section">
            <h4>Request</h4>
            <pre>{JSON.stringify(call.request ?? {}, null, 2)}</pre>
          </div>

          <div className="detail-section">
            {/* Header row: title + optional view-mode toggle */}
            <div className="detail-section__header">
              <h4>Response</h4>
              {compareWith && (
                <div
                  className="diff-mode-toggle"
                  role="group"
                  aria-label="Response view mode"
                >
                  <button
                    className={`ghost-button diff-mode-toggle__btn${effectiveMode === 'diff' ? ' diff-mode-toggle__btn--active' : ''}`}
                    aria-pressed={effectiveMode === 'diff'}
                    onClick={() => setViewMode('diff')}
                  >
                    Diff
                  </button>
                  <button
                    className={`ghost-button diff-mode-toggle__btn${effectiveMode === 'raw' ? ' diff-mode-toggle__btn--active' : ''}`}
                    aria-pressed={effectiveMode === 'raw'}
                    onClick={() => setViewMode('raw')}
                  >
                    Raw
                  </button>
                </div>
              )}
            </div>

            {effectiveMode === 'diff' && compareWith ? (
              // ── Diff view ─────────────────────────────────────────────────
              <>
                <div className="diff-call-labels" aria-hidden="true">
                  <span className="diff-call-label diff-call-label--a">
                    Before ({formatTimestamp(call.timestamp)})
                  </span>
                  <span className="diff-call-label diff-call-label--b">
                    After ({formatTimestamp(compareWith.timestamp)})
                  </span>
                </div>
                <ResponseDiff
                  before={call.response ?? {}}
                  after={compareWith.response ?? {}}
                />
              </>
            ) : (
              // ── Raw view (default when no compareWith) ─────────────────────
              <pre>{JSON.stringify(call.response ?? {}, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}
