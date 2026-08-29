import { useEffect, useRef, useState } from 'react';
import { formatDuration, formatPrice, formatTimestamp } from '../utils/format';

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

type CallHistoryRowProps = {
  call: CallRecord;
  isExpanded: boolean;
  onToggle: () => void;
};

export default function CallHistoryRow({ call, isExpanded, onToggle }: CallHistoryRowProps) {
  // Aria-live polite announcement for status changes (WCAG 4.1.3)
  const [announcement, setAnnouncement] = useState('');
  const previousStatusRef = useRef(call.status);

  useEffect(() => {
    if (previousStatusRef.current !== call.status) {
      setAnnouncement(`Call status updated to ${call.status}.`);
      previousStatusRef.current = call.status;
    }
  }, [call.status]);

  return (
    <div className="table-row" role="row">
      <span data-label="Timestamp">{formatTimestamp(call.timestamp)}</span>
      <span className="endpoint-cell" data-label="Endpoint">
        {call.endpoint}
      </span>
      <span className={`status-cell ${call.status}`} data-label="Status">
        {call.status === 'success' ? '✓' : '✗'} {call.status}
      </span>
      <span data-label="Response Time">{formatDuration(call.responseTime)}</span>
      <span data-label="Cost">{formatPrice(call.cost)} USDC</span>
      <span data-label="Actions">
        <button
          className="ghost-button"
          aria-expanded={isExpanded}
          aria-controls={`call-details-${call.id}`}
          onClick={onToggle}
        >
          {isExpanded ? 'Hide' : 'View'}
        </button>
      </span>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      {isExpanded && (
        <div className="expanded-details" id={`call-details-${call.id}`}>
          <div className="detail-section">
            <h4>Request</h4>
            <pre>{JSON.stringify(call.request || {}, null, 2)}</pre>
          </div>
          <div className="detail-section">
            <h4>Response</h4>
            <pre>{JSON.stringify(call.response || {}, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
