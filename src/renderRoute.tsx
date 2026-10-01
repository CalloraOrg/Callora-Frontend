/**
 * renderRoute.tsx
 *
 * Custom manual router that wraps components in BrowserRouter
 * to support React Router hooks while maintaining custom page imports.
 *
 * Extracted from `main.tsx` so the deep-link branches can be integration tested:
 * the module takes the render target and the pathname it should resolve, and
 * performs no work at import time (no createRoot, no listeners, no initial
 * render). `main.tsx` stays the only entry point that touches the DOM on load.
 */
import React from "react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AccountProvider } from "./hooks/useAccountContext";
import RouteProgressBar from "./components/RouteProgressBar";
import { startRouteLoading, stopRouteLoading } from "./hooks/useRouteLoading";
import { ToastProvider } from "./components/Toast";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";
import MarketplacePageSkeleton from "./pages/MarketplacePage.skeleton";
import ApiDetailPageSkeleton from "./pages/ApiDetailPage.skeleton";
import LatencyChart from "./pages/LatencyChart";

/**
 * The slice of a React 18 root that routing needs. Keeping it structural lets
 * tests observe the render sequence (skeleton before page) without stubbing
 * out React itself.
 */
export type RouteRenderTarget = {
  render(children: React.ReactNode): void;
};

/**
 * Renders the page that owns `pathname` into `root`.
 *
 * Heavy routes paint their skeleton shell first, then swap in the lazily
 * imported page once the chunk resolves, so a deep link never lands on a blank
 * screen. Unknown paths fall back to the router-driven `App`.
 */
export async function renderRoute(
  root: RouteRenderTarget,
  pathname: string,
): Promise<void> {
  // Helper to wrap components in the necessary Router context for hooks like useLocation/useNavigate
  const wrap = (children: React.ReactNode) => (
    <React.StrictMode>
      <ThemeProvider>
        <CollectionsProvider>
          <AccountProvider>
            <BrowserRouter>
              <RouteProgressBar />
              <ToastProvider>{children}</ToastProvider>
            </BrowserRouter>
          </AccountProvider>
        </CollectionsProvider>
      </ThemeProvider>
    </React.StrictMode>
  );

  if (pathname.startsWith("/publish")) {
    const mod = await import("./pages/PublishApi");
    const PublishApi = mod.default;
    root.render(wrap(<PublishApi />));
    return;
  }

  if (pathname.startsWith("/marketplace")) {
    startRouteLoading();
    root.render(wrap(<MarketplacePageSkeleton />));
    const mod = await import("./pages/MarketplacePage");
    const MarketplacePage = mod.default;
    root.render(wrap(<MarketplacePage />));
    stopRouteLoading();
    return;
  }

  if (pathname.startsWith("/details/")) {
    startRouteLoading();
    root.render(wrap(<ApiDetailPageSkeleton />));
    const mod = await import("./pages/ApiDetailPage");
    const ApiDetailPage = mod.default;
    root.render(
      wrap(
        <ApiDetailPage
          onBack={() => {
            history.pushState({}, "", "/marketplace");
            void renderRoute(root, "/marketplace");
          }}
        />
      )
    );
    stopRouteLoading();
    return;
  }

  if (pathname.startsWith("/latency-chart")) {
    root.render(wrap(<LatencyChart />));
    return;
  }

  // Default: render the existing App
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <CollectionsProvider>
            <AccountProvider>
              <RouteProgressBar />
              <ToastProvider>
                <App />
              </ToastProvider>
            </AccountProvider>
          </CollectionsProvider>
        </ThemeProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}
