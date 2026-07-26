import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import CodeExample from "../components/CodeExample";
import Breadcrumb from "../components/Breadcrumb";
import TestInBrowser from "../components/TestInBrowser";
import Skeleton from "../components/Skeleton";
import EmbedPreview from "../components/EmbedPreview";
import Tabs from "../components/Tabs";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { findApiById } from "../data/mockApis";
import EmptyState from "../components/EmptyState";
import { formatPrice } from "../utils/format";
import { Icons } from "../utils/icons";
import { API_BASE_URL, LOADING_DELAY_MS } from "../config/constants";
import EndpointGroupHover, { type EndpointGroupPreview } from "../components/EndpointGroupHover";
import RatingHistogram from "../components/RatingHistogram";
import { ApiDetailStickyTOC, type TocSection } from "../components/ApiDetailStickyTOC";
import { CheckIcon } from "../components/icons";
import { copyToClipboard, getInsomniaImportUrl, getPostmanImportUrl } from "../utils/postman";
import SubscribeButton from "../components/SubscribeButton";
import { useToast } from "../components/Toast";
import { useCollections } from "../state/collectionsStore";
import RelatedApisRail from "../components/RelatedApisRail";
import MOCK_APIS from "../data/mockApis";
import KbdHint from "../components/KbdHint";
import { SHORTCUTS } from "../hooks/useGlobalShortcuts";
import PlanBadge from "../components/PlanBadge";
import PricingTierTable from "../components/PricingTierTable";



/**
 * ApiDetailPage
 *
 * Comprehensive view of a single API listing:
 * - Tabbed layout: Overview, Documentation (with sticky TOC), Pricing,
 *   Examples, Reviews, Embed
 * - 1.5 s token-driven skeleton loading (consistent with MarketplacePage)
 * - Sticky right-rail TOC on the Documentation tab (>= 1100 px viewports)
 * - WCAG 2.1 AA accessible throughout
 */

type Props = {
  onBack?: () => void;
};

type TabType = "overview" | "documentation" | "pricing" | "examples" | "reviews" | "embed";

type ReviewSort = "newest" | "highest" | "lowest";

type EndpointParameter = {
  name: string;
  type: string;
  required?: boolean;
};

type ApiEndpoint = {
  id: string;
  title: string;
  url: string;
  method: string;
  params: EndpointParameter[];
  response?: string;
  group?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const GENERIC_ENDPOINT_VERBS = new Set(["get", "list", "create", "update", "delete", "remove", "fetch"]);

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveEndpointGroupLabel(endpoint: ApiEndpoint): string {
  if (endpoint.group?.trim()) return endpoint.group.trim();

  if (endpoint.title?.trim()) {
    const words = endpoint.title.trim().split(/\s+/);
    if (words.length > 1 && GENERIC_ENDPOINT_VERBS.has(words[0].toLowerCase())) {
      return words.slice(1).join(" ");
    }
    return endpoint.title.trim();
  }

  const firstMeaningfulSegment = endpoint.url
    .split("/")
    .filter(Boolean)
    .find((segment) => !/^v\d+$/i.test(segment) && !segment.startsWith("{"));

  if (!firstMeaningfulSegment) return "General";
  return toTitleCase(firstMeaningfulSegment.replace(/[-_]+/g, " "));
}

// ── TOC sections (ids must match heading elements in the doc tab) ─────────────

const DOC_TOC_SECTIONS: TocSection[] = [
  { id: "toc-endpoints", label: "Endpoints" },
  { id: "toc-parameters", label: "Parameters" },
  { id: "toc-implementation", label: "Implementation" },
];

// ── Ordered tab definitions ───────────────────────────────────────────────────

const TAB_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "documentation", label: "Documentation" },
  { id: "pricing", label: "Pricing" },
  { id: "examples", label: "Examples" },
  { id: "reviews", label: "Reviews" },
  { id: "embed", label: "Embed" },
] as const satisfies Array<{ id: TabType; label: string }>;

const API_DETAIL_SHORTCUTS = SHORTCUTS.filter(
  (shortcut) => shortcut.category === "ApiDetailPage",
);

// ── Endpoint save controls ───────────────────────────────────────────────────

function EndpointSaveButton({ endpointId }: { endpointId: string }) {
  const {
    collections,
    isEndpointSaved,
    collectionIdsForEndpoint,
    addEndpointToCollection,
    removeEndpointFromCollection,
    createCollectionWithEndpoint,
  } = useCollections();

  const [open, setOpen] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const savedIn = collectionIdsForEndpoint(endpointId);
  const isSaved = isEndpointSaved(endpointId);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleCreateCollection = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createCollectionWithEndpoint(trimmed, endpointId);
    setNewName("");
    setShowNewInput(false);
    setOpen(true);
  }, [createCollectionWithEndpoint, endpointId, newName]);

  const handleNewKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateCollection();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setShowNewInput(false);
      setNewName("");
    }
  };

  const handleToggleCollection = (collectionId: string) => {
    if (savedIn.has(collectionId)) {
      removeEndpointFromCollection(collectionId, endpointId);
    } else {
      addEndpointToCollection(collectionId, endpointId);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="icon-button"
        aria-label={isSaved ? "Saved endpoint" : "Save endpoint to collection"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icons.Link size={14} />
        <span>{isSaved ? "Saved" : "Save"}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Save endpoint to collection"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "38px",
            right: 0,
            zIndex: 120,
            width: 260,
            background: "var(--surface-strong, rgba(17,24,46,0.98))",
            border: "1px solid var(--line-strong, rgba(169,184,255,0.28))",
            borderRadius: 12,
            boxShadow: "var(--shadow, 0 24px 80px rgba(3,8,22,0.45))",
            padding: "12px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Save to collection
          </p>

          {collections.length === 0 && !showNewInput && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
                No collections yet.
              </p>
              <button
                type="button"
                onClick={() => setShowNewInput(true)}
                className="icon-button"
                style={{ width: "100%" }}
              >
                <span>＋ New collection</span>
              </button>
            </div>
          )}

          {collections.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
              {collections.map((collection) => (
                <label
                  key={collection.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 4px",
                    borderRadius: 8,
                    background: savedIn.has(collection.id)
                      ? "rgba(78,133,255,0.12)"
                      : "transparent",
                    cursor: "pointer",
                    color: "var(--text)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={savedIn.has(collection.id)}
                    onChange={() => handleToggleCollection(collection.id)}
                    aria-label={`${savedIn.has(collection.id) ? "Remove from" : "Add to"} collection \"${collection.name}\"`}
                    style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
                  />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {collection.name}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>
                    {collection.endpointIds.length}
                  </span>
                </label>
              ))}
            </div>
          )}

          {showNewInput ? (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleNewKeyDown}
                placeholder="Collection name"
                aria-label="New collection name"
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  color: "var(--text)",
                  padding: "8px 10px",
                  fontSize: "0.85rem",
                }}
              />
              <button
                type="button"
                onClick={handleCreateCollection}
                disabled={!newName.trim()}
                className="icon-button"
                style={{ minWidth: 56, justifyContent: "center" }}
              >
                Save
              </button>
            </div>
          ) : collections.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNewInput(true)}
              className="icon-button"
              style={{ width: "100%", marginTop: 10 }}
            >
              <span>＋ New collection</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApiDetailPage({ onBack }: Props) {
  const [tab, setTab] = useState<TabType>("overview");
  const [requests, setRequests] = useState(1000);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewSort, setReviewSort] = useState<ReviewSort>("newest");
  const { showToast } = useToast();

  const prefersReducedMotion = useMemo(() => {
    return typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Extract ID from URL path: /details/[id]
  const id = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean).pop() : undefined;

  const api = useMemo(() => findApiById(id), [id]);
  useDocumentTitle(api?.name ?? "API Detail – Callora", api?.description);

  const rawReviews = api?.reviews || [];
  const averageRating = api?.rating ?? 0;

  const sortedReviews = useMemo(() => {
    return [...rawReviews].sort((a, b) => {
      if (reviewSort === "highest") return b.rating - a.rating;
      if (reviewSort === "lowest") return a.rating - b.rating;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [rawReviews, reviewSort]);

  const documentationEndpoints = useMemo(() => (api?.endpoints || []) as ApiEndpoint[], [api]);

  const endpointGroups = useMemo<EndpointGroupPreview[]>(() => {
    const groups = new Map<
      string,
      {
        id: string;
        label: string;
        methods: Set<string>;
        endpoints: EndpointGroupPreview["endpoints"];
        totalParams: number;
      }
    >();

    documentationEndpoints.forEach((endpoint) => {
      const label = deriveEndpointGroupLabel(endpoint);
      const id = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const method = (endpoint.method || "GET").toUpperCase();
      const paramsCount = endpoint.params?.length ?? 0;
      const requiredCount = endpoint.params?.filter((param) => param.required).length ?? 0;

      const existingGroup = groups.get(id) ?? {
        id,
        label,
        methods: new Set<string>(),
        endpoints: [],
        totalParams: 0,
      };

      existingGroup.methods.add(method);
      existingGroup.totalParams += paramsCount;
      existingGroup.endpoints.push({
        id: endpoint.id,
        title: endpoint.title,
        url: endpoint.url,
        method,
        paramsCount,
        requiredCount,
      });

      groups.set(id, existingGroup);
    });

    return Array.from(groups.values())
      .map((group) => ({
        id: group.id,
        label: group.label,
        methods: Array.from(group.methods).sort(),
        endpointCount: group.endpoints.length,
        totalParams: group.totalParams,
        endpoints: group.endpoints,
        summary: `${group.endpoints.length} endpoint${group.endpoints.length === 1 ? "" : "s"} and ${group.totalParams} request parameter${group.totalParams === 1 ? "" : "s"}.`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [documentationEndpoints]);

  // Derive distribution map from raw reviews for the histogram
  const ratingDistribution = useMemo(() => {
    if (rawReviews.length === 0) return undefined;
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rawReviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      dist[star] = (dist[star] ?? 0) + 1;
    });
    return dist;
  }, [rawReviews]);

  // Simulate 1.5 s initial data load (consistent with MarketplacePage)
  useEffect(() => {
    const delay = prefersReducedMotion ? 0 : LOADING_DELAY_MS;
    const timer = setTimeout(() => setIsLoading(false), delay);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  // ── Not found (post-load) ─────────────────────────────────────────────────

  if (!isLoading && !api) {
    return (
      <div className="api-detail-page">
        <div className="api-detail-container">
          <Breadcrumb
            items={[
              { label: "Marketplace", href: "/marketplace" },
              { label: "Not Found", href: "", isCurrent: true },
            ]}
          />
          <EmptyState
            variant="api-detail"
            action={{
              label: "Back to marketplace",
              onClick: () => (window.location.href = "/marketplace"),
            }}
          />
        </div>
      </div>
    );
  }

  // ── Skeleton loading ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="api-detail-page">
        <div className="api-detail-container">
          <Breadcrumb
            items={[
              { label: "Marketplace", href: "/marketplace" },
              { label: "Loading…", href: "", isCurrent: true },
            ]}
          />
          <div className="api-detail-shell">
            <div className="api-detail-hero">
              <div className="api-detail-heading">
                <button className="ghost-button no-print" onClick={onBack} type="button">
                  Back
                </button>
                <div className="api-detail-brand">
                  <Skeleton width={56} height={56} borderRadius={10} />
                  <div className="api-detail-title" style={{ flex: 1, marginLeft: 12 }}>
                    <Skeleton width="60%" height={32} style={{ marginBottom: 8 }} />
                    <Skeleton width="40%" height={16} />
                  </div>
                </div>
              </div>
              <div className="api-detail-price-panel">
                <Skeleton width={100} height={32} style={{ marginBottom: 8 }} />
                <Skeleton width={120} height={14} style={{ marginBottom: 12 }} />
                <Skeleton width="100%" height={44} borderRadius={8} />
              </div>
            </div>

            <div className="api-detail-content-grid">
              <div className="content-left">
                <nav className="api-detail-tabs no-print">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} width={80} height={20} style={{ marginRight: 24 }} />
                  ))}
                </nav>
                <div className="api-detail-metrics">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="stat-card-skeleton" style={{ padding: 20 }}>
                      <Skeleton width="40%" height={12} style={{ marginBottom: 12 }} />
                      <Skeleton width="60%" height={28} />
                    </div>
                  ))}
                </div>
              </div>

              <aside className="api-detail-sidebar no-print">
                <div className="api-detail-sidebar-inner">
                  <div className="stat-card-skeleton" style={{ padding: 24, marginBottom: 20 }}>
                    <Skeleton width="50%" height={20} style={{ marginBottom: 16 }} />
                    <Skeleton width="100%" height={16} style={{ marginBottom: 8 }} />
                    <Skeleton width="100%" height={16} style={{ marginBottom: 8 }} />
                    <Skeleton width="100%" height={16} />
                  </div>
                  <div className="preview-card-skeleton" style={{ padding: 24, marginBottom: 20 }}>
                    <Skeleton width="50%" height={20} style={{ marginBottom: 16 }} />
                    <Skeleton width="100%" height={36} style={{ marginBottom: 8 }} />
                    <Skeleton width="100%" height={36} style={{ marginBottom: 8 }} />
                    <Skeleton width="100%" height={36} />
                  </div>
                  <div style={{ padding: 24, borderRadius: 16 }}>
                    <Skeleton width="50%" height={20} style={{ marginBottom: 12 }} />
                    <Skeleton width="100%" height={14} style={{ marginBottom: 6 }} />
                    <Skeleton width="100%" height={14} style={{ marginBottom: 16 }} />
                    <Skeleton width="100%" height={44} borderRadius={8} />
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Safety guard — unreachable after the checks above, satisfies TS
  if (!api) return null;

  // ── Code examples ─────────────────────────────────────────────────────────

  const firstEndpoint = api.endpoints?.[0] ?? { url: "/v1/data", method: "GET" };

  const curlExample = `curl -X ${firstEndpoint.method} "${API_BASE_URL}${firstEndpoint.url}?lat=37.78&lon=-122.41" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`;

  const jsExample = `import fetch from 'node-fetch';

const getApiData = async () => {
  const response = await fetch('${API_BASE_URL}${firstEndpoint.url}', {
    method: '${firstEndpoint.method}',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) throw new Error('API request failed');

  const data = await response.json();
  return data;
};

getApiData().then(console.log).catch(console.error);`;

  const pyExample = `import requests

url = "${API_BASE_URL}${firstEndpoint.url}"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
params = { "lat": 37.78, "lon": -122.41 }

response = requests.get(url, headers=headers, params=params)
print(response.json())`;

  const allSnippets = { bash: curlExample, javascript: jsExample, python: pyExample };

  const estimatedCost = (n: number) => `$${(n * (api.pricePerRequest ?? 0)).toFixed(2)}`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="api-detail-page">
      <div className="api-detail-container">
        <Breadcrumb
          items={[
            { label: "Marketplace", href: "/marketplace" },
            { label: api.name, href: "", isCurrent: true },
          ]}
        />

        <div className="api-detail-shell">
          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <div className="api-detail-hero">
            <div className="api-detail-heading">
              <button className="ghost-button no-print" onClick={onBack} type="button">
                Back
              </button>
              <div className="api-detail-brand">
                <div className="api-detail-logo">W</div>
                <div className="api-detail-title">
                  <h1>{api.name}</h1>
                  <div className="api-detail-meta">
                    <a href={api.provider?.url}>{api.provider?.name}</a> ·{" "}
                    <strong style={{ color: "var(--accent-strong)" }}>{`$${formatPrice(api.pricePerRequest ?? 0)}`}</strong> per request
                  </div>
                </div>
                <div className="api-detail-provider">
                  Published by{" "}
                  <a href={api.provider?.url} style={{ color: "var(--text)", textDecoration: "none" }}>
                    {api.provider?.name}
                  </a>
                </div>
              </div>
            </div>

            <div className="api-detail-price-panel">
              <div className="api-detail-price">{`$${formatPrice(api.pricePerRequest ?? 0)}`}</div>
              <div className="api-detail-price-label">per successful request</div>
              <button className="primary-button" style={{ marginTop: 16 }}>
                Connect API
              </button>
            </div>
          </div>

          {/* ── CTA row (below hero, above tabs) ──────────────────────────── */}
          {/* Responsive class handles flex→column stacking on narrow viewports */}
          <div className="api-hero__cta api-hero__cta--detail no-print">
            <button className="primary-button">Try API</button>
            <button className="secondary-button" onClick={() => setTab("pricing")}>
              View Pricing
            </button>
            <SubscribeButton apiName={api.name} onSubscribe={() => showToast(`Subscribed to ${api.name}!`, "success")} />
          </div>

          {/* ── Content grid: main column + sidebar ───────────────────────── */}
          <div className="api-detail-content-grid">
            <div className="content-left">
              {/* Tab navigation */}
              <div className="api-detail-tabs no-print">
                <KbdHint shortcuts={API_DETAIL_SHORTCUTS} />
                <Tabs tabs={TAB_ITEMS} activeTab={tab} onChange={(id) => setTab(id as TabType)} />
              </div>

              {/* Tab panels */}
              <div className="tab-content" style={{ animation: prefersReducedMotion ? "none" : "fadeIn 0.3s ease" }}>
                {/* ── OVERVIEW ────────────────────────────────────────────── */}
                {tab === "overview" && (
                  <section id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" tabIndex={0}>
                    <div className="preview-card" style={{ padding: 24, marginBottom: 32 }}>
                      <h3 style={{ marginTop: 0 }}>About this API</h3>
                      <p style={{ lineHeight: 1.6, fontSize: 16, color: "var(--muted)" }}>{api.description}</p>
                    </div>

                    <div className="api-detail-two-column">
                      <div>
                        <h2>Key Features</h2>
                        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                          {(api.features || []).map((f) => (
                            <li key={f} style={{ color: "var(--muted)" }}>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h2>Primary Use Cases</h2>
                        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                          {(api.useCases || []).map((u) => (
                            <li key={u} style={{ color: "var(--muted)" }}>
                              {u}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <h2 style={{ marginTop: 40 }}>Performance Metrics</h2>
                    <div className="api-detail-metrics">
                      {[
                        {
                          label: "Total Requests",
                          value: (api.stats?.totalCalls ?? 0).toLocaleString(),
                          color: "var(--text)",
                        },
                        {
                          label: "Latency (P95)",
                          value: `${api.stats?.avgResponseMs ?? 0}ms`,
                          color: "var(--text)",
                        },
                        {
                          label: "System Uptime",
                          value: `${api.stats?.uptimePct ?? 0}%`,
                          color: "var(--success)",
                        },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="stat-card" style={{ padding: 20, background: "var(--surface-soft)", borderRadius: 12 }}>
                          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase" }}>{label}</div>
                          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── DOCUMENTATION ───────────────────────────────────────── */}
                {tab === "documentation" && (
                  <section
                    id="panel-documentation"
                    role="tabpanel"
                    aria-labelledby="tab-documentation"
                    tabIndex={0}
                    style={{ display: "flex", gap: 32, alignItems: "flex-start" }}
                  >
                    {/* Main documentation content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="endpoint-section-header">
                        <h3 id="toc-endpoints">Available Endpoints</h3>
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>
                          Base URL: <code>{API_BASE_URL}</code>
                        </span>
                      </div>

                      {endpointGroups.length > 0 && <EndpointGroupHover groups={endpointGroups} />}

                      <div style={{ display: "grid", gap: 20, marginTop: 16 }}>
                        {documentationEndpoints.map((ep: ApiEndpoint, idx) => (
                          <div key={ep.id} className="preview-card" style={{ padding: 0, overflow: "hidden" }}>
                            <div className="endpoint-card-header">
                              <div className="endpoint-title-row">
                                <span className={`method-badge method-badge--${(ep.method || "get").toLowerCase()}`}>{ep.method}</span>
                                <strong style={{ fontSize: 15 }}>{ep.title}</strong>
                              </div>
                              <div className="endpoint-header-actions">
                                <code className="endpoint-url">{ep.url}</code>
                                <div className="endpoint-client-buttons">
                                  <button
                                    type="button"
                                    className="icon-button"
                                    aria-label="Copy Postman import URL"
                                    title="Open in Postman"
                                    onClick={() => {
                                      const url = getPostmanImportUrl(ep.method, ep.url, ep.title, API_BASE_URL);
                                      copyToClipboard(url).then((ok) => showToast(ok ? "Postman import URL copied" : "Failed to copy", ok ? "success" : "error"));
                                    }}
                                  >
                                    <Icons.ExternalLink size={14} />
                                    <span>Postman</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-button"
                                    aria-label="Copy Insomnia import URL"
                                    title="Open in Insomnia"
                                    onClick={() => {
                                      const url = getInsomniaImportUrl(ep.method, ep.url, ep.title, API_BASE_URL);
                                      copyToClipboard(url).then((ok) => showToast(ok ? "Insomnia import URL copied" : "Failed to copy", ok ? "success" : "error"));
                                    }}
                                  >
                                    <Icons.ExternalLink size={14} />
                                    <span>Insomnia</span>
                                  </button>
                                  <EndpointSaveButton endpointId={ep.id} />
                                </div>
                              </div>
                            </div>

                            <div style={{ padding: 24 }}>
                              {/* id anchors only on first endpoint card */}
                              <h4 id={idx === 0 ? "toc-parameters" : undefined} style={{ margin: "0 0 12px 0", fontSize: 14 }}>
                                Request Parameters
                              </h4>
                              <div className="endpoint-table-wrap">
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                  <thead>
                                    <tr style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                                      <th style={{ padding: "8px 0" }}>Parameter</th>
                                      <th>Type</th>
                                      <th>Required</th>
                                      <th>Description</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ep.params.map((p) => (
                                      <tr key={p.name} style={{ borderBottom: "1px solid var(--line)" }}>
                                        <td style={{ padding: "12px 0", fontFamily: "monospace", color: "var(--accent)" }}>{p.name}</td>
                                        <td>
                                          <span className="type-tag">{p.type}</span>
                                        </td>
                                        <td>{p.required ? "Yes" : "Optional"}</td>
                                        <td style={{ color: "var(--muted)" }}>Standard filter for this endpoint.</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              <h4 id={idx === 0 ? "toc-implementation" : undefined} style={{ margin: "24px 0 12px 0", fontSize: 14 }}>
                                Implementation
                              </h4>
                              <CodeExample snippets={allSnippets} defaultLanguage="bash" />

                              <TestInBrowser
                                endpointUrl={`${API_BASE_URL}${ep.url}`}
                                method={ep.method || "GET"}
                                params={(ep.params || []).map((p) => ({
                                  name: p.name,
                                  type: p.type ?? "string",
                                  required: Boolean(p.required),
                                }))}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sticky TOC — hidden below 1100 px via CSS */}
                    <ApiDetailStickyTOC sections={DOC_TOC_SECTIONS} />
                  </section>
                )}

                {/* ── PRICING ─────────────────────────────────────────────── */}
                {tab === "pricing" && (
                  <section id="panel-pricing" role="tabpanel" aria-labelledby="tab-pricing" tabIndex={0}>
                    <h2>Pricing Plans</h2>
                    <PricingTierTable
                      onSelectTier={(tier) => showToast(`Selected ${tier.name} plan!`, "success")}
                      tiers={[
                        {
                          name: "Free",
                          price: "$0",
                          description: "Perfect for experimentation and testing.",
                          features: api.features?.map((f) => ({ label: f, included: true })) || [
                            { label: "Standard Support", included: false },
                            { label: "High Rate Limits", included: false },
                          ],
                          ctaLabel: "Get Started",
                        },
                        {
                          name: "Standard",
                          price: `$${formatPrice(api.pricePerRequest ?? 0)}`,
                          description: "Ideal for production-grade applications.",
                          features: api.features?.map((f) => ({ label: f, included: true })) || [
                            { label: "Standard Support", included: true },
                            { label: "High Rate Limits", included: true },
                          ],
                          ctaLabel: "Upgrade Now",
                          isRecommended: true,
                          tier: "pro",
                        },
                        {
                          name: "Enterprise",
                          price: "Custom",
                          description: "Tailored for large-scale, high-volume needs.",
                          features: [
                            ...(api.features?.map((f) => ({ label: f, included: true })) || []),
                            { label: "Dedicated Support", included: true },
                            { label: "Custom SLA", included: true },
                            { label: "Dedicated Infrastructure", included: true },
                          ],
                          ctaLabel: "Contact Sales",
                          tier: "enterprise",
                        },
                      ]}
                    />


                    {/* Cost calculator */}
                    <div className="preview-card" style={{ padding: 32 }}>
                      <h4 style={{ marginTop: 0 }}>Cost Calculator</h4>
                      <p style={{ color: "var(--muted)" }}>Estimate your monthly billing based on projected request volume.</p>
                      <div style={{ marginTop: 32 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <span style={{ fontWeight: 600 }}>Monthly Volume</span>
                          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{requests.toLocaleString()} Requests</span>
                        </div>
                        <input
                          type="range"
                          min={100}
                          max={1000000}
                          step={100}
                          value={requests}
                          onChange={(e) => setRequests(Number(e.target.value))}
                          style={{ width: "100%", height: 6, borderRadius: 3, appearance: "none", background: "var(--line)" }}
                        />
                        <div className="api-detail-calculator-total">
                          <div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>Estimated Monthly Total</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>{estimatedCost(requests)}</div>
                          </div>
                          <div style={{ textAlign: "right", fontSize: 13, color: "var(--muted)" }}>
                            * Volume discounts apply automatically
                            <br />
                            at 500k+ requests.
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* ── EXAMPLES ────────────────────────────────────────────── */}
                {tab === "examples" && (
                  <section id="panel-examples" role="tabpanel" aria-labelledby="tab-examples" tabIndex={0}>
                    <h3>Integration Gallery</h3>
                    <p style={{ color: "var(--muted)", marginBottom: 24 }}>Explore these boilerplate examples to get integrated in minutes.</p>

                    <div className="preview-card" style={{ padding: 24, marginBottom: 24 }}>
                      <div className="api-detail-example-tags">
                        <span style={{ padding: "4px 12px", background: "#e0f2fe", color: "#0369a1", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                          React / Next.js
                        </span>
                        <span style={{ padding: "4px 12px", background: "#fef3c7", color: "#92400e", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>Server-side</span>
                      </div>
                      <h4>Fetching data in a Next.js Page</h4>
                      <CodeExample snippets={allSnippets} defaultLanguage="javascript" />
                    </div>

                    <div className="preview-card" style={{ padding: 24 }}>
                      <h4>Python Data Analysis Workflow</h4>
                      <CodeExample snippets={allSnippets} defaultLanguage="python" />
                    </div>
                  </section>
                )}

                {/* ── REVIEWS ─────────────────────────────────────────────── */}
                {tab === "reviews" && (
                  <section id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" tabIndex={0}>
                    <div className="api-detail-reviews-header">
                      <h3 style={{ margin: 0 }}>Developer Feedback</h3>
                      <button className="secondary-button">Write a Review</button>
                    </div>

                    {rawReviews.length === 0 ? (
                      <div className="preview-card" style={{ padding: 40, textAlign: "center", borderStyle: "dashed", marginTop: 16 }}>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
                        <h4>No public reviews yet</h4>
                        <p style={{ color: "var(--muted)", maxWidth: 400, margin: "0 auto" }}>Be the first to share your experience with this API.</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ marginTop: 16 }}>
                          <RatingHistogram rating={averageRating} distribution={ratingDistribution} />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                          <label htmlFor="review-sort" style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>
                            Sort by
                          </label>
                          <select
                            id="review-sort"
                            value={reviewSort}
                            onChange={(e) => setReviewSort(e.target.value as ReviewSort)}
                            style={{
                              fontSize: 13,
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid var(--line)",
                              background: "var(--surface-soft)",
                              color: "var(--text)",
                              cursor: "pointer",
                            }}
                          >
                            <option value="newest">Newest</option>
                            <option value="highest">Highest rated</option>
                            <option value="lowest">Lowest rated</option>
                          </select>
                        </div>

                        <div style={{ display: "grid", gap: 16 }}>
                          {sortedReviews.map((review) => (
                            <div key={review.id} className="preview-card" style={{ padding: 20 }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap" }}>{review.author}</span>
                                  {review.verified && (
                                    <span
                                      title="Has called this API in the last 30 days"
                                      aria-label="Verified Developer – has called this API in the last 30 days"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        lineHeight: "18px",
                                        background: "rgba(16, 185, 129, 0.12)",
                                        color: "var(--success)",
                                        border: "1px solid rgba(16, 185, 129, 0.3)",
                                        cursor: "default",
                                        whiteSpace: "nowrap",
                                        flexShrink: 0,
                                        userSelect: "none",
                                      }}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      Verified Developer
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                  <span role="img" aria-label={`${review.rating} out of 5 stars`} style={{ display: "flex", gap: 1 }}>
                                    {Array.from({ length: 5 }, (_, i) => (
                                      <svg key={i} width="13" height="13" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                                        <path
                                          d="M10 1.5l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.77l-4.77 2.44.91-5.32L2.27 7.12l5.34-.78L10 1.5z"
                                          fill={i < review.rating ? "var(--accent)" : "var(--line)"}
                                        />
                                      </svg>
                                    ))}
                                  </span>
                                  <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                                    {new Date(review.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                  </span>
                                </div>
                              </div>
                              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>{review.body}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                )}

                {/* ── EMBED ───────────────────────────────────────────────── */}
                {tab === "embed" && (
                  <section id="panel-embed" role="tabpanel" aria-labelledby="tab-embed" tabIndex={0}>
                    <div className="preview-card" style={{ padding: 24, marginBottom: 24 }}>
                      <h3 style={{ marginTop: 0 }}>Embed Widget</h3>
                      <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 14 }}>
                        Embed a real-time widget on your website to showcase this API's performance metrics. Customize the size and copy the embed code below.
                      </p>
                    </div>
                    <EmbedPreview
                      providerName={api.provider?.name || "Unknown Provider"}
                      stats={{
                        totalCalls: api.stats?.totalCalls ?? 0,
                        avgLatencyMs: api.stats?.avgResponseMs ?? 0,
                        uptime: api.stats?.uptimePct ?? 0,
                      }}
                      apiId={id || "unknown"}
                    />
                  </section>
                )}
              </div>
              {/* /tab-content */}
            </div>
            {/* /content-left */}

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="api-detail-sidebar no-print">
              <div className="api-detail-sidebar-inner">
                <div className="stat-card" style={{ padding: 24, marginBottom: 20 }}>
                  <h4 style={{ marginTop: 0 }}>API Health</h4>
                  <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
                    {[
                      { label: "Status", value: "● Operational", color: "var(--success)" },
                      { label: "Region", value: "Global (Edge)", color: "var(--text)" },
                      { label: "CORS", value: "Supported", color: "var(--success)" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 14, color: "var(--muted)" }}>{label}</span>
                        <span style={{ fontSize: 14, color, fontWeight: label !== "Region" ? 600 : undefined }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="preview-card" style={{ padding: 24, marginBottom: 20 }}>
                  <h4 style={{ marginTop: 0 }}>SDKs &amp; Tools</h4>
                  <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                    {["📦 Node.js SDK", "📦 Python Wrapper", "📜 OpenAPI Spec (JSON)"].map((label) => (
                      <button key={label} className="ghost-button" style={{ justifyContent: "flex-start", width: "100%", fontSize: 13 }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    background: "linear-gradient(rgba(78,133,255,0.1),rgba(78,133,255,0.05))",
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid rgba(78,133,255,0.2)",
                  }}
                >
                  <h4 style={{ marginTop: 0, color: "var(--accent-strong)" }}>Support</h4>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                    Need help with integration? Access our developer Discord or email the provider directly.
                  </p>
                  <button className="primary-button" style={{ width: "100%", marginTop: 12 }}>
                    Contact Publisher
                  </button>
                </div>

                {/* ── Related APIs rail ───────────────────────────────── */}
                <RelatedApisRail
                  currentApi={api}
                  allApis={MOCK_APIS}
                  onSelect={(related) => {
                    window.location.href = `/details/${related.id}`;
                  }}
                />
              </div>
            </aside>
          </div>
          {/* /api-detail-content-grid */}
        </div>
        {/* /api-detail-shell */}
      </div>
      {/* /api-detail-container */}
    </div>
  );
}
