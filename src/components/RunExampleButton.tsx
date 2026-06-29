/**
 * RunExampleButton.tsx
 *
 * Accessible 'Run example' button for the API detail page.
 * Sends a mock request to the example endpoint and displays the response.
 */

import React, { useId, useState } from 'react';

export interface RunExampleConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  exampleBody?: Record<string, unknown>;
}

interface RunExampleButtonProps {
  config: RunExampleConfig;
  onResult?: (result: unknown) => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export function RunExampleButton({ config, onResult }: RunExampleButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<string | null>(null);
  const resultId = useId();

  const handleRun = async () => {
    setStatus('loading');
    setResult(null);
    try {
      const options: RequestInit = {
        method: config.method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      };
      if (config.exampleBody && config.method !== 'GET') {
        options.body = JSON.stringify(config.exampleBody);
      }
      const res = await fetch(config.endpoint, options);
      const data = await res.json().catch(() => ({ status: res.status }));
      setResult(JSON.stringify(data, null, 2));
      setStatus('success');
      onResult?.(data);
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Request failed');
      setStatus('error');
    }
  };

  const label =
    status === 'loading' ? 'Running…' :
    status === 'success' ? 'Run again' :
    'Run example';

  return (
    <div>
      <button
        type="button"
        onClick={handleRun}
        disabled={status === 'loading'}
        aria-busy={status === 'loading'}
        aria-controls={result ? resultId : undefined}
        style={{
          padding: '8px 18px',
          borderRadius: 6,
          border: 'none',
          background: status === 'error' ? '#e74c3c' : '#7ee8a2',
          color: '#111',
          fontWeight: 600,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          opacity: status === 'loading' ? 0.7 : 1,
        }}
      >
        {label}
      </button>

      {result && (
        <pre
          id={resultId}
          role="region"
          aria-label="Example response"
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: '#111',
            borderRadius: 6,
            fontSize: 12,
            color: status === 'error' ? '#f08080' : '#a8ff78',
            overflowX: 'auto',
            maxHeight: 300,
          }}
        >
          {result}
        </pre>
      )}
    </div>
  );
}
