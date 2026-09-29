import { useState, useRef, useCallback, useEffect } from 'react';
import type { CallRecord } from '../pages/ApiUsage';

export type ExportFormat = 'csv' | 'json';
export type ExportStatus = 'idle' | 'preparing' | 'exporting' | 'completed' | 'failed' | 'cancelled';

export interface ExportProgressState {
  status: ExportStatus;
  format: ExportFormat | null;
  progress: number;
  totalRecords: number;
  processedRecords: number;
  error: string | null;
  downloadUrl: string | null;
  fileName: string | null;
  lastFailedFormat: ExportFormat | null;
}

export interface UseExportHistoryOptions {
  accountId?: string;
  chunkSize?: number;
  chunkDelayMs?: number;
  simulateFailureOnFormat?: ExportFormat | null;
}

export function generateExportContent(
  records: CallRecord[],
  format: ExportFormat
): { content: string; mimeType: string; extension: string } {
  const data = records.map((call) => ({
    timestamp: call.timestamp instanceof Date ? call.timestamp.toISOString() : new Date(call.timestamp).toISOString(),
    endpoint: call.endpoint,
    status: call.status,
    responseTime: call.responseTime,
    cost: call.cost,
  }));

  if (format === 'json') {
    return {
      content: JSON.stringify(data, null, 2),
      mimeType: 'application/json',
      extension: 'json',
    };
  }

  const csv = [
    'Timestamp,Endpoint,Status,Response Time,Cost',
    ...data.map(
      (call) => [call.timestamp, call.endpoint, call.status, call.responseTime, call.cost].join(',')
    ),
  ].join('\n');

  return {
    content: csv,
    mimeType: 'text/csv',
    extension: 'csv',
  };
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function useExportHistory(records: CallRecord[], options: UseExportHistoryOptions = {}) {
  const {
    accountId = 'default',
    chunkSize = 100,
    chunkDelayMs = 20,
    simulateFailureOnFormat = null,
  } = options;

  const [state, setState] = useState<ExportProgressState>({
    status: 'idle',
    format: null,
    progress: 0,
    totalRecords: 0,
    processedRecords: 0,
    error: null,
    downloadUrl: null,
    fileName: null,
    lastFailedFormat: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentJobIdRef = useRef<number>(0);
  const activeBlobUrlRef = useRef<string | null>(null);
  const previousAccountRef = useRef<string>(accountId);

  const cleanupUrl = useCallback(() => {
    if (activeBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      } catch {
        // ignore
      }
      activeBlobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (previousAccountRef.current !== accountId) {
      previousAccountRef.current = accountId;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      cleanupUrl();
      currentJobIdRef.current++;
      setState({
        status: 'idle',
        format: null,
        progress: 0,
        totalRecords: 0,
        processedRecords: 0,
        error: null,
        downloadUrl: null,
        fileName: null,
        lastFailedFormat: null,
      });
    }
  }, [accountId, cleanupUrl]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cleanupUrl();
    };
  }, [cleanupUrl]);

  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cleanupUrl();
    currentJobIdRef.current++;
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      error: 'Export was cancelled by user.',
      downloadUrl: null,
      fileName: null,
    }));
  }, [cleanupUrl]);

  const startExport = useCallback(
    async (format: ExportFormat) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cleanupUrl();

      const jobId = ++currentJobIdRef.current;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const total = records.length;
      const fileName = 'call-history.' + format;

      setState({
        status: total === 0 ? 'completed' : 'exporting',
        format,
        progress: total === 0 ? 100 : 0,
        totalRecords: total,
        processedRecords: 0,
        error: null,
        downloadUrl: null,
        fileName,
        lastFailedFormat: null,
      });

      if (total === 0) {
        try {
          const { content, mimeType } = generateExportContent([], format);
          const blob = new Blob([content], { type: mimeType });
          triggerBrowserDownload(blob, fileName);
        } catch (err: any) {
          if (jobId !== currentJobIdRef.current) return;
          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: err?.message || 'Failed to generate empty export file.',
            lastFailedFormat: format,
          }));
        }
        return;
      }

      try {
        let processed = 0;
        const totalChunks = Math.ceil(total / chunkSize);

        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
          if (controller.signal.aborted || jobId !== currentJobIdRef.current) {
            return;
          }

          if (simulateFailureOnFormat === format && chunkIdx === Math.floor(totalChunks / 2)) {
            throw new Error('Export interrupted: network error while generating ' + format.toUpperCase() + ' payload.');
          }

          if (chunkDelayMs > 0) {
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                resolve();
              }, chunkDelayMs);
              controller.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            });
          }

          if (controller.signal.aborted || jobId !== currentJobIdRef.current) {
            return;
          }

          processed = Math.min(total, (chunkIdx + 1) * chunkSize);
          const currentProgress = Math.round((processed / total) * 100);

          setState((prev) => ({
            ...prev,
            progress: currentProgress,
            processedRecords: processed,
          }));
        }

        if (controller.signal.aborted || jobId !== currentJobIdRef.current) {
          return;
        }

        const { content, mimeType } = generateExportContent(records, format);
        const blob = new Blob([content], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);
        activeBlobUrlRef.current = objectUrl;

        triggerBrowserDownload(blob, fileName);

        if (jobId !== currentJobIdRef.current) return;

        setState({
          status: 'completed',
          format,
          progress: 100,
          totalRecords: total,
          processedRecords: total,
          error: null,
          downloadUrl: objectUrl,
          fileName,
          lastFailedFormat: null,
        });
      } catch (err: any) {
        if (jobId !== currentJobIdRef.current) return;
        if (err.name === 'AbortError') {
          return;
        }

        cleanupUrl();
        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: err.message || 'Export failed unexpectedly.',
          lastFailedFormat: format,
          downloadUrl: null,
        }));
      }
    },
    [records, chunkSize, chunkDelayMs, simulateFailureOnFormat, cleanupUrl]
  );

  const retryLastFailedExport = useCallback(() => {
    const targetFormat = state.lastFailedFormat || state.format || 'csv';
    return startExport(targetFormat);
  }, [state.lastFailedFormat, state.format, startExport]);

  const recoverDownload = useCallback(() => {
    if (state.status === 'failed' && state.lastFailedFormat) {
      return startExport(state.lastFailedFormat);
    }
    if (state.downloadUrl && state.fileName) {
      const a = document.createElement('a');
      a.href = state.downloadUrl;
      a.download = state.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [state.status, state.lastFailedFormat, state.downloadUrl, state.fileName, startExport]);

  const resetExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cleanupUrl();
    currentJobIdRef.current++;
    setState({
      status: 'idle',
      format: null,
      progress: 0,
      totalRecords: 0,
      processedRecords: 0,
      error: null,
      downloadUrl: null,
      fileName: null,
      lastFailedFormat: null,
    });
  }, [cleanupUrl]);

  return {
    ...state,
    isExporting: state.status === 'exporting' || state.status === 'preparing',
    isFailed: state.status === 'failed',
    isCompleted: state.status === 'completed',
    isCancelled: state.status === 'cancelled',
    startExport,
    cancelExport,
    retryLastFailedExport,
    recoverDownload,
    resetExport,
  };
}
