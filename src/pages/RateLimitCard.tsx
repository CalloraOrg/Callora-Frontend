import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { fetchCatalog, isCatalogAbortError } from "../api/catalogApi";
import type { APIItem } from "../data/mockApis";
import "./RateLimitCard.css";

/**
 * RateLimitCard – per-API rate limits at `/marketplace/:apiId/rate-limits`.
 *
 * The API is resolved from the catalogue (`fetchCatalog`) and the table is
 * built from `api.rateLimits`. Optional columns (burst, concurrent
 * connections) render only when at least one tier publishes that field.
 */

/** Rate-limit tier shape used in the table below. */
export type RateLimitTier = NonNullable<APIItem["rateLimits"]>[number];

/** Maximum characters before a crumb label is shortened with a middle-ellipsis. */
const BREADCRUMB_MAX_LABEL = 28;

/** Pattern class and description for each plan tier (color-blind safe). */
export const PLAN_PATTERNS: Record<string, { class: string; description: string }> = {
  Free: { class: "free", description: "solid baseline" },
  Developer: { class: "developer", description: "dot pattern" },
  Pro: { class: "pro", description: "diagonal stripes" },
  Enterprise: { class: "enterprise", description: "crosshatch pattern" },
};

export type RateLimitCardProps = {
  /** API id to show; defaults to the `:apiId` route parameter. */
  apiId?: string;
  /** Currently active plan tier (e.g. "Pro" or "Developer"). */
  currentPlan?: string;
  /** Force mobile card view (defaults to window viewport query < 640px). */
  isMobile?: boolean;
};

/** Fallback pattern for plan names without a dedicated texture. */
const DEFAULT_PATTERN = { class: "custom", description: "plain fill" };

function patternFor(plan: string) {
  return PLAN_PATTERNS[plan] ?? DEFAULT_PATTERN;
}

const numberFormat = new Intl.NumberFormat();

function formatLimit(value: number | undefined): string {
  return value === undefined ? "—" : numberFormat.format(value);
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; api: APIItem }
  | { status: "not-found" }
  | { status: "error" };

function useMediaQuery(query: string, maxPixelThreshold?: number): boolean {
  const evaluate = () => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function") {
      const mql = window.matchMedia(query);
      if (mql.matches) return true;
    }
    if (maxPixelThreshold !== undefined && typeof window.innerWidth === "number") {
      if (window.innerWidth > 0 && window.innerWidth < maxPixelThreshold) {
        return true;
      }
    }
    return false;
  };

  const [matches, setMatches] = useState<boolean>(evaluate);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => setMatches(evaluate());
    update();

    let mql: MediaQueryList | null = null;
    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia(query);
      if (mql.addEventListener) {
        mql.addEventListener("change", update);
      } else if ((mql as any).addListener) {
        (mql as any).addListener(update);
      }
    }

    window.addEventListener("resize", update);

    return () => {
      if (mql) {
        if (mql.removeEventListener) {
          mql.removeEventListener("change", update);
        } else if ((mql as any).removeListener) {
          (mql as any).removeListener(update);
        }
      }
      window.removeEventListener("resize", update);
    };
  }, [query, maxPixelThreshold]);

  return matches;
}

export default function RateLimitCard({
  apiId: propApiId,
  currentPlan,
  isMobile: isMobileProp,
}: RateLimitCardProps = {}) {
  const { apiId: routeApiId } = useParams<{ apiId: string }>();
  const apiId = propApiId ?? routeApiId;

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    setState({ status: "loading" });

    fetchCatalog(controller.signal)
      .then((apis) => {
        if (!isMounted) return;
        const found = apis.find((a) => a.id === apiId);
        setState(found ? { status: "ready", api: found } : { status: "not-found" });
      })
      .catch((err) => {
        if (!isMounted || isCatalogAbortError(err)) return;
        setState({ status: "error" });
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [apiId]);

  const api = state.status === "ready" ? state.api : null;

  useDocumentTitle(
    state.status === "loading"
      ? "Loading Rate Limits – Callora"
      : api
        ? `${api.name} Rate Limits – Callora`
        : state.status === "error"
          ? "Rate Limits Unavailable – Callora"
          : "API Not Found – Callora",
    api ? `Published rate-limit tiers for ${api.name}.` : "Per-API rate limits.",
  );

  const isViewportMobile = useMediaQuery("(max-width: 639px)", 640);
  const isMobile = isMobileProp !== undefined ? isMobileProp : isViewportMobile;

  if (state.status === "loading") {
    return (
      <div className="rate-limit-page" aria-busy="true">
        <div className="rate-limit-card">
          <p role="status" className="rate-limit-card-subtitle">
            Loading rate limits…
          </p>
        </div>
      </div>
    );
  }

  if (!api) {
    const isError = state.status === "error";
    return (
      <div className="rate-limit-page">
        <Breadcrumb
          items={[
            { label: "Marketplace", href: "/marketplace" },
            { label: isError ? "Rate Limits" : "API Not Found", href: "#", isCurrent: true },
          ]}
          maxLabelLength={BREADCRUMB_MAX_LABEL}
        />
        <section className="rate-limit-card" role="alert" aria-labelledby="rate-limit-unavailable-title">
          <div className="rate-limit-card-header">
            <h1 id="rate-limit-unavailable-title" className="rate-limit-card-title">
              {isError ? "Rate limits unavailable" : "API Not Found"}
            </h1>
            <p className="rate-limit-card-subtitle">
              {isError
                ? "We couldn't load the catalogue. Please try again later."
                : "The requested API could not be found in the catalogue."}
            </p>
          </div>
          <Link to="/marketplace">Back to Marketplace</Link>
        </section>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Marketplace", href: "/marketplace" },
    { label: api.name, href: `/details/${api.id}` },
    { label: "Rate Limits", href: `/marketplace/${api.id}/rate-limits`, isCurrent: true },
  ];

  const tiers: RateLimitTier[] = api.rateLimits ?? [];
  const hasBurst = tiers.some((t) => t.burstLimit !== undefined);
  const hasConcurrent = tiers.some((t) => t.concurrentConnections !== undefined);
  const tableLabel = `Rate limit tiers for ${api.name}`;

  const isCurrentPlan = (plan: string) =>
    Boolean(currentPlan && plan.toLowerCase() === currentPlan.toLowerCase());

  return (
    <div className="rate-limit-page">
      <Breadcrumb items={breadcrumbItems} maxLabelLength={BREADCRUMB_MAX_LABEL} />

      <div className="rate-limit-card">
        <div className="rate-limit-card-header">
          <h1 className="rate-limit-card-title">Rate Limit Configuration</h1>
          <p className="rate-limit-card-subtitle">{api.name}</p>
        </div>

        {tiers.length === 0 ? (
          <p className="rate-limit-note">This provider has not published rate limits.</p>
        ) : isMobile ? (
          <div className="rate-limit-cards" aria-label={tableLabel}>
            {tiers.map((tier) => {
              const isCurrent = isCurrentPlan(tier.plan);
              const pattern = patternFor(tier.plan);
              return (
                <div
                  key={tier.plan}
                  className={`rate-limit-plan-card ${isCurrent ? "rate-limit-plan-card--current" : ""}`}
                  {...(isCurrent ? { "aria-current": "true" } : {})}
                >
                  <div className="rate-limit-plan-card-header">
                    <div className="rate-limit-plan-title-group">
                      <span className={`rate-limit-badge ${pattern.class}`} data-pattern={pattern.description}>
                        {tier.plan}
                      </span>
                      <span className="rate-limit-pattern-desc">{pattern.description}</span>
                    </div>
                    {isCurrent && <span className="rate-limit-current-badge">Current plan</span>}
                  </div>

                  <dl className="rate-limit-plan-dl">
                    <div className="rate-limit-dl-row">
                      <dt title="Requests per minute">Requests/min</dt>
                      <dd>
                        <span className="rate-limit-number">{formatLimit(tier.requestsPerMinute)}</span>
                      </dd>
                    </div>
                    {hasBurst && (
                      <div className="rate-limit-dl-row">
                        <dt title="Burst limit">Burst</dt>
                        <dd>
                          <span className="rate-limit-number">{formatLimit(tier.burstLimit)}</span>
                        </dd>
                      </div>
                    )}
                    {hasConcurrent && (
                      <div className="rate-limit-dl-row">
                        <dt title="Concurrent connections">Concurrent</dt>
                        <dd>
                          <span className="rate-limit-number">{formatLimit(tier.concurrentConnections)}</span>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              );
            })}
          </div>
        ) : (
          <table className="rate-limit-table" aria-label={tableLabel}>
            <caption className="sr-only">{tableLabel}</caption>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Requests / min</th>
                {hasBurst && <th scope="col">Burst limit</th>}
                {hasConcurrent && <th scope="col">Concurrent connections</th>}
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => {
                const isCurrent = isCurrentPlan(tier.plan);
                const pattern = patternFor(tier.plan);
                return (
                  <tr key={tier.plan} {...(isCurrent ? { "aria-current": "true" } : {})}>
                    <td>
                      <div className="rate-limit-plan-cell">
                        <span className={`rate-limit-badge ${pattern.class}`} data-pattern={pattern.description}>
                          {tier.plan}
                        </span>
                        <span className="rate-limit-pattern-desc">{pattern.description}</span>
                        {isCurrent && <span className="rate-limit-current-badge">Current plan</span>}
                      </div>
                    </td>
                    <td>
                      <span className="rate-limit-number">{formatLimit(tier.requestsPerMinute)}</span>
                    </td>
                    {hasBurst && (
                      <td>
                        <span className="rate-limit-number">{formatLimit(tier.burstLimit)}</span>
                      </td>
                    )}
                    {hasConcurrent && (
                      <td>
                        <span className="rate-limit-number">{formatLimit(tier.concurrentConnections)}</span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tiers.length > 0 && (
          <p className="rate-limit-note">
            Limits reset on a rolling 60-second window. Burst allowance is
            consumed first; sustained throughput is governed by the per-minute
            quota.
          </p>
        )}
      </div>
    </div>
  );
}
