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

// Initial application render
void renderRoute(root, currentPathname());
