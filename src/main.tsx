import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import RouteProgressBar from "./components/RouteProgressBar";
import CommandPalette from "./components/CommandPalette";
import { startRouteLoading, stopRouteLoading } from "./hooks/useRouteLoading";
import { ToastProvider } from "./components/Toast";
import "./index.css";
import "./styles/print.css";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";

const root = ReactDOM.createRoot(document.getElementById("root")!);

/**
 * Custom manual router that wraps components in BrowserRouter 
 * to support React Router hooks while maintaining custom page imports.
 */
async function renderRoute() {
  const pathname = window.location.pathname || "/";

  // Helper to wrap components in the necessary Router context for hooks like useLocation/useNavigate
  const wrap = (children: React.ReactNode) => (
    <React.StrictMode>
      <ThemeProvider>
        <CollectionsProvider>
          <BrowserRouter>
            <RouteProgressBar />
            <ToastProvider>{children}</ToastProvider>
          </BrowserRouter>
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
    const mod = await import("./pages/MarketplacePage");
    const MarketplacePage = mod.default;
    root.render(wrap(<MarketplacePage />));
    stopRouteLoading();
    return;
  }

  if (pathname.startsWith("/details/")) {
    startRouteLoading();
    const mod = await import("./pages/ApiDetailPage");
    const ApiDetailPage = mod.default;
    root.render(
      wrap(
        <ApiDetailPage
          onBack={() => {
            history.pushState({}, "", "/marketplace");
            renderRoute();
          }}
        />
      )
    );
    stopRouteLoading();
    return;
  }

  // Default: render the existing App
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <CollectionsProvider>
            <RouteProgressBar />
            <ToastProvider>
              <App />
            </ToastProvider>
          </CollectionsProvider>
        </ThemeProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

// Ensure the UI re-renders correctly when the user hits the browser back/forward buttons
window.addEventListener("popstate", () => {
  renderRoute();
});

// Initial application render
renderRoute();
