import ReactDOM from "react-dom/client";
import { renderRoute } from "./renderRoute";
import {
  loadRuntimeConfig,
  markRuntimeConfigFallback,
  setRuntimeConfig,
} from "./config/runtimeConfig";
import "./styles/tokens.css";
import "./index.css";
import "./styles/typography.css";
import "./styles/patterns.css";
import "./styles/focus.css";
import "./styles/contrast.css";
import "./styles/code.css";
import "./styles/print.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
let hasInitialRenderStarted = false;

const currentPathname = () => window.location.pathname || "/";

// Ensure the UI re-renders correctly when the user hits the browser back/forward buttons
window.addEventListener("popstate", () => {
  if (!hasInitialRenderStarted) return;
  void renderRoute(root, currentPathname());
});

async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_DEMO_MODE === "true") {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      onUnhandledRequest: "bypass",
    });
  }
}

async function startApp(): Promise<void> {
  await enableMocking();

  // Runtime config gets a short head start; the app renders with build-time
  // defaults after the budget and applies a later successful response live.
  const CONFIG_RENDER_BUDGET_MS = 1_500;
  const configRequest = loadRuntimeConfig()
    .then(setRuntimeConfig)
    .catch(() => {
      markRuntimeConfigFallback();
      console.warn("[config] Runtime config unavailable; using build-time configuration.");
    });
  let renderBudgetTimer: ReturnType<typeof setTimeout> | undefined;
  const renderBudget = new Promise<void>((resolve) => {
    renderBudgetTimer = globalThis.setTimeout(resolve, CONFIG_RENDER_BUDGET_MS);
  });

  await Promise.race([configRequest, renderBudget]);
  if (renderBudgetTimer !== undefined) globalThis.clearTimeout(renderBudgetTimer);
  hasInitialRenderStarted = true;
  void renderRoute(root, currentPathname());
}

void startApp();
