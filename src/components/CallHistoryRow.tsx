import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { formatPrice } from '../utils/format';

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

export default function CallHistoryRow({ call, expanded, onToggleExpand }: Props) {
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
        </div>
      )}
    </>
  );
}
