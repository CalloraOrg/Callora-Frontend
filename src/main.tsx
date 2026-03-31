import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Simple client-side route renderer to support direct URLs and client navigation
// without causing the dev server to proxy `/api` requests. This keeps `App.tsx`
// untouched but allows in-app navigation via history.pushState.
const root = ReactDOM.createRoot(document.getElementById("root")!);

async function renderRoute() {
  const pathname = window.location.pathname || "/";

  if (pathname.startsWith("/marketplace")) {
    const mod = await import("./pages/MarketplacePage");
    const MarketplacePage = mod.default;
    root.render(
      <React.StrictMode>
        <MarketplacePage />
      </React.StrictMode>,
    );
    return;
  }

  if (pathname.startsWith("/api/")) {
    const mod = await import("./pages/ApiDetailPage");
    const ApiDetailPage = mod.default;
    root.render(
      <React.StrictMode>
        <ApiDetailPage
          onBack={() => {
            history.pushState({}, "", "/marketplace");
            // re-render to show marketplace
            renderRoute();
          }}
        />
      </React.StrictMode>,
    );
    return;
  }

  // Default: render the existing App
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// Re-render on history navigation (back/forward) so client-side navigation works.
window.addEventListener("popstate", () => {
  renderRoute();
});

// Initial render
renderRoute();
