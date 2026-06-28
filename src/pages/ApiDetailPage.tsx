import { useMemo, useState, useEffect } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import Breadcrumb from "../components/Breadcrumb";
import Skeleton from "../components/Skeleton";
import ApiDetailPageSkeleton from "./ApiDetailPage.skeleton";
import EmbedPreview from "../components/EmbedPreview";
import Tabs from "../components/Tabs";
import { useToast } from "../components/Toast";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useFetchTracker } from "../hooks/useFetchTracker";
import { findApiById } from "../data/mockApis";
import type { Review } from "../data/mockApis";
import EmptyState from "../components/EmptyState";
import { formatPrice } from "../utils/format";
import { Icons } from "../utils/icons";
import { API_BASE_URL, LOADING_DELAY_MS } from "../config/constants";
import {
  getPostmanImportUrl,
  getInsomniaImportUrl,
  copyToClipboard,
} from "../utils/postman";

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
  | "overview"
  | "documentation"
  | "pricing"
  | "reviews";

export default function ApiDetailPage({ onBack }: Props) {
const [, setTab] = useState<TabType>("overview");
  //const [requests, setRequests] = useState(1000);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

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

  if (isLoading) {
    return <ApiDetailPageSkeleton />;
  }

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
 // const firstEndpoint = (api.endpoints && api.endpoints[0]) || {
   // url: "/v1/data",
    //method: "GET",
  //};

 // const curlExample = `curl -X ${firstEndpoint.method} "${API_BASE_URL}${firstEndpoint.url}?lat=37.78&lon=-122.41"
  //-H "Authorization: Bearer YOUR_API_KEY" \\
  //-H "Content-Type: application/json"`;

  //const jsExample = `import fetch from 'node-fetch';


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

getApiData().then(console.log).catch(console.error);

   // const pyExample = `import requests`

// url = "${API_BASE_URL}${firstEndpoint.url}"
//headers = {
  //  "Authorization": "Bearer YOUR_API_KEY",
  //  "Content-Type": "application/json"
//}
//params = {
  //  "lat": 37.78,
    //"lon": -122.41
//}

//response = requests.get(url, headers=headers, params=params)
//data = response.json()

//print(data)`;



 // const estimatedCost = (n: number) =>
   // `$${(n * (api.pricePerRequest ?? 0)).toFixed(2)}`;

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

    <button
      className="ghost-button"
      onClick={onBack}
      type="button"
    >
    </button>
<section className="api-hero" aria-labelledby="api-title">

  <div className="api-hero__content">
    <div className="api-hero__identity">
      <div className="api-hero__avatar">
        {api.provider?.avatar ? (
          <img
            src={api.provider.avatar}
            alt={`${api.provider.name} logo`}
          />
        ) : (
          api.provider?.name?.charAt(0).toUpperCase() ?? "A"
        )}
      </div>

      <div className="api-hero__info">
        <div className="api-hero__meta">
          <span className="api-version-pill">
            v{api.version ?? "1.0.0"}
          </span>

          <span
            className={`api-status api-status--${api.status ?? "operational"}`}
            aria-label={`Status: ${api.status ?? "operational"}`}
          >
            <span className="api-status-dot" />
            {api.status ?? "operational"}
          </span>
        </div>

        <h1 id="api-title">{api.name}</h1>

        <p className="api-hero__description">
          {api.description}
        </p>

        <p className="api-hero__provider">
          Published by{" "}
          <a
            href={api.provider?.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {api.provider?.name}
          </a>
        </p>
      </div>
    </div>

    <div className="api-hero__cta">
      <button className="primary-button">
        Try API
      </button>

      <button
        className="secondary-button"
        onClick={() => setTab("pricing")}
      >
        View Pricing
      </button>
    </div>
  </div>
</section>

  <div className="api-detail-content-grid"></div>
      </div>
    </div>
  </div>
  );
}
        