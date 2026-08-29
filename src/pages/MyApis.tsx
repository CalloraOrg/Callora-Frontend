import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import useDocumentTitle from "../hooks/useDocumentTitle";

/**
 * MyApis page for Callora.
 * Shows the list of APIs published by the current user.
 * In the current phase, it displays a polished empty state with a CTA to publish an API.
 */
export default function MyApis() {
  const navigate = useNavigate();

  useDocumentTitle(
    "My APIs – Callora",
    "Manage and monitor your published APIs on the Callora marketplace."
  );

  return (
    <div className="my-apis-page" style={{ padding: "24px 0" }}>
      <header style={{ marginBottom: "32px", padding: "0 4px" }}>
        <p className="eyebrow">Developer Dashboard</p>
        <h1 style={{
          margin: "0 0 12px",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
          fontWeight: "700",
          color: "var(--text)"
        }}>
          My APIs
        </h1>
        <p style={{
          margin: 0,
          fontSize: "1rem",
          color: "var(--muted)",
          lineHeight: "1.65",
          maxWidth: "600px"
        }}>
          View performance metrics, update documentation, and manage pricing for your listed APIs.
        </p>
      </header>

      <section className="surface" style={{ borderRadius: "16px", overflow: "hidden" }}>
        <EmptyState
          variant="empty"
          title="No APIs published yet"
          message="You haven't listed any APIs on the marketplace. Start monetizing your services with usage-based USDC billing today."
          action={{
            label: "Publish your first API",
            onClick: () => navigate("/publish"),
          }}
        />
      </section>
    </div>
  );
}
