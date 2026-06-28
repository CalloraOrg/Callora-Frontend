import { useMemo, useState, useEffect } from "react";
import CodeExample from "../components/CodeExample";
import Breadcrumb from "../components/Breadcrumb";
import Skeleton from "../components/Skeleton";
import EmbedPreview from "../components/EmbedPreview";
import Tabs from "../components/Tabs";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useFetchTracker } from "../hooks/useFetchTracker";
import { findApiById } from "../data/mockApis";
import type { Review } from "../data/mockApis";
import EmptyState from "../components/EmptyState";
import { formatPrice } from "../utils/format";
import { Icons } from "../utils/icons";
import { API_BASE_URL, LOADING_DELAY_MS } from "../config/constants";

/**
 * ApiDetailPage Component
 * * Provides a comprehensive view of a specific API, including:
 * - Interactive documentation with code snippets
 * - Real-time cost estimation
 * - Performance statistics and health metrics
 * - Implementation examples across multiple languages
 * - Token-driven loading skeletons (1.5s) for hero, metrics, and sidebar
 */

type Props = {
  onBack?: () => void;
};

type TabType =
  "overview" | "documentation" | "pricing" | "examples" | "reviews" | "embed";

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

const GENERIC_ENDPOINT_VERBS = new Set([
  "get",
  "list",
  "create",
  "update",
  "delete",
  "remove",
  "fetch",
]);

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveEndpointGroupLabel(endpoint: ApiEndpoint): string {
  if (endpoint.group?.trim()) {
    return endpoint.group.trim();
  }

  if (endpoint.title?.trim()) {
    const words = endpoint.title.trim().split(/\s+/);

    if (
      words.length > 1 &&
      GENERIC_ENDPOINT_VERBS.has(words[0].toLowerCase())
    ) {
      return words.slice(1).join(" ");
    }

    return endpoint.title.trim();
  }

  const firstMeaningfulSegment = endpoint.url
    .split("/")
    .filter(Boolean)
    .find((segment) => !/^v\d+$/i.test(segment) && !segment.startsWith("{"));

  if (!firstMeaningfulSegment) {
    return "General";
  }

  return toTitleCase(firstMeaningfulSegment.replace(/[-_]+/g, " "));
}

export default function ApiDetailPage({ onBack }: Props) {
  const { trackFetch } = useFetchTracker();
  const [tab, setTab] = useState<TabType>("overview");
  const [requests, setRequests] = useState(1000);
  const [isLoading, setIsLoading] = useState(true);

  // Ordered tab definitions — single source of truth for labels and ids.
  const TAB_ITEMS = [
    { id: "overview",       label: "Overview"       },
    { id: "documentation",  label: "Documentation"  },
    { id: "pricing",        label: "Pricing"        },
    { id: "examples",       label: "Examples"       },
    { id: "reviews",        label: "Reviews"        },
    { id: "embed",          label: "Embed"          },
  ] as const satisfies Array<{ id: TabType; label: string }>;

  // Extract ID from URL path: /details/[id]
  const id =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").filter(Boolean).pop()
      : undefined;

  const api = useMemo(() => findApiById(id), [id]);
  useDocumentTitle(api?.name ?? "API Detail – Callora", api?.description);

  const documentationEndpoints = useMemo(
    () => (api?.endpoints || []) as ApiEndpoint[],
    [api],
  );

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
      const requiredCount =
        endpoint.params?.filter((param) => param.required).length ?? 0;

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

  useEffect(() => {
    const abortController = new AbortController();
    trackFetch(new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
          resolve();
        }
      }, LOADING_DELAY_MS);
      abortController.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      });
    }));
    return () => abortController.abort();
  }, [trackFetch]);

  // Show "not found" after loading completes and API is missing
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
            title="API not found"
            message="We couldn't find that API. Try the marketplace."
          />
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              className="primary-button"
              onClick={() => (window.location.href = "/marketplace")}
            >
              Back to marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading skeletons while loading
  if (isLoading) {
    return (
      <div className="api-detail-page">
        <div className="api-detail-container">
          <Breadcrumb
            items={[
              { label: "Marketplace", href: "/marketplace" },
              { label: "Loading...", href: "", isCurrent: true },
            ]}
          />
          <div className="api-detail-shell">
            {/* Hero Skeleton */}
            <div className="api-detail-hero">
              <div className="api-detail-heading">
                <button className="ghost-button" onClick={onBack} type="button">
                  Back
                </button>
                <div className="api-detail-brand">
                  <Skeleton width={56} height={56} borderRadius={10} />
                  <div
                    className="api-detail-title"
                    style={{ flex: 1, marginLeft: 12 }}
                  >
                    <Skeleton
                      width="60%"
                      height={32}
                      style={{ marginBottom: 8 }}
                    />
                    <Skeleton width="40%" height={16} />
                  </div>
                </div>
              </div>
              <div className="api-detail-price-panel">
                <Skeleton width={100} height={32} style={{ marginBottom: 8 }} />
                <Skeleton
                  width={120}
                  height={14}
                  style={{ marginBottom: 12 }}
                />
                <Skeleton width="100%" height={44} borderRadius={8} />
              </div>
            </div>

            <div className="api-detail-content-grid">
              <div className="content-left">
                {/* Tabs Navigation Skeleton */}
                <nav className="api-detail-tabs">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      width={80}
                      height={20}
                      style={{ marginRight: 24 }}
                    />
                  ))}
                </nav>

                {/* Metrics Skeleton */}
                <div className="api-detail-metrics">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="stat-card-skeleton"
                      style={{ padding: 20 }}
                    >
                      <Skeleton
                        width="40%"
                        height={12}
                        style={{ marginBottom: 12 }}
                      />
                      <Skeleton width="60%" height={28} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar Skeleton */}
              <aside className="api-detail-sidebar">
                <div className="api-detail-sidebar-inner">
                  {/* API Health Card Skeleton */}
                  <div
                    className="stat-card-skeleton"
                    style={{ padding: 24, marginBottom: 20 }}
                  >
                    <Skeleton
                      width="50%"
                      height={20}
                      style={{ marginBottom: 16 }}
                    />
                    <Skeleton
                      width="100%"
                      height={16}
                      style={{ marginBottom: 8 }}
                    />
                    <Skeleton
                      width="100%"
                      height={16}
                      style={{ marginBottom: 8 }}
                    />
                    <Skeleton width="100%" height={16} />
                  </div>

                  {/* SDKs Card Skeleton */}
                  <div
                    className="preview-card-skeleton"
                    style={{ padding: 24, marginBottom: 20 }}
                  >
                    <Skeleton
                      width="50%"
                      height={20}
                      style={{ marginBottom: 16 }}
                    />
                    <Skeleton
                      width="100%"
                      height={36}
                      style={{ marginBottom: 8 }}
                    />
                    <Skeleton
                      width="100%"
                      height={36}
                      style={{ marginBottom: 8 }}
                    />
                    <Skeleton width="100%" height={36} />
                  </div>

                  {/* Support Card Skeleton */}
                  <div style={{ padding: 24, borderRadius: 16 }}>
                    <Skeleton
                      width="50%"
                      height={20}
                      style={{ marginBottom: 12 }}
                    />
                    <Skeleton
                      width="100%"
                      height={14}
                      style={{ marginBottom: 6 }}
                    />
                    <Skeleton
                      width="100%"
                      height={14}
                      style={{ marginBottom: 16 }}
                    />
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

  // Render actual content after loading completes
  if (!api) {
    return null; // This should not happen due to the check above, but kept for safety
  }

  // Example Generation Logic
  const firstEndpoint = (api.endpoints && api.endpoints[0]) || {
    url: "/v1/data",
    method: "GET",
  };

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
params = {
    "lat": 37.78,
    "lon": -122.41
}

response = requests.get(url, headers=headers, params=params)
data = response.json()

print(data)`;

  const allSnippets = {
    bash: curlExample,
    javascript: jsExample,
    python: pyExample,
  };

  const estimatedCost = (n: number) =>
    `$${(n * (api.pricePerRequest ?? 0)).toFixed(2)}`;

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
          <div className="api-detail-hero">
            <div className="api-detail-heading">
              <button className="ghost-button" onClick={onBack} type="button">
                Back
              </button>
              <div className="api-detail-brand">
                <div className="api-detail-logo">W</div>
                <div className="api-detail-title">
                  <h1>{api.name}</h1>
                  <div className="api-detail-meta">
                    <a href={api.provider?.url}>{api.provider?.name}</a> ·{" "}
                    <strong style={{ color: "var(--accent-strong)" }}>
                      {`$${formatPrice(api.pricePerRequest ?? 0)}`}
                    </strong>{" "}
                    per request
                  </div>
                </div>
                <div className="api-detail-provider">
                  Published by{" "}
                  <a
                    href={api.provider?.url}
                    style={{
                      color: "var(--text-main)",
                      textDecoration: "none",
                    }}
                  >
                    {api.provider?.name}
                  </a>
                </div>
              </div>
            </div>
            <div className="api-detail-price-panel">
              <div className="api-detail-price">
                {`$${formatPrice(api.pricePerRequest ?? 0)}`}
              </div>
              <div className="api-detail-price-label">
                per successful request
              </div>
              <button className="primary-button">Connect API</button>
            </div>
          </div>

          <div className="api-detail-content-grid">
            <div className="content-left">
              {/* Animated tab strip — accessible + smooth sliding indicator */}
              <Tabs
                tabs={TAB_ITEMS}
                activeTab={tab}
                onChange={(id) => setTab(id as TabType)}
                tabPanelId={(id) => `panel-${id}`}
                className="api-detail-tabs"
              />

              <div
                className="tab-content"
                style={{ animation: "fadeIn 0.3s ease" }}
              >
                {/* OVERVIEW TAB */}
                {tab === "overview" && (
                  <section
                    id="panel-overview"
                    role="tabpanel"
                    aria-labelledby="tab-overview"
                    tabIndex={0}
                  >
                    <div
                      className="preview-card"
                      style={{ padding: 24, marginBottom: 32 }}
                    >
                      <h3 style={{ marginTop: 0 }}>About this API</h3>
                      <p
                        style={{
                          lineHeight: 1.6,
                          fontSize: 16,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {api.description}
                      </p>
                    </div>

                    <div className="api-detail-two-column">
                      <div>
                        <h2>Key Features</h2>
                        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                          {(api.features || []).map((f) => (
                            <li
                              key={f}
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h2>Primary Use Cases</h2>
                        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                          {(api.useCases || []).map((u) => (
                            <li
                              key={u}
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {u}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <h2 style={{ marginTop: 40 }}>Performance Metrics</h2>
                    <div className="api-detail-metrics">
                      <div
                        className="stat-card"
                        style={{
                          padding: 20,
                          background: "var(--bg-subtle)",
                          borderRadius: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            textTransform: "uppercase",
                          }}
                        >
                          Total Requests
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            marginTop: 8,
                          }}
                        >
                          {(api.stats?.totalCalls ?? 0).toLocaleString()}
                        </div>
                      </div>
                      <div
                        className="stat-card"
                        style={{
                          padding: 20,
                          background: "var(--bg-subtle)",
                          borderRadius: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            textTransform: "uppercase",
                          }}
                        >
                          Latency (P95)
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            marginTop: 8,
                          }}
                        >
                          {api.stats?.avgResponseMs ?? 0}ms
                        </div>
                      </div>
                      <div
                        className="stat-card"
                        style={{
                          padding: 20,
                          background: "var(--bg-subtle)",
                          borderRadius: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            textTransform: "uppercase",
                          }}
                        >
                          System Uptime
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: "#10b981",
                            marginTop: 8,
                          }}
                        >
                          {api.stats?.uptimePct ?? 0}%
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* DOCUMENTATION TAB */}
                {tab === "documentation" && (
                  <section
                    id="panel-documentation"
                    role="tabpanel"
                    aria-labelledby="tab-documentation"
                    tabIndex={0}
                  >
                    <div className="endpoint-section-header">
                      <h3>Available Endpoints</h3>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>
                        Base URL: <code>{API_BASE_URL}</code>
                      </span>
                    </div>

                    {endpointGroups.length > 0 && (
                      <EndpointGroupHover groups={endpointGroups} />
                    )}

                    <div style={{ display: "grid", gap: 20, marginTop: 16 }}>
                      {documentationEndpoints.map((ep: ApiEndpoint) => (
                        <div
                          key={ep.id}
                          className="preview-card"
                          style={{ padding: 0, overflow: "hidden" }}
                        >
                          <div className="endpoint-card-header">
                            <div className="endpoint-title-row">
                              <span
                                className={`method-badge method-badge--${(ep.method || "get").toLowerCase()}`}
                              >
                                {ep.method}
                              </span>
                              <strong style={{ fontSize: 15 }}>
                                {ep.title}
                              </strong>
                            </div>
                            <code className="endpoint-url">{ep.url}</code>
                          </div>

                          <div style={{ padding: 24 }}>
                            <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>
                              Request Parameters
                            </h4>
                            <div className="endpoint-table-wrap">
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  fontSize: 13,
                                }}
                              >
                                <thead>
                                  <tr
                                    style={{
                                      textAlign: "left",
                                      color: "var(--muted)",
                                      borderBottom:
                                        "1px solid var(--border-subtle)",
                                    }}
                                  >
                                    <th style={{ padding: "8px 0" }}>
                                      Parameter
                                    </th>
                                    <th>Type</th>
                                    <th>Required</th>
                                    <th>Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ep.params.map((p: any) => (
                                    <tr
                                      key={p.name}
                                      style={{
                                        borderBottom:
                                          "1px solid var(--border-subtle)",
                                      }}
                                    >
                                      <td
                                        style={{
                                          padding: "12px 0",
                                          fontFamily: "monospace",
                                          color: "var(--accent)",
                                        }}
                                      >
                                        {p.name}
                                      </td>
                                      <td>
                                        <span className="type-tag">
                                          {p.type}
                                        </span>
                                      </td>
                                      <td>{p.required ? "Yes" : "Optional"}</td>
                                      <td style={{ color: "var(--muted)" }}>
                                        Standard filter for this endpoint.
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <h4
                              style={{ margin: "24px 0 12px 0", fontSize: 14 }}
                            >
                              Implementation
                            </h4>
                            <CodeExample
                              snippets={allSnippets}
                              defaultLanguage="bash"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* PRICING TAB */}
                {tab === "pricing" && (
                  <section
                    id="panel-pricing"
                    role="tabpanel"
                    aria-labelledby="tab-pricing"
                    tabIndex={0}
                  >
                    <h2>Pricing Plans</h2>
                    <div className="api-detail-pricing-grid">
                      <div
                        className="preview-card"
                        style={{
                          padding: 24,
                          border: "2px solid var(--accent)",
                        }}
                      >
                        <div
                          style={{
                            color: "var(--accent)",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "uppercase",
                          }}
                        >
                          Standard
                        </div>
                        <div className="api-detail-plan-price">
                          {`$${formatPrice(api.pricePerRequest ?? 0)}`}{" "}
                          <span style={{ fontSize: 14, color: "var(--muted)" }}>
                            / call
                          </span>
                        </div>
                        <p style={{ fontSize: 14, color: "var(--muted)" }}>
                          Perfect for startups and scaling applications. Pay
                          only for what you use.
                        </p>
                        <ul
                          style={{
                            padding: 0,
                            listStyle: "none",
                            fontSize: 14,
                            marginTop: 20,
                          }}
                        >
                          <li style={{ marginBottom: 10 }}>
                            ✅ Unlimited Throughput
                          </li>
                          <li style={{ marginBottom: 10 }}>
                            ✅ 99.9% Uptime SLA
                          </li>
                          <li style={{ marginBottom: 10 }}>
                            ✅ Community Support
                          </li>
                        </ul>
                      </div>
                      <div className="preview-card" style={{ padding: 24 }}>
                        <div
                          style={{
                            color: "var(--muted)",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "uppercase",
                          }}
                        >
                          Enterprise
                        </div>
                        <div className="api-detail-plan-price">Custom</div>
                        <p style={{ fontSize: 14, color: "var(--muted)" }}>
                          For high-volume needs requiring dedicated
                          infrastructure and support.
                        </p>
                        <ul
                          style={{
                            padding: 0,
                            listStyle: "none",
                            fontSize: 14,
                            marginTop: 20,
                          }}
                        >
                          <li style={{ marginBottom: 10 }}>
                            ✅ Dedicated Node
                          </li>
                          <li style={{ marginBottom: 10 }}>
                            ✅ 24/7 Phone Support
                          </li>
                          <li style={{ marginBottom: 10 }}>
                            ✅ Custom Rate Limits
                          </li>
                        </ul>
                        <button
                          className="secondary-button"
                          style={{ width: "100%", marginTop: 10 }}
                        >
                          Contact Sales
                        </button>
                      </div>
                    </div>

                    <div className="preview-card" style={{ padding: 32 }}>
                      <h4 style={{ marginTop: 0 }}>Cost Calculator</h4>
                      <p style={{ color: "var(--muted)" }}>
                        Estimate your monthly billing based on projected request
                        volume.
                      </p>

                      <div style={{ marginTop: 32 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 12,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            Monthly Volume
                          </span>
                          <span
                            style={{ color: "var(--accent)", fontWeight: 700 }}
                          >
                            {requests.toLocaleString()} Requests
                          </span>
                        </div>
                        <input
                          type="range"
                          min={100}
                          max={1000000}
                          step={100}
                          value={requests}
                          onChange={(e) => setRequests(Number(e.target.value))}
                          style={{
                            width: "100%",
                            height: 6,
                            borderRadius: 3,
                            appearance: "none",
                            background: "var(--border-subtle)",
                          }}
                        />

                        <div className="api-detail-calculator-total">
                          <div>
                            <div
                              style={{ fontSize: 12, color: "var(--muted)" }}
                            >
                              Estimated Monthly Total
                            </div>
                            <div
                              style={{
                                fontSize: 28,
                                fontWeight: 800,
                                color: "var(--text-main)",
                              }}
                            >
                              {estimatedCost(requests)}
                            </div>
                          </div>
                          <div
                            style={{
                              textAlign: "right",
                              fontSize: 13,
                              color: "var(--muted)",
                            }}
                          >
                            * Volume discounts apply automatically <br />
                            at 500k+ requests.
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* EXAMPLES TAB */}
                {tab === "examples" && (
                  <section
                    id="panel-examples"
                    role="tabpanel"
                    aria-labelledby="tab-examples"
                    tabIndex={0}
                  >
                    <h3>Integration Gallery</h3>
                    <p style={{ color: "var(--muted)", marginBottom: 24 }}>
                      Explore these Boilerplate examples to get integrated in
                      minutes.
                    </p>

                    <div
                      className="preview-card"
                      style={{ padding: 24, marginBottom: 24 }}
                    >
                      <div className="api-detail-example-tags">
                        <span
                          style={{
                            padding: "4px 12px",
                            background: "#e0f2fe",
                            color: "#0369a1",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          React / Next.js
                        </span>
                        <span
                          style={{
                            padding: "4px 12px",
                            background: "#fef3c7",
                            color: "#92400e",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Server-side
                        </span>
                      </div>
                      <h4>Fetching data in a Next.js Page</h4>
                      <CodeExample
                        snippets={allSnippets}
                        defaultLanguage="javascript"
                      />
                    </div>

                    <div className="preview-card" style={{ padding: 24 }}>
                      <h4>Python Data Analysis Workflow</h4>
                      <CodeExample
                        snippets={allSnippets}
                        defaultLanguage="python"
                      />
                    </div>
                  </section>
                )}

                {/* REVIEWS TAB */}
                {tab === "reviews" && (
                  <section
                    id="panel-reviews"
                    role="tabpanel"
                    aria-labelledby="tab-reviews"
                    tabIndex={0}
                  >
                    <div className="api-detail-reviews-header">
                      <h3 style={{ margin: 0 }}>Developer Feedback</h3>
                      <button className="secondary-button">
                        Write a Review
                      </button>
                    </div>

                    {rawReviews.length === 0 ? (
                      <div
                        className="preview-card"
                        style={{
                          padding: 40,
                          textAlign: "center",
                          borderStyle: "dashed",
                          marginTop: 16,
                        }}
                      >
                        <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
                        <h4>No public reviews yet</h4>
                        <p
                          style={{
                            color: "var(--muted)",
                            maxWidth: 400,
                            margin: "0 auto",
                          }}
                        >
                          Be the first to share your experience with this API.
                          Your feedback helps other developers make better
                          choices.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Rating histogram summary */}
                        <div style={{ marginTop: 16 }}>
                          <RatingHistogram
                            reviews={rawReviews}
                            averageRating={averageRating}
                          />
                        </div>

                        {/* Sort controls */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                            flexWrap: "wrap",
                          }}
                        >
                          <label
                            htmlFor="review-sort"
                            style={{
                              fontSize: 13,
                              color: "var(--muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Sort by
                          </label>
                          <select
                            id="review-sort"
                            value={reviewSort}
                            onChange={(e) =>
                              setReviewSort(e.target.value as ReviewSort)
                            }
                            style={{
                              fontSize: 13,
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid var(--border-subtle)",
                              background: "var(--bg-subtle)",
                              color: "var(--text-main)",
                              cursor: "pointer",
                            }}
                          >
                            <option value="newest">Newest</option>
                            <option value="highest">Highest rated</option>
                            <option value="lowest">Lowest rated</option>
                          </select>
                        </div>

                        {/* Review list */}
                        <div style={{ display: "grid", gap: 16 }}>
                          {sortedReviews.map((review) => (
                            <div
                              key={review.id}
                              className="preview-card"
                              style={{ padding: 20 }}
                            >
                              {/* Review header */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  flexWrap: "wrap",
                                  marginBottom: 10,
                                }}
                              >
                                {/* Author + badge */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    minWidth: 0,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      fontSize: 14,
                                      color: "var(--text-main)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {review.author}
                                  </span>

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
                                        background:
                                          "rgba(16, 185, 129, 0.12)",
                                        color: "#10b981",
                                        border:
                                          "1px solid rgba(16, 185, 129, 0.3)",
                                        cursor: "default",
                                        whiteSpace: "nowrap",
                                        flexShrink: 0,
                                        userSelect: "none",
                                      }}
                                    >
                                      {/* Checkmark icon */}
                                      <svg
                                        width="10"
                                        height="10"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        aria-hidden="true"
                                        focusable="false"
                                      >
                                        <path
                                          d="M2 6l3 3 5-5"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                      Verified Developer
                                    </span>
                                  )}
                                </div>

                                {/* Star rating + date */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexShrink: 0,
                                  }}
                                >
                                  <span
                                    role="img"
                                    aria-label={`${review.rating} out of 5 stars`}
                                    style={{ display: "flex", gap: 1 }}
                                  >
                                    {Array.from({ length: 5 }, (_, i) => (
                                      <svg
                                        key={i}
                                        width="13"
                                        height="13"
                                        viewBox="0 0 20 20"
                                        aria-hidden="true"
                                        focusable="false"
                                      >
                                        <path
                                          d="M10 1.5l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.77l-4.77 2.44.91-5.32L2.27 7.12l5.34-.78L10 1.5z"
                                          fill={
                                            i < review.rating
                                              ? "var(--accent, #f59e0b)"
                                              : "var(--border-subtle, #374151)"
                                          }
                                        />
                                      </svg>
                                    ))}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "var(--muted)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {new Date(review.date).toLocaleDateString(
                                      "en-US",
                                      {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      }
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Review body */}
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 14,
                                  lineHeight: 1.6,
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {review.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                )}

                {/* EMBED TAB */}
                {tab === "embed" && (
                  <section
                    id="panel-embed"
                    role="tabpanel"
                    aria-labelledby="tab-embed"
                    tabIndex={0}
                  >
                    <div
                      className="preview-card"
                      style={{ padding: 24, marginBottom: 24 }}
                    >
                      <h3 style={{ marginTop: 0 }}>Embed Widget</h3>
                      <p
                        style={{
                          color: "var(--muted)",
                          marginBottom: 24,
                          fontSize: 14,
                        }}
                      >
                        Embed a real-time widget on your website to showcase
                        this API's performance metrics. Customize the size and
                        copy the embed code below.
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
            </div>

            {/* Sidebar Sticky Column */}
            <aside className="api-detail-sidebar">
              <div className="api-detail-sidebar-inner">
                <div
                  className="stat-card"
                  style={{ padding: 24, marginBottom: 20 }}
                >
                  <h4 style={{ marginTop: 0 }}>API Health</h4>
                  <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: 14, color: "var(--muted)" }}>
                        Status
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          color: "#10b981",
                          fontWeight: 600,
                        }}
                      >
                        ● Operational
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: 14, color: "var(--muted)" }}>
                        Region
                      </span>
                      <span style={{ fontSize: 14 }}>Global (Edge)</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: 14, color: "var(--muted)" }}>
                        CORS
                      </span>
                      <span style={{ fontSize: 14, color: "#10b981" }}>
                        Supported
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="preview-card"
                  style={{ padding: 24, marginBottom: 20 }}
                >
                  <h4 style={{ marginTop: 0 }}>SDKs & Tools</h4>
                  <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                    <button
                      className="ghost-button"
                      style={{
                        justifyContent: "flex-start",
                        width: "100%",
                        fontSize: 13,
                      }}
                    >
                      📦 Node.js SDK
                    </button>
                    <button
                      className="ghost-button"
                      style={{
                        justifyContent: "flex-start",
                        width: "100%",
                        fontSize: 13,
                      }}
                    >
                      📦 Python Wrapper
                    </button>
                    <button
                      className="ghost-button"
                      style={{
                        justifyContent: "flex-start",
                        width: "100%",
                        fontSize: 13,
                      }}
                    >
                      📜 OpenAPI Spec (JSON)
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    background:
                      "linear-gradient(rgba(78, 133, 255, 0.1), rgba(78, 133, 255, 0.05))",
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid rgba(78, 133, 255, 0.2)",
                  }}
                >
                  <h4 style={{ marginTop: 0, color: "var(--accent-strong)" }}>
                    Support
                  </h4>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    Need help with integration? Access our developer discord or
                    email the provider directly.
                  </p>
                  <button
                    className="primary-button"
                    style={{ width: "100%", marginTop: 12 }}
                  >
                    Contact Publisher
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
