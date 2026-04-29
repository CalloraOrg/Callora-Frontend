import { useState } from 'react';
import ServerError from './ServerError';

/**
 * Demo page for ServerError component - used for screenshot capture and manual testing
 */
export default function ServerErrorDemo() {
  const [scenario, setScenario] = useState<'no-props' | 'with-retry' | 'with-requestid' | 'full'>('full');
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = async () => {
    setRetryCount((prev) => prev + 1);
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 1500));
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '16px' }}>ServerError Component Demo</h1>
        <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
          Use this page to test different scenarios and capture screenshots
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="secondary-button"
            onClick={() => setScenario('no-props')}
            style={{ opacity: scenario === 'no-props' ? 1 : 0.6 }}
          >
            No Props
          </button>
          <button
            className="secondary-button"
            onClick={() => setScenario('with-retry')}
            style={{ opacity: scenario === 'with-retry' ? 1 : 0.6 }}
          >
            With Retry
          </button>
          <button
            className="secondary-button"
            onClick={() => setScenario('with-requestid')}
            style={{ opacity: scenario === 'with-requestid' ? 1 : 0.6 }}
          >
            With Request ID
          </button>
          <button
            className="secondary-button"
            onClick={() => setScenario('full')}
            style={{ opacity: scenario === 'full' ? 1 : 0.6 }}
          >
            Full (Retry + Request ID)
          </button>
        </div>

        {retryCount > 0 && (
          <p style={{ marginTop: '16px', color: 'var(--accent-strong)' }}>
            Retry called {retryCount} time{retryCount > 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {scenario === 'no-props' && <ServerError />}

        {scenario === 'with-retry' && <ServerError onRetry={handleRetry} />}

        {scenario === 'with-requestid' && (
          <ServerError requestId="REF-2026-04-29-A7F3B2C1" />
        )}

        {scenario === 'full' && (
          <ServerError
            onRetry={handleRetry}
            requestId="REF-2026-04-29-A7F3B2C1"
          />
        )}
      </div>

      <div style={{ marginTop: '60px', padding: '24px', background: 'var(--surface-soft)', borderRadius: '12px' }}>
        <h3 style={{ marginTop: 0 }}>Screenshot Checklist</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>Desktop (1280px): No props, With retry, With request ID, Full</li>
          <li>Mobile (390px): Full scenario with all features</li>
          <li>Loading state: Click retry button and capture during "Retrying…" state</li>
          <li>Copy confirmation: Click "Copy" button and capture "Copied!" state</li>
        </ul>
      </div>
    </div>
  );
}
