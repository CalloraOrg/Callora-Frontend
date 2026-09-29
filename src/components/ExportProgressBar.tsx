import React from 'react';
import type { ExportProgressState } from '../hooks/useExportHistory';

export interface ExportProgressBarProps {
  exportState: ExportProgressState;
  onCancel?: () => void;
  onRetry?: () => void;
  onRecoverDownload?: () => void;
  onDismiss?: () => void;
}

export function ExportProgressBar({
  exportState,
  onCancel,
  onRetry,
  onRecoverDownload,
  onDismiss,
}: ExportProgressBarProps) {
  const { status, format, progress, totalRecords, processedRecords, error, fileName } = exportState;

  if (status === 'idle') return null;

  const formatLabel = format ? format.toUpperCase() : 'FILE';
  const isExporting = status === 'exporting' || status === 'preparing';
  const isFailed = status === 'failed';
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';

  return (
    <div
      className='export-progress-panel'
      role='region'
      aria-label='Export progress'
      style={{
        marginTop: '12px',
        padding: '14px 16px',
        borderRadius: '8px',
        border: isFailed
          ? '1px solid var(--danger, #ef4444)'
          : isCompleted
          ? '1px solid var(--success, #10b981)'
          : '1px solid var(--line, rgba(255,255,255,0.15))',
        background: isFailed
          ? 'rgba(239, 68, 68, 0.08)'
          : isCompleted
          ? 'rgba(16, 185, 129, 0.08)'
          : 'var(--surface-soft, rgba(255,255,255,0.04))',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong style={{ fontSize: '0.875rem', color: 'var(--text, #f9fafb)' }}>
            {isExporting && ('Exporting ' + formatLabel + ' (' + progress + '%)')}
            {isCompleted && ('Export Complete: ' + (fileName || formatLabel))}
            {isFailed && ('Export Failed (' + formatLabel + ')')}
            {isCancelled && ('Export Cancelled (' + formatLabel + ')')}
          </strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted, #9ca3af)' }}>
            {isExporting && (processedRecords + ' of ' + totalRecords + ' records processed')}
            {isCompleted && (totalRecords + ' records exported')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isExporting && onCancel && (
            <button
              type='button'
              className='ghost-button'
              onClick={onCancel}
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              aria-label='Cancel export'
            >
              Cancel
            </button>
          )}
          {isFailed && onRetry && (
            <button
              type='button'
              className='secondary-button'
              onClick={onRetry}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              aria-label='Retry download'
            >
              Retry Download
            </button>
          )}
          {isCompleted && onRecoverDownload && (
            <button
              type='button'
              className='secondary-button'
              onClick={onRecoverDownload}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              aria-label='Download again'
            >
              Download Again
            </button>
          )}
          {(isCompleted || isFailed || isCancelled) && onDismiss && (
            <button
              type='button'
              className='ghost-button'
              onClick={onDismiss}
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              aria-label='Dismiss export notice'
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Accessible progress meter */}
      {isExporting && (
        <div
          role='progressbar'
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={'Exporting ' + formatLabel}
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '999px',
            background: 'var(--line, rgba(255,255,255,0.15))',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: progress + '%',
              height: '100%',
              background: 'var(--accent, #6366f1)',
              transition: 'width 0.15s ease-out',
            }}
          />
        </div>
      )}

      {(isFailed || isCancelled) && error && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: isFailed ? 'var(--danger, #ef4444)' : 'var(--muted, #9ca3af)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default ExportProgressBar;
