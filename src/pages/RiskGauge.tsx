import { useCallback, useId, useState } from "react";
import EmptyState from "../components/EmptyState";
import useDocumentTitle from "../hooks/useDocumentTitle";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  reliability: number;
  security: number;
  compliance: number;
  latency: number;
  notes: string;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low Risk",
  moderate: "Moderate Risk",
  high: "High Risk",
  critical: "Critical Risk",
};

const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

function riskLevel(score: number): RiskLevel {
  if (score < 25) return "low";
  if (score < 50) return "moderate";
  if (score < 75) return "high";
  return "critical";
}

const ANGLE_RANGE = 240;
const ANGLE_OFFSET = -210;

function polar(angle: number, radius: number, cx: number, cy: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function GaugeArc({
  score,
  size = 160,
}: {
  score: number;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2 + 6;
  const r = size * 0.38;
  const strokeW = size * 0.08;
  const level = riskLevel(score);
  const color = RISK_COLORS[level];

  const angle = ANGLE_OFFSET + (score / 100) * ANGLE_RANGE;
  const start = polar(ANGLE_OFFSET, r, cx, cy);
  const end = polar(angle, r, cx, cy);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Risk score: ${score} out of 100, ${RISK_LABELS[level]}`}
      style={{ display: "block" }}
    >
      {/* Background arc */}
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${polar(ANGLE_OFFSET + ANGLE_RANGE, r, cx, cy).x} ${polar(ANGLE_OFFSET + ANGLE_RANGE, r, cx, cy).y}`}
        stroke="var(--line)"
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
        opacity="0.25"
      />
      {/* Filled arc */}
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${angle > 0 ? 0 : 0} 1 ${end.x} ${end.y}`}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
      />
      {/* Score text */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text)"
        fontSize={size * 0.2}
        fontWeight="700"
        fontFamily="var(--font-family)"
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + size * 0.1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size * 0.065}
        fontWeight="600"
        fontFamily="var(--font-family)"
      >
        {RISK_LABELS[level]}
      </text>
    </svg>
  );
}

function MetricRow({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min(Math.max(value, 0), max);
  const barPct = (pct / max) * 100;
  const id = useId();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span
        id={id}
        style={{
          width: "90px",
          flexShrink: 0,
          color: "var(--muted)",
          fontSize: "0.8125rem",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <div
        role="progressbar"
        aria-labelledby={id}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={`${label}: ${pct} out of ${max}`}
        style={{
          flex: 1,
          height: "8px",
          borderRadius: "4px",
          background: "var(--line)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${barPct}%`,
            height: "100%",
            borderRadius: "4px",
            background: pct >= 75 ? "var(--danger)" : pct >= 50 ? "var(--warning)" : "var(--accent)",
            transition: "width 400ms ease",
          }}
        />
      </div>
      <span
        style={{
          width: "48px",
          textAlign: "right",
          color: "var(--text)",
          fontSize: "0.875rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pct}
      </span>
    </div>
  );
}

export default function RiskGaugePage() {
  useDocumentTitle(
    "Risk Assessment – Callora",
    "Evaluate your API security, reliability, and compliance risk profile."
  );

  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);

  const runAssessment = useCallback(() => {
    setAssessment({
      score: 34,
      level: "moderate",
      reliability: 88,
      security: 72,
      compliance: 65,
      latency: 42,
      notes: "Overall API health is acceptable. Consider improving compliance documentation and monitoring endpoint latency.",
    });
  }, []);

  const clearAssessment = useCallback(() => {
    setAssessment(null);
  }, []);

  return (
    <div
      className="risk-gauge-page"
      style={{ padding: "clamp(16px, 4vw, 32px) 0" }}
    >
      <header style={{ marginBottom: "32px", padding: "0 4px" }}>
        <p className="eyebrow">API Risk Profile</p>
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: "700",
            color: "var(--text)",
          }}
        >
          Risk Assessment
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "1rem",
            color: "var(--muted)",
            lineHeight: "1.65",
            maxWidth: "600px",
          }}
        >
          Evaluate your API&apos;s security, reliability, and compliance posture.
          Run an assessment to identify areas for improvement.
        </p>
      </header>

      {assessment === null ? (
        <section
          className="surface"
          aria-labelledby="risk-gauge-empty-heading"
          style={{ borderRadius: "16px", overflow: "hidden" }}
        >
          <EmptyState
            variant="risk-gauge"
            title="No risk data yet"
            message="Run a risk assessment to evaluate your API's security, reliability, and compliance posture."
            action={{
              label: "Run assessment",
              onClick: runAssessment,
            }}
          />
        </section>
      ) : (
        <section
          className="surface"
          style={{
            borderRadius: "16px",
            padding: "clamp(20px, 3vw, 32px)",
            display: "grid",
            gap: "28px",
          }}
          aria-label="Risk assessment results"
        >
          {/* Gauge + Summary */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "24px",
              alignItems: "center",
            }}
          >
            <GaugeArc score={assessment.score} />
            <div style={{ flex: 1, minWidth: "200px" }}>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "0.9375rem",
                  color: "var(--muted)",
                  lineHeight: "1.6",
                }}
              >
                {assessment.notes}
              </p>
            </div>
          </div>

          {/* Metric breakdown */}
          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Breakdown
            </h2>
            <MetricRow label="Reliability" value={assessment.reliability} />
            <MetricRow label="Security" value={assessment.security} />
            <MetricRow label="Compliance" value={assessment.compliance} />
            <MetricRow label="Latency" value={assessment.latency} />
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              justifyContent: "flex-end",
              borderTop: "1px solid var(--line)",
              paddingTop: "20px",
            }}
          >
            <button
              type="button"
              className="ghost-button"
              onClick={clearAssessment}
              aria-label="Clear assessment results"
            >
              Clear results
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={runAssessment}
              aria-label="Re-run risk assessment"
            >
              Re-assess
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
