import { useEffect, useReducer, useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Skeleton from "../components/Skeleton";
import { StatusBadge, apiStatusToVariant } from "../components/StatusBadge";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { formatPrice } from "../utils/format";
import { apiUrl } from "../config/constants";
import type { APIItem } from "../data/mockApis";
import { isSignedIn, getAccessToken } from "../services/authService";
import KeyRotationModal from "./KeyRotationModal";
import LiveRegion from "../components/LiveRegion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Publish-review state for a provider's listed API. */
export type PublishStatus = "pending" | "live" | "rejected";

/** APIItem extended with the provider-side review state. */
export type PublishedApiItem = APIItem & { publishStatus?: PublishStatus };

type FetchState =
  | { status: "loading" }
  | { status: "success"; apis: PublishedApiItem[] }
  | { status: "error"; error: string };

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; apis: PublishedApiItem[] }
  | { type: "FETCH_ERROR"; error: string };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(_state: FetchState, action: Action): FetchState {
  switch (action.type) {
    case "FETCH_START":
      return { status: "loading" };
    case "FETCH_SUCCESS":
      return { status: "success", apis: action.apis };
    case "FETCH_ERROR":
      return { status: "error", error: action.error };
  }
}

// ---------------------------------------------------------------------------
// Stub data fetcher
// Simulates GET /api/provider/apis. Replace the body with a real fetch() call
// once the backend endpoint is available.
// ---------------------------------------------------------------------------

/** Returns the published APIs belonging to the current provider from GET /api/provider/apis. */
async function fetchProviderApis(
  signal: AbortSignal,
): Promise<PublishedApiItem[]> {
  const url = apiUrl("/api/provider/apis");
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load your APIs: ${response.status}`);
  }

  return (await response.json()) as PublishedApiItem[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const PUBLISH_STATUS_STYLES: Record<
  PublishStatus,
  { bg: string; color: string; label: string }
> = {
  live:     { bg: "var(--sb-operational-bg)", color: "var(--sb-operational-fg)", label: "Live"     },
  pending:  { bg: "var(--sb-pending-bg)",     color: "var(--sb-pending-fg)",     label: "Pending"  },
  rejected: { bg: "var(--sb-error-bg)",       color: "var(--sb-error-fg)",       label: "Rejected" },
};

function PublishStatusPill({ status }: { status: PublishStatus }) {
  const s = PUBLISH_STATUS_STYLES[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15em 0.55em",
        borderRadius: "0.375em",
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.color}22`,
      }}
    >
      {s.label}
    </span>
  );
}

function ProviderApiRow({
  api,
  signedIn,
  onRotate,
  lastRotated,
}: {
  api: PublishedApiItem;
  signedIn: boolean;
  onRotate: (api: PublishedApiItem) => void;
  lastRotated?: string;
}) {
  const pricePerCall = api.pricePerCall ?? api.pricePerRequest;

  return (
    <li
      style={{
        listStyle: "none",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Link
        to={`/details/${api.id}`}
        data-testid={`api-row-${api.id}`}
        className="my-apis-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "16px 20px",
          textDecoration: "none",
          color: "inherit",
          transition: "background 0.15s",
          flex: 1,
          minWidth: 0,
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.background =
            "var(--surface-soft)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.background = "")
        }
        onFocus={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.outline =
            "2px solid var(--accent)")
        }
        onBlur={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.outline = "")
        }
        aria-label={`${api.name} — view details`}
      >
        {/* Icon avatar */}
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            background: "rgba(255,255,255,0.06)",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: "1.1rem",
            flexShrink: 0,
            color: "var(--text)",
          }}
        >
          {api.name[0]}
        </div>

        {/* Name + provider */}
        <div className="my-apis-row__name" style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              color: "var(--text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {api.name}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: 2 }}>
            {api.provider.name}
            {lastRotated && (
              <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--accent)" }}>
                • Rotated: {lastRotated}
              </span>
            )}
          </div>
        </div>

        {/* Runtime status */}
        <div style={{ flexShrink: 0 }}>
          <StatusBadge
            status={apiStatusToVariant(api.status)}
            showPattern={false}
          />
        </div>

        {/* Publish / review state */}
        <div style={{ flexShrink: 0 }}>
          <PublishStatusPill status={api.publishStatus ?? "pending"} />
        </div>

        {/* Price */}
        <div
          className="numeric-tabular"
          style={{
            flexShrink: 0,
            textAlign: "right",
            fontSize: "0.875rem",
            color: "var(--muted)",
            minWidth: 80,
          }}
        >
          <span style={{ color: "var(--text)", fontWeight: 600 }}>
            ${formatPrice(pricePerCall)}
          </span>
          <span style={{ fontSize: "0.75rem" }}> / call</span>
        </div>

        {/* Chevron */}
        <div aria-hidden="true" style={{ color: "var(--muted)", flexShrink: 0 }}>
          ›
        </div>
      </Link>

      {/* Action: Rotate Key */}
      <div style={{ padding: "0 20px 0 0", flexShrink: 0 }}>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onRotate(api)}
          disabled={!signedIn}
          title={signedIn ? "Rotate API key" : "Sign in to rotate API key"}
          aria-label={
            signedIn
              ? `Rotate key for ${api.name}`
              : `Rotate key for ${api.name} (sign in required)`
          }
          style={{
            fontSize: "0.8125rem",
            padding: "6px 12px",
            whiteSpace: "nowrap",
            opacity: signedIn ? 1 : 0.5,
            cursor: signedIn ? "pointer" : "not-allowed",
          }}
        >
          Rotate key
        </button>
      </div>
    </li>
  );
}

const SKELETON_ROW_COUNT = 3;

function ApiListSkeleton() {
  return (
    <ul
      aria-label="Loading your APIs"
      aria-busy="true"
      style={{ margin: 0, padding: 0 }}
      data-testid="my-apis-skeleton"
    >
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
        <li
          key={i}
          style={{
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <Skeleton width={40} height={40} borderRadius="10px" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton width="55%" height={14} borderRadius="6px" />
            <Skeleton width="30%" height={11} borderRadius="6px" />
          </div>
          <Skeleton width={72} height={22} borderRadius="6px" />
          <Skeleton width={58} height={22} borderRadius="6px" />
          <Skeleton width={70} height={16} borderRadius="6px" />
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MyApis() {
  const navigate = useNavigate();

  useDocumentTitle(
    "My APIs – Callora",
    "Manage and monitor your published APIs on the Callora marketplace."
  );

  const [state, dispatch] = useReducer(reducer, { status: "loading" });
  // Incrementing this triggers a re-fetch without remounting the page.
  const [retryKey, setRetryKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const [activeRotatingApi, setActiveRotatingApi] = useState<PublishedApiItem | null>(null);
  const [lastRotatedMap, setLastRotatedMap] = useState<Record<string, string>>({});
  const [announceMessage, setAnnounceMessage] = useState<string>("");
  const signedIn = isSignedIn();

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "FETCH_START" });

    fetchProviderApis(controller.signal)
      .then((apis) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "FETCH_SUCCESS", apis });
        }
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "FETCH_ERROR", error: err.message ?? "Unknown error" });
        }
      });
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load, retryKey]);

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  return (
    <div className="my-apis-page" style={{ padding: "24px 0" }}>
      <header style={{ marginBottom: "32px", padding: "0 4px" }}>
        <p className="eyebrow">Developer Dashboard</p>
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: "700",
            color: "var(--text)",
          }}
        >
          My APIs
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
          View performance metrics, update documentation, and manage pricing for
          your listed APIs.
        </p>
      </header>

      <section
        className="surface"
        style={{ borderRadius: "16px", overflow: "hidden" }}
        aria-label="Your published APIs"
      >
        {state.status === "loading" && <ApiListSkeleton />}

        {state.status === "error" && (
          <EmptyState
            variant="error"
            title="Failed to load your APIs"
            message="We couldn't retrieve your published APIs. Please try again."
            onRetry={handleRetry}
          />
        )}

        {state.status === "success" && state.apis.length === 0 && (
          <EmptyState
            variant="empty"
            title="No APIs published yet"
            message="You haven't listed any APIs on the marketplace. Start monetizing your services with usage-based USDC billing today."
            action={{
              label: "Publish your first API",
              onClick: () => navigate("/publish"),
            }}
          />
        )}

        {state.status === "success" && state.apis.length > 0 && (
          <>
            {/* Column header */}
            <div
              aria-hidden="true"
              className="my-apis-header"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "10px 20px",
                borderBottom: "1px solid var(--line)",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <div style={{ width: 40, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>API</div>
              <div style={{ flexShrink: 0, minWidth: 80 }}>Status</div>
              <div style={{ flexShrink: 0, minWidth: 68 }}>Review</div>
              <div style={{ flexShrink: 0, minWidth: 80, textAlign: "right" }}>Price</div>
              <div style={{ width: 16, flexShrink: 0 }} />
              <div style={{ minWidth: 80, flexShrink: 0, textAlign: "right" }}>Actions</div>
            </div>

            <ul
              style={{ margin: 0, padding: 0 }}
              aria-label={`${state.apis.length} published API${state.apis.length !== 1 ? "s" : ""}`}
              data-testid="my-apis-list"
            >
              {state.apis.map((api) => (
                <ProviderApiRow
                  key={api.id}
                  api={api}
                  signedIn={signedIn}
                  onRotate={setActiveRotatingApi}
                  lastRotated={lastRotatedMap[api.id]}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      {activeRotatingApi && (
        <KeyRotationModal
          isOpen={Boolean(activeRotatingApi)}
          onClose={() => setActiveRotatingApi(null)}
          keyId={activeRotatingApi.id}
          sessionToken={getAccessToken() ?? ""}
          onKeyChanged={(_newKey) => {
            setLastRotatedMap((prev) => ({
              ...prev,
              [activeRotatingApi.id]: "Just now",
            }));
            setAnnounceMessage(`API key for ${activeRotatingApi.name} rotated successfully.`);
          }}
        />
      )}
      <LiveRegion message={announceMessage} />
    </div>
  );
}
