import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./ThemeContext";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

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
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </React.StrictMode>
  );

  if (pathname.startsWith("/marketplace")) {
    const mod = await import("./pages/MarketplacePage");
    const MarketplacePage = mod.default;
    root.render(wrap(<MarketplacePage />));
    return;
  }

  if (pathname.startsWith("/api/")) {
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

// Ensure the UI re-renders correctly when the user hits the browser back/forward buttons
window.addEventListener("popstate", () => {
  renderRoute();
});

// Initial application render
renderRoute();