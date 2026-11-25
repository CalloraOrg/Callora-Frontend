import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import HelpPopover from "../components/HelpPopover";
import { downsampleLatencyData, type LatencyPoint } from "../utils/downsample";
import { useFetchTracker } from "../hooks/useFetchTracker";
import EmptyState from "../components/EmptyState";
import {
  fetchLatencySeries,
  getDemoLatencyData,
  isLatencyAbortError,
  isLatencyDemoMode,
  type LatencyRange,
} from "../api/latencyApi";

function computeStats(data: LatencyPoint[]) {
  if (data.length === 0) return { min: 0, max: 0, avg: 0, p95: 0 };
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const sorted = [...values].sort((a, b) => a - b);
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  const p95 = sorted[Math.max(0, p95Index)];
  return { min, max, avg, p95 };
}

export function useLatencyData(apiId: string, range: LatencyRange = "24h") {
  const demoMode = isLatencyDemoMode();

  const [state, setState] = useState<{
    data: LatencyPoint[];
    serverP95: number | undefined;
    isLoading: boolean;
    isError: boolean;
    isStale: boolean;
    isSampleData: boolean;
  }>(() => ({
    data: demoMode ? getDemoLatencyData() : [],
    serverP95: undefined,
    isLoading: !demoMode && Boolean(apiId),
    isError: false,
    isStale: false,
    isSampleData: demoMode,
  }));

  const { trackFetch } = useFetchTracker();
  const generationRef = useRef(0);
  const [retryCounter, setRetryCounter] = useState(0);

  const retry = useCallback(() => setRetryCounter((c) => c + 1), []);

  useEffect(() => {
    if (isLatencyDemoMode()) {
      setState({
        data: getDemoLatencyData(),
        serverP95: undefined,
        isLoading: false,
        isError: false,
        isStale: false,
        isSampleData: true,
      });
      return;
    }

    if (!apiId) {
      setState({
        data: [],
        serverP95: undefined,
        isLoading: false,
        isError: false,
        isStale: false,
        isSampleData: false,
      });
      return;
    }

    generationRef.current += 1;
    const currentGen = generationRef.current;
    const abortController = new AbortController();

    setState((prev) => ({
      ...prev,
      isLoading: prev.data.length === 0,
      isStale: prev.data.length > 0,
      isError: false,
      isSampleData: false,
    }));

    trackFetch(
      fetchLatencySeries({
        apiId,
        range,
        signal: abortController.signal,
      }),
    )
      .then((result) => {
        if (!abortController.signal.aborted && currentGen === generationRef.current) {
          setState({
            data: result.points,
            serverP95: result.p95,
            isLoading: false,
            isStale: false,
            isError: false,
            isSampleData: false,
          });
        }
      })
      .catch((err) => {
        if (abortController.signal.aborted || isLatencyAbortError(err)) {
          return;
        }
        if (currentGen === generationRef.current) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            isStale: false,
          }));
        }
      });

    return () => {
      generationRef.current += 1;
      abortController.abort();
    };
  }, [apiId, range, trackFetch, retryCounter]);

  return { ...state, retry };
}

export default function LatencyChart({ accountId }: { accountId?: string } = {}) {
  const [searchParams] = useSearchParams();
  const resolvedApiId = (accountId ?? searchParams.get("api") ?? "").trim();

  const { data, serverP95, isLoading, isError, isStale, isSampleData, retry } =
    useLatencyData(resolvedApiId);

  // Compute stats on the RAW data, not the downsampled peaks, so Min/Avg remain accurate.
  // Prefer the server-provided p95 when present.
  const stats = useMemo(() => {
    const computed = computeStats(data);
    return serverP95 !== undefined
      ? { ...computed, p95: Math.round(serverP95) }
      : computed;
  }, [data, serverP95]);

  // Downsample visually for the bars chart
  const visualData = useMemo(() => downsampleLatencyData(data, 12), [data]);
  const maxValue = useMemo(
    () => (visualData.length > 0 ? Math.max(...visualData.map((d) => d.value)) : 100),
    [visualData],
  );

  return (
    <div className="latency-chart-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Latency", href: "/latency-chart", isCurrent: true },
        ]}
      />

      <div className="surface latency-chart-surface">
        <div className="latency-chart-header">
          <div className="latency-chart-title-group">
            <h1>Latency</h1>
            {isSampleData && (
              <span className="latency-sample-badge" role="status">
                Sample data
              </span>
            )}
            <HelpPopover
              content={
                <span>
                  <strong style={{ display: "block", marginBottom: "0.25rem" }}>P95 Latency</strong>
                  <span style={{ display: "block" }}>
                    The 95th percentile response time. 95% of requests complete faster than this value; the remaining 5% are slower.
                  </span>
                  <span style={{ display: "block", marginTop: "0.25rem", opacity: 0.85 }}>
                    Lower is better — aim for under 200 ms for a smooth experience.
                  </span>
                </span>
              }
              ariaLabel="Help: What is P95 latency?"
            />
          </div>
          <span className="latency-chart-subtitle">Last 24 hours</span>
        </div>

        {!isSampleData && !resolvedApiId ? (
          <EmptyState
            variant="empty"
            title="No API Selected"
            message="Select an API (e.g. /latency-chart?api=<id>) to view its latency metrics."
          />
        ) : isError ? (
          <EmptyState
            variant="error"
            title="Failed to load latency data"
            message="There was an error loading the latency chart. Please try again."
            onRetry={retry}
          />
        ) : isLoading ? (
          <div className="latency-chart-skeleton" aria-live="polite" aria-busy="true">
            Loading latency data...
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            variant="empty"
            title="No Data"
            message="There is no latency data available for this API."
          />
        ) : (
          <>
            <div
              className={`latency-stats-grid ${isStale ? "latency-chart-stale" : ""}`}
              style={{ opacity: isStale ? 0.6 : 1 }}
            >
              <div className="latency-stat-card">
                <span className="latency-stat-label">Min</span>
                <strong className="latency-stat-value tabular-nums">{stats.min} ms</strong>
              </div>
              <div className="latency-stat-card">
                <span className="latency-stat-label">Avg</span>
                <strong className="latency-stat-value tabular-nums">{stats.avg} ms</strong>
              </div>
              <div className="latency-stat-card">
                <span className="latency-stat-label">P95</span>
                <strong className="latency-stat-value tabular-nums">{stats.p95} ms</strong>
              </div>
              <div className="latency-stat-card">
                <span className="latency-stat-label">Max</span>
                <strong className="latency-stat-value tabular-nums">{stats.max} ms</strong>
              </div>
            </div>

            <div
              className={`latency-chart-container ${isStale ? "latency-chart-stale" : ""}`}
              style={{ opacity: isStale ? 0.6 : 1 }}
              role="img"
              aria-label="Latency bar chart showing response times over the last 24 hours"
            >
              {isStale && (
                <div className="sr-only" aria-live="polite">
                  Updating chart data...
                </div>
              )}
              <div className="latency-chart-bars">
                {visualData.map((point, idx) => {
                  const heightPct = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
                  const isHighest = point.value === maxValue;
                  return (
                    <div key={idx} className="latency-chart-bar-wrapper" style={{ flex: 1 }}>
                      <div
                        className={`latency-chart-bar${isHighest ? " latency-chart-bar--peak" : ""}`}
                        style={{ height: `${heightPct}%` }}
                        title={`${point.label}: ${point.value} ms`}
                        role="img"
                        aria-label={`${point.label}: ${point.value} ms`}
                      />
                      <span className="latency-chart-bar-label">{point.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <p className="latency-chart-caption">
          Bars represent sampled response times. The tallest bar marks the highest observed latency in the window.
        </p>
      </div>
    </div>
  );
}
