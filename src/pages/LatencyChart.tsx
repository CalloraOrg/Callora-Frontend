import { useMemo } from "react";
import Breadcrumb from "../components/Breadcrumb";
import HelpPopover from "../components/HelpPopover";

type LatencyPoint = {
  label: string;
  value: number;
  timestamp: Date;
};

const MOCK_DATA: LatencyPoint[] = [
  { label: "00:00", value: 120, timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  { label: "01:00", value: 115, timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000) },
  { label: "02:00", value: 95, timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000) },
  { label: "03:00", value: 88, timestamp: new Date(Date.now() - 21 * 60 * 60 * 1000) },
  { label: "04:00", value: 92, timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000) },
  { label: "05:00", value: 105, timestamp: new Date(Date.now() - 19 * 60 * 60 * 1000) },
  { label: "06:00", value: 145, timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000) },
  { label: "07:00", value: 160, timestamp: new Date(Date.now() - 17 * 60 * 60 * 1000) },
  { label: "08:00", value: 210, timestamp: new Date(Date.now() - 16 * 60 * 60 * 1000) },
  { label: "09:00", value: 195, timestamp: new Date(Date.now() - 15 * 60 * 60 * 1000) },
  { label: "10:00", value: 180, timestamp: new Date(Date.now() - 14 * 60 * 60 * 1000) },
  { label: "11:00", value: 175, timestamp: new Date(Date.now() - 13 * 60 * 60 * 1000) },
  { label: "12:00", value: 185, timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) },
  { label: "13:00", value: 170, timestamp: new Date(Date.now() - 11 * 60 * 60 * 1000) },
  { label: "14:00", value: 168, timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000) },
  { label: "15:00", value: 165, timestamp: new Date(Date.now() - 9 * 60 * 60 * 1000) },
  { label: "16:00", value: 190, timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000) },
  { label: "17:00", value: 200, timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000) },
  { label: "18:00", value: 195, timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000) },
  { label: "19:00", value: 175, timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) },
  { label: "20:00", value: 155, timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000) },
  { label: "21:00", value: 140, timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) },
  { label: "22:00", value: 130, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { label: "23:00", value: 125, timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
  { label: "Now", value: 120, timestamp: new Date() },
];

function computeStats(data: LatencyPoint[]) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const sorted = [...values].sort((a, b) => a - b);
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  const p95 = sorted[Math.max(0, p95Index)];
  return { min, max, avg, p95 };
}

export default function LatencyChart() {
  const stats = useMemo(() => computeStats(MOCK_DATA), []);
  const maxValue = useMemo(() => Math.max(...MOCK_DATA.map((d) => d.value)), []);

  return (
    <div className="latency-chart-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          {
            label: "Latency",
            href: "/latency-chart",
            isCurrent: true,
          },
        ]}
      />

      <div className="surface latency-chart-surface">
        <div className="latency-chart-header">
          <div className="latency-chart-title-group">
            <h1>Latency</h1>
            <HelpPopover
              content={
                <span>
                  <strong style={{ display: "block", marginBottom: "0.25rem" }}>
                    P95 Latency
                  </strong>
                  <span style={{ display: "block" }}>
                    The 95th percentile response time. 95% of requests complete
                    faster than this value; the remaining 5% are slower.
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: "0.25rem",
                      opacity: 0.85,
                    }}
                  >
                    Lower is better — aim for under 200 ms for a smooth
                    experience.
                  </span>
                </span>
              }
              ariaLabel="Help: What is P95 latency?"
            />
          </div>
          <span className="latency-chart-subtitle">Last 24 hours</span>
        </div>

        <div className="latency-stats-grid">
          <div className="latency-stat-card">
            <span className="latency-stat-label">Min</span>
            <strong className="latency-stat-value tabular-nums">
              {stats.min} ms
            </strong>
          </div>
          <div className="latency-stat-card">
            <span className="latency-stat-label">Avg</span>
            <strong className="latency-stat-value tabular-nums">
              {stats.avg} ms
            </strong>
          </div>
          <div className="latency-stat-card">
            <span className="latency-stat-label">P95</span>
            <strong className="latency-stat-value tabular-nums">
              {stats.p95} ms
            </strong>
          </div>
          <div className="latency-stat-card">
            <span className="latency-stat-label">Max</span>
            <strong className="latency-stat-value tabular-nums">
              {stats.max} ms
            </strong>
          </div>
        </div>

        <div className="latency-chart-container" role="img" aria-label="Latency bar chart showing response times over the last 24 hours">
          <div className="latency-chart-bars">
            {MOCK_DATA.map((point, idx) => {
              const heightPct = (point.value / maxValue) * 100;
              const isHighest = point.value === maxValue;
              return (
                <div
                  key={idx}
                  className={`latency-chart-bar-wrapper`}
                  style={{ flex: 1 }}
                >
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

        <p className="latency-chart-caption">
          Bars represent sampled response times. The tallest bar marks the
          highest observed latency in the window.
        </p>
      </div>
    </div>
  );
}
