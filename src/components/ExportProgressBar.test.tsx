import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExportProgressBar from './ExportProgressBar';
import type { ExportProgressState } from '../hooks/useExportHistory';

describe('ExportProgressBar Component', () => {
  it('renders null when status is idle', () => {
    const state: ExportProgressState = {
      status: 'idle',
      format: null,
      progress: 0,
      totalRecords: 0,
      processedRecords: 0,
      error: null,
      downloadUrl: null,
      fileName: null,
      lastFailedFormat: null,
    };
    const { container } = render(<ExportProgressBar exportState={state} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders progress bar, record count, and cancel button during exporting', () => {
    const onCancel = vi.fn();
    const state: ExportProgressState = {
      status: 'exporting',
      format: 'csv',
      progress: 45,
      totalRecords: 100,
      processedRecords: 45,
      error: null,
      downloadUrl: null,
      fileName: 'call-history.csv',
      lastFailedFormat: null,
    };
    render(<ExportProgressBar exportState={state} onCancel={onCancel} />);

    expect(screen.getByText('Exporting CSV (45%)')).toBeInTheDocument();
    expect(screen.getByText('45 of 100 records processed')).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '45');

    const cancelBtn = screen.getByRole('button', { name: /Cancel export/i });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders error state with retry button on failure', () => {
    const onRetry = vi.fn();
    const state: ExportProgressState = {
      status: 'failed',
      format: 'json',
      progress: 20,
      totalRecords: 50,
      processedRecords: 10,
      error: 'Network error while streaming JSON payload.',
      downloadUrl: null,
      fileName: 'call-history.json',
      lastFailedFormat: 'json',
    };
    render(<ExportProgressBar exportState={state} onRetry={onRetry} />);

    expect(screen.getByText('Export Failed (JSON)')).toBeInTheDocument();
    expect(screen.getByText('Network error while streaming JSON payload.')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry Download/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders completed state with download recovery option', () => {
    const onRecover = vi.fn();
    const state: ExportProgressState = {
      status: 'completed',
      format: 'csv',
      progress: 100,
      totalRecords: 80,
      processedRecords: 80,
      error: null,
      downloadUrl: 'blob:http://localhost/mock-blob',
      fileName: 'call-history.csv',
      lastFailedFormat: null,
    };
    render(<ExportProgressBar exportState={state} onRecoverDownload={onRecover} />);

    expect(screen.getByText('Export Complete: call-history.csv')).toBeInTheDocument();
    expect(screen.getByText('80 records exported')).toBeInTheDocument();

    const downloadAgainBtn = screen.getByRole('button', { name: /Download Again/i });
    fireEvent.click(downloadAgainBtn);
    expect(onRecover).toHaveBeenCalledTimes(1);
  });
});
