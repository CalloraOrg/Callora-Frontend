import { useEffect, useRef, useState } from "react";
import { fetchApiDetail, isCatalogAbortError } from "../api/catalogApi";
import type { APIItem } from "../data/mockApis";
import StatusBadge, { apiStatusToVariant } from "../components/StatusBadge";
import type { Theme } from "../utils/userPrefs";

const VALID_THEMES = new Set<Theme>(["light", "dark", "system"]);

/**
 * Validates the `?theme=` query parameter for the embed route.
 * Accepts `light`, `dark`, or `system`; defaults to `system` for any other value.
 */
export function parseEmbedTheme(search: string): Theme {
  const raw = new URLSearchParams(search).get("theme");
  if (raw && VALID_THEMES.has(raw as Theme)) {
    return raw as Theme;
  }
  return "system";
}

function formatPrice(api: APIItem): string {
  if (api.pricingOnRequest) {
    return "Contact for pricing";
  }
  const price = api.pricePerRequest ?? api.pricePerCall ?? api.pricing ?? 0;
  if (price <= 0) {
    return "Free";
  }
  return `$${price.toFixed(price < 0.01 ? 4 : 2)} / req`;
}

type EmbedState =
  | { kind: "loading" }
  | { kind: "ready"; api: APIItem }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export interface EmbedApiProps {
  apiId: string;
}

/**
 * Chromeless embeddable API card served at `/embed/api/:id`.
 *
 * Posts its rendered height to the parent window via
 * `window.parent.postMessage({ type: "callora-embed-height", height }, "*")`
 * using ResizeObserver (when available). Never accepts inbound postMessage events.
 */
export default function EmbedApi({ apiId }: EmbedApiProps) {
  const trimmedId = apiId.trim();
  const [state, setState] = useState<EmbedState>(() =>
    trimmedId ? { kind: "loading" } : { kind: "not-found" },
  );
  const [retryToken, setRetryToken] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!trimmedId) {
      setState({ kind: "not-found" });
      return;
    }

    const controller = new AbortController();
    setState({ kind: "loading" });

    fetchApiDetail(trimmedId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.status === "ready") {
          setState({ kind: "ready", api: result.api });
        } else {
          setState({ kind: "not-found" });
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isCatalogAbortError(err)) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to load API details.";
        setState({ kind: "error", message });
      });

    return () => {
      controller.abort();
    };
  }, [trimmedId, retryToken]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const postHeight = () => {
      try {
        const rectHeight = el.getBoundingClientRect().height;
        const height = Math.ceil(rectHeight || el.scrollHeight || 0);
        window.parent?.postMessage(
          { type: "callora-embed-height", height },
          "*",
        );
      } catch {
        // Ignore postMessage failures in restricted contexts
      }
    };

    postHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      postHeight();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [state.kind]);

  return (
    <div
      ref={containerRef}
      className="embed-api-root"
      style={{
        padding: 12,
        background: "var(--bg-body, transparent)",
        color: "var(--text-main, inherit)",
        fontFamily:
          "var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
        boxSizing: "border-box",
      }}
    >
      {state.kind === "loading" && (
        <article
          role="status"
          aria-busy="true"
          aria-label="Loading API"
          style={cardStyle}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted, #6b7280)" }}>
            Loading API…
          </p>
        </article>
      )}

      {state.kind === "not-found" && (
        <article role="status" aria-label="API not found" style={cardStyle}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700 }}>
            API not found
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted, #6b7280)" }}>
            {trimmedId
              ? `We couldn't find an API matching "${trimmedId}".`
              : "No API identifier was provided."}
          </p>
        </article>
      )}

      {state.kind === "error" && (
        <article role="alert" style={cardStyle}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700 }}>
            Unable to load API
          </h1>
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: 13,
              color: "var(--muted, #6b7280)",
            }}
          >
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => setRetryToken((n) => n + 1)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid var(--border-subtle, #374151)",
              background: "var(--bg-subtle, transparent)",
              color: "var(--text-main, inherit)",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </article>
      )}

      {state.kind === "ready" && (
        <article aria-label={state.api.name} style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {state.api.name}
              </h1>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  color: "var(--muted, #6b7280)",
                }}
              >
                {state.api.provider.name}
              </div>
            </div>
            <StatusBadge status={apiStatusToVariant(state.api.status)} />
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px 16px",
              marginTop: 10,
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 600 }}>{formatPrice(state.api)}</span>
            {typeof state.api.rating === "number" && (
              <span
                aria-label={`Rating ${state.api.rating.toFixed(1)} out of 5`}
                style={{ color: "var(--muted, #6b7280)" }}
              >
                ★ {state.api.rating.toFixed(1)}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 14,
              paddingTop: 10,
              borderTop: "1px solid var(--border-subtle, rgba(128, 128, 128, 0.2))",
              fontSize: 12,
            }}
          >
            <span style={{ color: "var(--muted, #6b7280)" }}>
              Powered by Callora
            </span>
            <a
              href={`/details/${encodeURIComponent(state.api.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontWeight: 600,
                color: "var(--accent, #2563eb)",
                textDecoration: "none",
              }}
            >
              View on Callora
            </a>
          </div>
        </article>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 10,
  border: "1px solid var(--border-subtle, rgba(128, 128, 128, 0.25))",
  background: "var(--bg-card, var(--bg-soft, #ffffff))",
  color: "var(--text-main, inherit)",
  boxSizing: "border-box",
};
