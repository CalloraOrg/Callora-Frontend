import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./ThemeContext";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

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
      <BrowserRouter>
      <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

// Re-render on history navigation (back/forward) so client-side navigation works.
window.addEventListener("popstate", () => {
  renderRoute();
});

// Initial render
renderRoute();
