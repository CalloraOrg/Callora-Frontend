import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { fetchCatalog } from "../api/catalogApi";
import type { APIItem } from "../data/mockApis";

/**
 * RateLimitCard – per-API rate limits at `/marketplace/:apiId/rate-limits`.
 *
 * The API is resolved from the catalogue (`fetchCatalog`) and the table is
 * built from `api.rateLimits`. Optional columns (burst, concurrent
 * connections) render only when at least one tier publishes that field.
 */

type RateLimitTier = NonNullable<APIItem["rateLimits"]>[number];

type LoadState =
  | { status: "loading" }
  | { status: "ready"; api: APIItem }
  | { status: "not-found" }
  | { status: "error" };

/** Maximum characters before a crumb label is shortened with a middle-ellipsis. */
const BREADCRUMB_MAX_LABEL = 28;

/** Pattern class and description for known plan tiers (color-blind safe). */
const PLAN_PATTERNS: Record<string, { class: string; description: string }> = {
  Free: { class: "free", description: "solid baseline" },
  Developer: { class: "developer", description: "dot pattern" },
  Pro: { class: "pro", description: "diagonal stripes" },
  Enterprise: { class: "enterprise", description: "crosshatch pattern" },
};

const DEFAULT_PATTERN = { class: "custom", description: "outlined" };

export default function RateLimitCard() {
  const { apiId } = useParams<{ apiId: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchCatalog(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        const api = items.find((item) => item.id === apiId);
        setState(api ? { status: "ready", api } : { status: "not-found" });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [apiId]);

  const api = state.status === "ready" ? state.api : null;

  useDocumentTitle(
    api ? `${api.name} Rate Limits – Callora` : "Rate Limits – Callora",
    api
      ? `Published rate limits and throttling policies for ${api.name}.`
      : "Published rate limits and throttling policies for an API.",
  );

  const numberFormat = new Intl.NumberFormat();
  const tiers: RateLimitTier[] = api?.rateLimits ?? [];
  const showBurst = tiers.some((t) => t.burstLimit !== undefined);
  const showConcurrent = tiers.some((t) => t.concurrentConnections !== undefined);
  const formatValue = (value?: number) =>
    value === undefined ? "—" : numberFormat.format(value);

  const breadcrumbItems = api
    ? [
        { label: "Marketplace", href: "/marketplace" },
        { label: api.name, href: `/details/${encodeURIComponent(api.id)}` },
        {
          label: "Rate Limits",
          href: `/marketplace/${encodeURIComponent(api.id)}/rate-limits`,
          isCurrent: true,
        },
      ]
    : [
        { label: "Marketplace", href: "/marketplace" },
        { label: "Rate Limits", href: "#", isCurrent: true },
      ];

  return (
    <div className="rate-limit-page">
      <style>{`
        .rate-limit-page {
          padding: 0 32px 48px;
          max-width: 900px;
          margin: 0 auto;
        }

        .rate-limit-card {
          background: var(--surface);
          border: 1px solid var(--border, rgba(0, 0, 0, 0.10));
          border-radius: 12px;
          padding: 32px;
        }

        .rate-limit-card-header {
          margin-bottom: 24px;
        }

        .rate-limit-card-title {
          font-size: 1.375rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 6px;
        }

        .rate-limit-card-subtitle {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 0;
        }

        .rate-limit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .rate-limit-table thead th {
          text-align: left;
          padding: 10px 16px;
          color: var(--muted);
          font-weight: 600;
          border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.10));
          white-space: nowrap;
        }

        .rate-limit-table tbody td {
          padding: 12px 16px;
          color: var(--text);
          border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
        }

        .rate-limit-table tbody tr:last-child td {
          border-bottom: none;
        }

        .rate-limit-table tbody tr:hover td {
          background: var(--surface-raised, rgba(0, 0, 0, 0.025));
        }

        .rate-limit-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 99px;
          font-size: 0.75rem;
          font-weight: 600;
          background: var(--accent-muted, rgba(78, 133, 255, 0.12));
          color: var(--accent);
        }

        .rate-limit-note {
          margin-top: 20px;
          padding: 12px 16px;
          background: var(--surface-raised, rgba(0, 0, 0, 0.025));
          border-radius: 8px;
          font-size: 0.8125rem;
          color: var(--muted);
          line-height: 1.5;
        }
        .rate-limit-table caption {
          text-align: left;
          padding: 0 16px 10px;
          color: var(--muted);
          font-size: 0.8125rem;
        }
      `}</style>

      <Breadcrumb items={breadcrumbItems} maxLabelLength={BREADCRUMB_MAX_LABEL} />

      <div className="rate-limit-card">
        <div className="rate-limit-card-header">
          <h1 className="rate-limit-card-title">Rate Limit Configuration</h1>
          {api && <p className="rate-limit-card-subtitle">{api.name}</p>}
        </div>

        {state.status === "loading" && (
          <p role="status" aria-live="polite">
            Loading rate limits…
          </p>
        )}

        {state.status === "error" && (
          <div role="alert" className="rate-limit-note">
            Could not load rate limits. Please try again later.
          </div>
        )}

        {state.status === "not-found" && (
          <div role="alert" className="rate-limit-note" data-testid="rate-limit-not-found">
            <strong>API not found.</strong> We couldn't find an API with the id “{apiId}”.{" "}
            <Link to="/marketplace">Browse the Marketplace</Link>
          </div>
        )}

        {api && tiers.length === 0 && (
          <p className="rate-limit-note" data-testid="rate-limit-empty">
            This provider has not published rate limits.
          </p>
        )}

        {api && tiers.length > 0 && (
          <>
            <table className="rate-limit-table">
              <caption>Rate limit tiers for {api.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Requests / min</th>
                  {showBurst && <th scope="col">Burst limit</th>}
                  {showConcurrent && <th scope="col">Concurrent connections</th>}
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => {
                  const pattern = PLAN_PATTERNS[tier.plan] ?? DEFAULT_PATTERN;
                  return (
                    <tr key={tier.plan}>
                      <td>
                        <span
                          className={`rate-limit-badge ${pattern.class}`}
                          data-pattern={pattern.description}
                        >
                          {tier.plan}
                        </span>
                      </td>
                      <td>{formatValue(tier.requestsPerMinute)}</td>
                      {showBurst && <td>{formatValue(tier.burstLimit)}</td>}
                      {showConcurrent && <td>{formatValue(tier.concurrentConnections)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="rate-limit-note">
              Limits are published by the API provider. Contact the provider
              for custom limits.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
