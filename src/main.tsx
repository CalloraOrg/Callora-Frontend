import ReactDOM from "react-dom/client";
import { renderRoute } from "./renderRoute";
import "./styles/tokens.css";
import "./index.css";
import "./styles/typography.css";
import "./styles/patterns.css";
import "./styles/focus.css";
import "./styles/contrast.css";
import "./styles/code.css";
import "./styles/print.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

const currentPathname = () => window.location.pathname || "/";

// Ensure the UI re-renders correctly when the user hits the browser back/forward buttons
window.addEventListener("popstate", () => {
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

// Initial application render after mock worker setup if in demo mode
void enableMocking().then(() => {
  void renderRoute(root, currentPathname());
});
