import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function resolveSearchPath(query: string) {
  const value = query.trim().toLowerCase();

  if (!value) return null;
  if (value.includes("home") || value.includes("dashboard")) return "/dashboard";
  if (value.includes("market")) return "/marketplace";
  if (value.includes("doc") || value.includes("guide")) return "/documentation";
  if (value.includes("bill") || value.includes("vault") || value.includes("deposit")) {
    return "/billing";
  }

  return null;
}

export default function NotFound({ onGoHome }: { onGoHome: () => void }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    onGoHome();
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const destination = resolveSearchPath(searchQuery);

    if (!destination) {
      setSearchMessage("No direct match yet. Try Dashboard, Marketplace, or Documentation.");
      return;
    }

    setSearchMessage("");
    navigate(destination);
  };

  return (
    <section className="surface placeholder-card not-found" aria-labelledby="not-found-title">
      <p className="not-found-code">404</p>
      <h2 id="not-found-title">Page Not Found</h2>
      <p className="not-found-message">The page you're looking for doesn't exist.</p>
      <p className="helper-text">
        Let&apos;s get you back on track. Use one of the options below.
      </p>

      <div className="hero-actions not-found-actions">
        <button className="primary-button" onClick={onGoHome} type="button">
          Go to Home
        </button>

        <button className="secondary-button" onClick={handleGoBack} type="button">
          Go Back
        </button>
      </div>

      <form className="not-found-search" onSubmit={handleSearch} role="search">
        <label htmlFor="not-found-search-input">Search for a page</label>
        <div className="not-found-search-row">
          <input
            id="not-found-search-input"
            type="search"
            placeholder="Try Dashboard, Marketplace, or Documentation"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button className="secondary-button" type="submit">
            Search
          </button>
        </div>
        {searchMessage && (
          <p className="helper-text" role="status" aria-live="polite">
            {searchMessage}
          </p>
        )}
      </form>

      <nav className="not-found-links" aria-label="Helpful navigation links">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/marketplace">Marketplace</Link>
        <Link to="/documentation">Documentation</Link>
      </nav>
    </section>
  );
}
