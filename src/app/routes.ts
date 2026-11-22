/**
 * Application routes and lazy prefetching configuration.
 */

export const APP_ROUTES = {
  landing: "/",
  home: "/",
  dashboard: "/dashboard",
  marketplace: "/marketplace",
  apiDetail: "/api/:id",
  publish: "/publish",
  myApis: "/apis/my-apis",
  planBadge: "/apis/plan-badge",
  apiUsage: "/api-usage",
  billing: "/billing",
  billingHistory: "/billing/history",
  documentation: "/documentation",
  status: "/status",
  themePlayground: "/theme-playground",
  designSystem: "/design-system/docs",
  serverError: "/500",
  rateLimitCard: "/marketplace/:apiId/rate-limits",
  legacyRateLimit: "/rate-limit",
  slaCard: "/marketplace/:apiId/sla",
  webhookDeliveries: "/webhooks/deliveries",
  onboarding: "/onboarding",
  endpointSummary: "/endpoints",
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;
export type AppRoutePath = (typeof APP_ROUTES)[AppRouteKey];

export const PRIMARY_NAV: Array<{ to: string; label: string }> = [
  { to: APP_ROUTES.dashboard, label: "Dashboard" },
  { to: APP_ROUTES.marketplace, label: "Marketplace" },
  { to: APP_ROUTES.publish, label: "Publish" },
  { to: APP_ROUTES.myApis, label: "My APIs" },
  { to: APP_ROUTES.billing, label: "Billing" },
  { to: APP_ROUTES.documentation, label: "Docs" },
];

// Prefetch cache map to ensure modules are loaded on hover / focus without delaying critical interaction
const routePrefetchers: Record<string, () => Promise<unknown>> = {
  "/marketplace": () => import("../pages/MarketplacePage"),
  "/publish": () => import("../pages/PublishApi"),
  "/dashboard": () => import("../pages/DashboardPage"),
  "/api-usage": () => import("../pages/ApiUsage"),
  "/apis/my-apis": () => import("../pages/MyApis"),
  "/apis/plan-badge": () => import("../pages/PlanBadge"),
  "/billing/history": () => import("../pages/BillingHistory"),
  "/theme-playground": () => import("../pages/ThemePlayground"),
  "/design-system/docs": () => import("../pages/DesignSystemDocs"),
  "/a11y-audit": () => import("../pages/A11yAudit"),
  "/webhooks/deliveries": () => import("../pages/WebhookDeliveries"),
  "/endpoints": () => import("../pages/EndpointSummary"),
};

export function prefetchRoute(path: string): void {
  const prefetcher = routePrefetchers[path];
  if (prefetcher) {
    prefetcher().catch(() => {
      // Ignore prefetch failures gracefully
    });
  }
}
