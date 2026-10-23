import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { rankRouteMatches, RouteMatch } from "../config/routeCatalogue";

const MAX_SUGGESTIONS = 5;

export function resolveSearchMatches(query: string): RouteMatch[] {
  return rankRouteMatches(query).slice(0, MAX_SUGGESTIONS);
}

export default function NotFound({ onGoHome }: { onGoHome: () => void }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [suggestions, setSuggestions] = useState<RouteMatch[]>([]);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    onGoHome();
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const matches = resolveSearchMatches(searchQuery);

    if (matches.length === 0) {
      setSuggestions([]);
      setSearchMessage("No direct match yet. Try Dashboard, Marketplace, or Documentation.");
      return;
    }

    if (matches.length === 1) {
      setSuggestions([]);
      setSearchMessage("");
      navigate(matches[0].path);
      return;
    }

    setSearchMessage("");
    setSuggestions(matches);
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
            onChange={(event) => {
              setSearchQuery(event.target.value);
              if (suggestions.length > 0) setSuggestions([]);
              if (searchMessage) setSearchMessage("");
            }}
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
        {suggestions.length > 0 && (
          <nav className="not-found-search-results" aria-label="Search suggestions" aria-live="polite">
            <p className="helper-text">Did you mean:</p>
            <ul>
              {suggestions.map((match) => (
                <li key={match.path}>
                  <Link to={match.path} onClick={() => setSuggestions([])}>
                    {match.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
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
