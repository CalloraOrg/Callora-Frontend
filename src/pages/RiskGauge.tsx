import { useCallback, useId, useState, useRef, useEffect } from "react";
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
  evidenceTimestamp: number;
  staleAfterMs: number;
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
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${polar(ANGLE_OFFSET + ANGLE_RANGE, r, cx, cy).x} ${polar(ANGLE_OFFSET + ANGLE_RANGE, r, cx, cy).y}`}
        stroke="var(--line)"
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
        opacity="0.25"
      />
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${angle > 0 ? 0 : 0} 1 ${end.x} ${end.y}`}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
      />
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

type AssessmentStatus = "idle" | "loading" | "ready" | "error";

const STALE_AFTER_MS = 5 * 60 * 1000;

let riskAssessmentOverride: (() => Promise<RiskAssessment>) | null = null;

export function setRiskAssessmentOverride(fn: (() => Promise<RiskAssessment>) | null) {
  riskAssessmentOverride = fn;
}

export default function RiskGaugePage() {
  useDocumentTitle(
    "Risk Assessment – Callora",
    "Evaluate your API security, reliability, and compliance risk profile."
  );

  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [status, setStatus] = useState<AssessmentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isStale, setIsStale] = useState(false);

  const operationRef = useRef(0);
  const isMountedRef = useRef(true);
  const staleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (staleTimerRef.current !== null) {
        window.clearTimeout(staleTimerRef.current);
      }
    };
  }, []);

  const clearStaleTimer = useCallback(() => {
    if (staleTimerRef.current !== null) {
      window.clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, []);

  const scheduleStaleCheck = useCallback((timestamp: number, staleAfterMs: number) => {
    clearStaleTimer();
    const delay = Math.max(0, timestamp + staleAfterMs - Date.now());
    staleTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) {
        setIsStale(true);
      }
    }, delay);
  }, [clearStaleTimer]);

  const runAssessment = useCallback(() => {
    const thisOp = ++operationRef.current;
    clearStaleTimer();
    setIsStale(false);
    setErrorMessage("");
    setStatus("loading");

    const simulateApiCall = (): Promise<RiskAssessment> => {
      if (riskAssessmentOverride) {
        return riskAssessmentOverride();
      }
      return new Promise((resolve) => {
        window.setTimeout(() => {
          resolve({
            score: 34,
            level: "moderate",
            reliability: 88,
            security: 72,
            compliance: 65,
            latency: 42,
            notes: "Overall API health is acceptable. Consider improving compliance documentation and monitoring endpoint latency.",
            evidenceTimestamp: Date.now(),
            staleAfterMs: STALE_AFTER_MS,
          });
        }, 800);
      });
    };

    simulateApiCall()
      .then((result) => {
        if (!isMountedRef.current || thisOp !== operationRef.current) return;
        setAssessment(result);
        setStatus("ready");
        scheduleStaleCheck(result.evidenceTimestamp, result.staleAfterMs);
      })
      .catch((err) => {
        if (!isMountedRef.current || thisOp !== operationRef.current) return;
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Assessment failed. Please retry.");
      });
  }, [scheduleStaleCheck, clearStaleTimer]);

  const clearAssessment = useCallback(() => {
    clearStaleTimer();
    setIsStale(false);
    setAssessment(null);
    setStatus("idle");
    setErrorMessage("");
  }, [clearStaleTimer]);

  const handleRetry = useCallback(() => {
    runAssessment();
  }, [runAssessment]);

  const handleReassess = useCallback(() => {
    runAssessment();
  }, [runAssessment]);

  const effectiveStale = status === "ready" && isStale;
  const showEmpty = status === "idle" || status === "error";
  const showLoading = status === "loading";
  const showResults = status === "ready" && !isStale;
  const showStaleWarning = effectiveStale;

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

      {showEmpty && status === "idle" ? (
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
      ) : showLoading ? (
        <section
          className="surface"
          aria-labelledby="risk-gauge-loading-heading"
          style={{
            borderRadius: "16px",
            overflow: "hidden",
            padding: "clamp(20px, 3vw, 32px)",
          }}
        >
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading risk assessment"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "48px 24px",
              color: "var(--muted)",
              fontSize: "0.9375rem",
            }}
          >
            <span
              className="button-spinner"
              aria-hidden="true"
            />
            Assessing API risk…
          </div>
        </section>
      ) : status === "error" ? (
        <section
          className="surface"
          aria-labelledby="risk-gauge-error-heading"
          style={{
            borderRadius: "16px",
            overflow: "hidden",
            padding: "clamp(20px, 3vw, 32px)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              Assessment failed
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.9375rem",
                color: "var(--muted)",
                maxWidth: "480px",
              }}
            >
              {errorMessage}
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button
                type="button"
                className="primary-button"
                onClick={handleRetry}
                aria-label="Retry risk assessment"
              >
                Retry
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={clearAssessment}
                aria-label="Clear and start over"
              >
                Clear
              </button>
            </div>
          </div>
        </section>
      ) : showResults && assessment !== null ? (
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
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  opacity: 0.7,
                }}
              >
                Evidence collected{" "}
                {new Date(assessment.evidenceTimestamp).toLocaleString()}
              </p>
            </div>
          </div>

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
              onClick={handleReassess}
              aria-label="Re-run risk assessment"
            >
              Re-assess
            </button>
          </div>
        </section>
      ) : showStaleWarning && assessment !== null ? (
        <section
          className="surface"
          style={{
            borderRadius: "16px",
            padding: "clamp(20px, 3vw, 32px)",
            display: "grid",
            gap: "28px",
          }}
          aria-label="Stale risk assessment results"
        >
          <div
            role="alert"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "20px",
              borderRadius: "12px",
              background: "color-mix(in srgb, var(--warning) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--warning)",
              }}
            >
              Evidence expired — results are stale
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.9375rem",
                color: "var(--muted)",
                lineHeight: "1.6",
              }}
            >
              The evidence backing this assessment is older than{" "}
              {Math.round(assessment.staleAfterMs / 60000)} minutes. Re-run the
              assessment for current risk data.
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button
                type="button"
                className="primary-button"
                onClick={handleReassess}
                aria-label="Re-run risk assessment with fresh evidence"
              >
                Re-assess now
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={clearAssessment}
                aria-label="Dismiss stale results"
              >
                Dismiss
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "24px",
              alignItems: "center",
              opacity: 0.7,
            }}
            aria-hidden="true"
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
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  opacity: 0.7,
                }}
              >
                Evidence collected{" "}
                {new Date(assessment.evidenceTimestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
