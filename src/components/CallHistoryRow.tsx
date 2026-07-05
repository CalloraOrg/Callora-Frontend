import { CheckCircle, XCircle } from 'lucide-react';
import { formatPrice } from '../utils/format';
import { diffValues } from '../utils/diff';
import type { DiffEntry } from '../utils/diff';

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
  compareCall?: CallRecord;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
};

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

function formatDiffValue(value: unknown) {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  const json = JSON.stringify(value);
  return json ?? String(value);
}

function DiffValue({ label, value }: { label: string; value: unknown }) {
  return (
    <span className="response-diff__value">
      <span className="response-diff__value-label">{label}</span>
      <code>{formatDiffValue(value)}</code>
    </span>
  );
}

function ResponseDiff({ entries }: { entries: DiffEntry[] }) {
  return (
    <div className="response-diff" aria-label="Response diff against previous call">
      <h4>Response diff</h4>
      {entries.length === 0 ? (
        <p className="response-diff__empty">No response changes detected.</p>
      ) : (
        <ul className="response-diff__list">
          {entries.map(entry => (
            <li
              key={`${entry.kind}:${entry.path}`}
              className={`response-diff__row response-diff__row--${entry.kind}`}
            >
              <span className="response-diff__kind">{entry.kind}</span>
              <code className="response-diff__path">{entry.path}</code>
              {entry.kind !== 'added' && <DiffValue label="Before" value={entry.before} />}
              {entry.kind !== 'removed' && <DiffValue label="After" value={entry.after} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

export default function CallHistoryRow({ call, compareCall, expanded, onToggleExpand }: Props) {
  const responseDiff = compareCall ? diffValues(compareCall.response, call.response) : null;

  return (
    <>
      <div className="table-row">
        <span>{formatTimestamp(call.timestamp)}</span>
        <span className="endpoint-cell">{call.endpoint}</span>
        {/* Status cell — icon + label; icon color driven by CSS custom properties */}
        <span
          className={`status-cell ${call.status}`}
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
          >
            {expanded ? 'Hide' : 'View'}
          </button>
        </span>
      </div>
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
            <h4>Response</h4>
            <pre>{JSON.stringify(call.response ?? {}, null, 2)}</pre>
            {responseDiff && <ResponseDiff entries={responseDiff} />}
          </div>
        </div>
      )}
    </>
  );
}
