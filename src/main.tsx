import ReactDOM from "react-dom/client";
import { renderRoute } from "./renderRoute";
import "./index.css";
import "./styles/print.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

const currentPathname = () => window.location.pathname || "/";

// Ensure the UI re-renders correctly when the user hits the browser back/forward buttons
window.addEventListener("popstate", () => {
  void renderRoute(root, currentPathname());
});

// Initial application render
void renderRoute(root, currentPathname());
