import { CheckCircle, XCircle } from 'lucide-react';
import { formatPrice } from '../utils/format';
import { buildJsonDiff } from '../utils/diff';

export type CallRecord = {
  id: string;
  timestamp: Date;
  endpoint: string;
  status: 'success' | 'error';
  responseTime: number;
  cost: number;
  request?: unknown;
  response?: unknown;
  compareResponse?: unknown;
};

type Props = {
  call: CallRecord;
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

function ResponseDiff({ before, after }: { before: unknown; after: unknown }) {
  const lines = buildJsonDiff(before, after);

  return (
    <div className="detail-section" aria-label="Response diff">
      <h4>Response diff</h4>
      <pre>
        {lines.map((line, index) => {
          const prefix =
            line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';

          return (
            <span
              key={`${line.type}-${index}-${line.text}`}
              className={`diff-line ${line.type}`}
              data-testid={`diff-line-${line.type}`}
            >
              {prefix}
              {line.text}
              {'\n'}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

export default function CallHistoryRow({ call, expanded, onToggleExpand }: Props) {
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
          </div>
          {call.compareResponse !== undefined && (
            <ResponseDiff before={call.compareResponse} after={call.response ?? {}} />
          )}
        </div>
      )}
    </>
  );
}
