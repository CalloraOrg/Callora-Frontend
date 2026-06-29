/**
 * WhyApi.tsx
 *
 * Accessible "Why this API?" rationale surfaced on the marketplace ApiCard.
 *
 * It derives a short, human-readable list of reasons an API was recommended
 * from the metrics already present on the {@link APIItem} (rating, uptime,
 * latency, price and category). The reasons are revealed through a native
 * disclosure pattern: a toggle button (`aria-expanded` + `aria-controls`)
 * controlling a region, so it is fully keyboard-operable and announced
 * correctly by screen readers (WCAG 2.1 AA).
 */

import { useId, useState } from "react";
import type { APIItem } from "../data/mockApis";

/** Build the list of recommendation reasons from the API's metrics. */
export function buildReasons(api: APIItem): string[] {
  const reasons: string[] = [];

  if (api.rating !== undefined && api.rating >= 4.5) {
    reasons.push(`Highly rated by developers (${api.rating.toFixed(1)} / 5)`);
  }
  if (api.uptimePercent !== undefined && api.uptimePercent >= 99.9) {
    reasons.push(`Reliable uptime (${api.uptimePercent.toFixed(2)}%)`);
  }
  if (api.avgLatencyMs !== undefined && api.avgLatencyMs <= 150) {
    reasons.push(`Fast responses (~${api.avgLatencyMs} ms average latency)`);
  }

  const price = api.pricePerCall ?? api.pricePerRequest;
  if (price !== undefined && price <= 0.005) {
    reasons.push("Cost-effective pricing per call");
  }
  if (api.category) {
    reasons.push(`Popular choice in ${api.category}`);
  }

  // Always provide at least one reason so the affordance is never empty.
  if (reasons.length === 0) {
    reasons.push("Matches your search and category filters");
  }
  return reasons;
}

interface WhyApiProps {
  api: APIItem;
}

export default function WhyApi({ api }: WhyApiProps) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const reasons = buildReasons(api);

  return (
    <div
      className="why-api"
      // Card is itself clickable; keep these interactions local to the disclosure.
      onClick={(e) => e.stopPropagation()}
      style={{ marginTop: 4 }}
    >
      <button
        type="button"
        className="why-api__toggle ghost-button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--accent)",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        Why this API?
      </button>

      {open && (
        <ul
          id={regionId}
          className="why-api__reasons"
          aria-label={`Why ${api.name} is recommended`}
          style={{
            margin: "6px 0 0",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {reasons.map((reason, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              <span aria-hidden="true" style={{ color: "var(--accent)" }}>
                ✓
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
