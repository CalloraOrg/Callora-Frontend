import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import NotFound from "./NotFound";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderNotFound(onGoHome = vi.fn()) {
  const result = render(
    <MemoryRouter>
      <NotFound onGoHome={onGoHome} />
    </MemoryRouter>,
  );
  return { ...result, onGoHome };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("NotFound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the 404 code", () => {
      renderNotFound();
      expect(screen.getByText("404")).toBeInTheDocument();
    });

    it("renders the 'Page Not Found' heading", () => {
      renderNotFound();
      expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    });

    it("renders the descriptive message", () => {
      renderNotFound();
      expect(
        screen.getByText("The page you're looking for doesn't exist."),
      ).toBeInTheDocument();
    });

    it("renders the helper text", () => {
      renderNotFound();
      expect(
        screen.getByText(/get you back on track/i),
      ).toBeInTheDocument();
    });

    it("renders the Go to Home button", () => {
      renderNotFound();
      expect(
        screen.getByRole("button", { name: /go to home/i }),
      ).toBeInTheDocument();
    });

    it("renders the Go Back button", () => {
      renderNotFound();
      expect(
        screen.getByRole("button", { name: /go back/i }),
      ).toBeInTheDocument();
    });

    it("renders the search form", () => {
      renderNotFound();
      expect(screen.getByRole("search")).toBeInTheDocument();
    });

    it("renders the search input with correct placeholder", () => {
      renderNotFound();
      expect(
        screen.getByPlaceholderText(
          "Try Dashboard, Marketplace, or Documentation",
        ),
      ).toBeInTheDocument();
    });
  });

  // ── Helpful navigation links ─────────────────────────────────────────────

  describe("helpful navigation links", () => {
    it("renders a Dashboard link pointing to /dashboard", () => {
      renderNotFound();
      const link = screen.getByRole("link", { name: "Dashboard" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/dashboard");
    });

    it("renders a Marketplace link pointing to /marketplace", () => {
      renderNotFound();
      const link = screen.getByRole("link", { name: "Marketplace" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/marketplace");
    });

    it("renders a Documentation link pointing to /documentation", () => {
      renderNotFound();
      const link = screen.getByRole("link", { name: "Documentation" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/documentation");
    });

    it("wraps links in a nav with an accessible label", () => {
      renderNotFound();
      const nav = screen.getByRole("navigation", {
        name: /helpful navigation links/i,
      });
      expect(nav).toBeInTheDocument();
    });
  });

  // ── resolveSearchPath keyword navigation ─────────────────────────────────

  describe("resolveSearchPath keyword navigation", () => {
    it("navigates to /marketplace when searching 'market'", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "market");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/marketplace");
    });

    it("navigates to /billing when searching 'vault'", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "vault");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/billing");
    });

    it("navigates to /documentation when searching 'guide'", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "guide");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/documentation");
    });

    it("navigates to /dashboard when searching 'home'", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "home");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });

    it("navigates to /dashboard when searching 'dashboard'", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "dashboard");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });

    it("navigates to /documentation when searching 'doc'", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "doc");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/documentation");
    });

    it("navigates to /billing when searching 'bill'", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "bill");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/billing");
    });

    it("navigates to /billing when searching 'deposit'", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "deposit");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/billing");
    });

    it("is case-insensitive for keyword matching", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "VAULT");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/billing");
    });

    it("trims whitespace before matching", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "  market  ");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/marketplace");
    });
  });

  // ── Unknown query helper message ─────────────────────────────────────────

  describe("unknown query helper message", () => {
    it("shows the helper message in a status region for an unknown query", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "xyzunknown");
      await user.click(screen.getByRole("button", { name: /search/i }));

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(
        "No direct match yet. Try Dashboard, Marketplace, or Documentation.",
      );
    });

    it("does not navigate when query has no match", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "xyzunknown");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows the helper message when submitting an empty query", async () => {
      const user = userEvent.setup();
      renderNotFound();

      await user.click(screen.getByRole("button", { name: /search/i }));

      // Empty string returns null from resolveSearchPath, triggering the message
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("clears the helper message when a subsequent search succeeds", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");

      // First: trigger helper message
      await user.type(input, "xyzunknown");
      await user.click(screen.getByRole("button", { name: /search/i }));
      expect(screen.getByRole("status")).toBeInTheDocument();

      // Second: clear and search a valid keyword
      await user.clear(input);
      await user.type(input, "market");
      await user.click(screen.getByRole("button", { name: /search/i }));

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith("/marketplace");
    });

    it("uses aria-live='polite' on the status message", async () => {
      const user = userEvent.setup();
      renderNotFound();

      const input = screen.getByRole("searchbox");
      await user.type(input, "xyzunknown");
      await user.click(screen.getByRole("button", { name: /search/i }));

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });
  });

  // ── Go to Home button ────────────────────────────────────────────────────

  describe("Go to Home button", () => {
    it("calls onGoHome when clicked", async () => {
      const user = userEvent.setup();
      const { onGoHome } = renderNotFound();

      await user.click(screen.getByRole("button", { name: /go to home/i }));

      expect(onGoHome).toHaveBeenCalledOnce();
    });
  });

  // ── Go Back button (handleGoBack) ────────────────────────────────────────

  describe("Go Back button (handleGoBack)", () => {
    it("navigates back when history.length > 1", async () => {
      const user = userEvent.setup();

      // Simulate browser having history entries
      const originalLength = Object.getOwnPropertyDescriptor(
        window.history,
        "length",
      );
      Object.defineProperty(window.history, "length", {
        value: 3,
        writable: true,
        configurable: true,
      });

      const { onGoHome } = renderNotFound();

      await user.click(screen.getByRole("button", { name: /go back/i }));

      expect(mockNavigate).toHaveBeenCalledWith(-1);
      expect(onGoHome).not.toHaveBeenCalled();

      // Restore
      if (originalLength) {
        Object.defineProperty(window.history, "length", originalLength);
      }
    });

    it("calls onGoHome when history.length is 1 (no history)", async () => {
      const user = userEvent.setup();

      const originalLength = Object.getOwnPropertyDescriptor(
        window.history,
        "length",
      );
      Object.defineProperty(window.history, "length", {
        value: 1,
        writable: true,
        configurable: true,
      });

      const { onGoHome } = renderNotFound();

      await user.click(screen.getByRole("button", { name: /go back/i }));

      expect(onGoHome).toHaveBeenCalledOnce();
      expect(mockNavigate).not.toHaveBeenCalled();

      // Restore
      if (originalLength) {
        Object.defineProperty(window.history, "length", originalLength);
      }
    });
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("has a section with aria-labelledby pointing to the heading", () => {
      const { container } = renderNotFound();
      const section = container.querySelector(
        'section[aria-labelledby="not-found-title"]',
      );
      expect(section).toBeInTheDocument();
    });

    it("search form has role='search'", () => {
      renderNotFound();
      expect(screen.getByRole("search")).toBeInTheDocument();
    });

    it("search input has an associated label", () => {
      renderNotFound();
      expect(screen.getByLabelText("Search for a page")).toBeInTheDocument();
    });
  });
});
