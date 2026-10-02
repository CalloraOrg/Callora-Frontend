import React, { useEffect, useState, useRef } from "react";
import { useCompareStore, compareStore } from "../state/compareStore";
import type { APIItem } from "../data/mockApis";
import { formatPrice } from "../utils/format";
import RatingHistogram from "./RatingHistogram";
import { getPricePerCall, getAvgLatencyMs, getUptimePercent } from "../data/mockApis";
import "./CompareDrawer.css";

// ── Best-value helpers ────────────────────────────────────────────────────────

/**
 * Return the index of the best value in an array of optionally-undefined
 * numbers. Returns -1 when fewer than 2 defined values exist (no winner to
 * highlight).
 *
 * @param values - one entry per API column (undefined = missing)
 * @param prefer - "low" means the smallest value wins (price, latency)
 *                 "high" means the largest value wins (uptime, rating)
 */
function bestIndex(
  values: (number | undefined)[],
  prefer: "low" | "high"
): number {
  const defined = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== undefined);

  // Need at least 2 defined values to declare a winner
  if (defined.length < 2) return -1;

  const winner =
    prefer === "low"
      ? defined.reduce((a, b) => (b.v < a.v ? b : a))
      : defined.reduce((a, b) => (b.v > a.v ? b : a));

  return winner.i;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<NonNullable<APIItem["status"]>, string> = {
  operational: "Operational",
  degraded: "Degraded",
  maintenance: "Maintenance",
};

function StatusBadge({ status }: { status?: APIItem["status"] }) {
  if (!status) return <span className="compare-stat-value">—</span>;
  return (
    <span
      className={`compare-status-badge compare-status-badge--${status}`}
      aria-label={`Status: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompareDrawer() {
  const { apis, isOpen } = useCompareStore();
  const [announcement, setAnnouncement] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle ESC to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        compareStore.setOpen(false);
        drawerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const handleRemove = (id: string, name: string) => {
    compareStore.removeApi(id);
    setAnnouncement(`Removed ${name} from comparison.`);
    setTimeout(() => setAnnouncement(""), 3000);
  };

  const handleClear = () => {
    compareStore.clear();
    setAnnouncement("Cleared all comparison items.");
    setTimeout(() => setAnnouncement(""), 3000);
  };

  if (!isOpen) return null;

  // ── Derive effective price per column ──────────────────────────────────────
  // Use pricePerCall when defined, fall back to pricePerRequest (always present).
  const effectivePrices: (number | undefined)[] = apis.map(
    (api) => api.pricePerCall ?? api.pricePerRequest
  );

  // ── Pre-compute best-value indices ─────────────────────────────────────────
  const bestPriceIdx = bestIndex(effectivePrices, "low");
  const bestLatencyIdx = bestIndex(
    apis.map((a) => a.avgLatencyMs),
    "low"
  );
  const bestUptimeIdx = bestIndex(
    apis.map((a) => a.uptimePercent),
    "high"
  );
  const bestRatingIdx = bestIndex(
    apis.map((a) => a.rating),
    "high"
  );

  return (
    <>
      <div aria-live="polite" className="skip-link">
        {announcement}
      </div>

      <div
        className="compare-drawer-overlay open"
        onClick={() => compareStore.setOpen(false)}
      >
        <div
          ref={drawerRef}
          className="compare-drawer open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compare-drawer-title"
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          <div className="compare-drawer-header">
            <h2 id="compare-drawer-title" className="compare-drawer-title">
              Compare APIs
            </h2>
            <div className="compare-drawer-actions">
              <button
                className="ghost-button"
                onClick={handleClear}
                aria-label="Clear all comparisons"
              >
                Clear
              </button>
<button
                className="close-button"
                onClick={() => compareStore.setOpen(false)}
                aria-label="Close drawer"
              >
                ✍
              </button>
            </div>
          </div>

          <div className="compare-drawer-content">
            {apis.length === 0 ? (
              <div className="compare-drawer-empty">
                Select APIs to compare them.
              </div>
            ) : (
              <div className="compare-grid">
{apis.map((api, colIdx) => {
                  const pricePerCall = getPricePerCall(api);
                  const avgLatencyMs = getAvgLatencyMs(api);
                  const uptimePercent = getUptimePercent(api);
                  return (
                  <div key={api.id} className="compare-column">
                    <button
                      className="compare-column-remove"
                      onClick={() => handleRemove(api.id, api.name)}
                      aria-label={`Remove ${api.name} from comparison`}
                    >
                      <span aria-hidden="true">✍</span>
                    </button>

                    <div className="compare-column-header">{api.name}</div>

                    {/* ── Price / call ─────────────────────────────────── */}
                    <div className="compare-stat">
                      <span className="compare-stat-label">Price / call</span>
<span
                        className={`compare-stat-value${colIdx === bestPriceIdx ? " compare-best-value" : ""}`}
                      >
                        {pricePerCall !== undefined ? `$${formatPrice(pricePerCall)}` : "—"}
                        {colIdx === bestPriceIdx && (
                          <span className="compare-best-label" aria-label="Best value">
                            Best value
                          </span>
                        )}
                      </span>
                      </span>
                    </div>

                    {/* ── Latency ──────────────────────────────────────── */}
                    <div className="compare-stat">
                      <span className="compare-stat-label">Latency</span>
<span
                        className={`compare-stat-value${colIdx === bestLatencyIdx ? " compare-best-value" : ""}`}
                      >
                        {avgLatencyMs !== undefined ? `${avgLatencyMs} ms` : "—"}
                        {colIdx === bestLatencyIdx && (
                          <span className="compare-best-label" aria-label="Best value">
                            Best value
                          </span>
                        )}
                      </span>
                    </div>

                    {/* ── Uptime ───────────────────────────────────────── */}
                    <div className="compare-stat">
                      <span className="compare-stat-label">Uptime</span>
<span
                        className={`compare-stat-value${colIdx === bestUptimeIdx ? " compare-best-value" : ""}`}
                      >
                        {uptimePercent !== undefined
                          ? `${uptimePercent.toFixed(2)}%`
                          : "—"}
                        {colIdx === bestUptimeIdx && (
                          <span className="compare-best-label" aria-label="Best value">
                            Best value
                          </span>
                        )}
                      </span>
                    </div>

                    {/* ── Rating ───────────────────────────────────────── */}
                    <div className="compare-stat">
                      <span className="compare-stat-label">Rating</span>
                      <span
                        className={`compare-stat-value${colIdx === bestRatingIdx ? " compare-best-value" : ""}`}
                        style={{ display: "flex", alignItems: "center", gap: "8px" }}
                      >
                        {api.rating !== undefined ? (
                          <RatingHistogram
                            rating={api.rating}
                            distribution={api.ratingDistribution}
                          >
                            ⭐ {api.rating}
                          </RatingHistogram>
                        ) : (
                          "—"
                        )}
                        {colIdx === bestRatingIdx && (
                          <span className="compare-best-label" aria-label="Best value">
                            Best value
                          </span>
                        )}
                      </span>
                    </div>

                    {/* ── Status ───────────────────────────────────────── */}
                    <div className="compare-stat">
                      <span className="compare-stat-label">Status</span>
                      <StatusBadge status={api.status} />
                    </div>

                    {/* ── Category ─────────────────────────────────────── */}
                    <div className="compare-stat">
                      <span className="compare-stat-label">Category</span>
                      <span className="compare-stat-value">
                        {api.category ?? "—"}
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
