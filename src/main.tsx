import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AccountProvider } from "./hooks/useAccountContext";
import RouteProgressBar from "./components/RouteProgressBar";
import { ToastProvider } from "./components/Toast";
import "./index.css";
import "./styles/print.css";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Every page is mounted through the single <App /> route tree. Navigation —
// including browser back/forward — is handled by BrowserRouter, so the providers
// above it are never torn down and re-created on a route change.
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
