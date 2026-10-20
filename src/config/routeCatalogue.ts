/**
 * Searchable route catalogue for the 404 ("Page Not Found") search box.
 *
 * Each entry pairs a human-readable label and its path with a list of
 * keywords a user might type when they're trying to find that page.
 * Keep this in sync with `APP_ROUTES` in App.tsx whenever a new route is
 * added — the 404 search only ever suggests routes listed here.
 */

export type RouteCatalogueEntry = {
  label: string;
  path: string;
  keywords: string[];
};

export const ROUTE_CATALOGUE: RouteCatalogueEntry[] = [
  { label: "Home", path: "/", keywords: ["home", "landing", "start"] },
  {
    label: "Dashboard",
    path: "/dashboard",
    keywords: ["dashboard", "home", "overview", "balance"],
  },
  {
    label: "Marketplace",
    path: "/marketplace",
    keywords: ["market", "marketplace", "browse", "explore", "apis"],
  },
  {
    label: "Publish API",
    path: "/publish",
    keywords: ["publish", "publishing", "list api", "create api"],
  },
  {
    label: "My APIs",
    path: "/apis/my-apis",
    keywords: ["my apis", "apis", "manage apis"],
  },
  {
    label: "Plan Badge",
    path: "/apis/plan-badge",
    keywords: ["plan badge", "plan", "badge"],
  },
  {
    label: "API Usage",
    path: "/api-usage",
    keywords: ["usage", "api usage", "requests", "calls", "api"],
  },
  {
    label: "Billing",
    path: "/billing",
    keywords: ["bill", "billing", "vault", "deposit"],
  },
  {
    label: "Billing History",
    path: "/billing/history",
    keywords: ["history", "billing history", "transactions", "statement"],
  },
  {
    label: "Documentation",
    path: "/documentation",
    keywords: ["doc", "docs", "guide", "documentation", "help"],
  },
  {
    label: "Status",
    path: "/status",
    keywords: ["status", "uptime", "health"],
  },
  {
    label: "Theme Playground",
    path: "/theme-playground",
    keywords: ["theme", "themes", "playground", "dark mode", "colors"],
  },
  {
    label: "Design System",
    path: "/design-system/docs",
    keywords: ["design system", "design", "components", "ui kit"],
  },
  {
    label: "Rate Limit",
    path: "/rate-limit",
    keywords: ["rate limit", "throttle", "limits"],
  },
  {
    label: "Webhook Deliveries",
    path: "/webhooks/deliveries",
    keywords: ["webhook", "webhooks", "deliveries", "callback"],
  },
  {
    label: "Onboarding Tour",
    path: "/onboarding",
    keywords: ["onboarding", "tour", "getting started"],
  },
];

export type RouteMatch = {
  label: string;
  path: string;
  score: number;
};

/**
 * Rank catalogue entries against a free-text query.
 *
 * Scoring (highest wins per entry):
 *  - 3: query exactly equals a keyword or the entry label
 *  - 2: the query is contained within a keyword/label (e.g. "hist" in "history")
 *  - 1: a keyword/label is contained within the query (e.g. "billing history page")
 *
 * Entries with no match are excluded. Results are sorted by score
 * (descending), then alphabetically by label for stable ordering.
 */
export function rankRouteMatches(query: string): RouteMatch[] {
  const value = query.trim().toLowerCase();
  if (!value) return [];

  const matches: RouteMatch[] = [];

  for (const entry of ROUTE_CATALOGUE) {
    let best = 0;
    const candidates = [entry.label.toLowerCase(), ...entry.keywords.map((k) => k.toLowerCase())];

    for (const candidate of candidates) {
      let score = 0;
      if (candidate === value) {
        score = 3;
      } else if (candidate.includes(value)) {
        score = 2;
      } else if (value.includes(candidate)) {
        score = 1;
      }

      if (score > best) best = score;
    }

    if (best > 0) {
      matches.push({ label: entry.label, path: entry.path, score: best });
    }
  }

  return matches.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}
