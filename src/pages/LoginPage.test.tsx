// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../hooks/useDocumentTitle", () => ({
  default: vi.fn(),
}));

function renderPage(props?: Partial<React.ComponentProps<typeof LoginPage>>) {
  return render(
    <MemoryRouter>
      <LoginPage {...props} />
    </MemoryRouter>,
  );
}

function getLiveRegion(): HTMLElement {
  return screen.getByTestId("live-region-login-status");
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders the sign-in heading and form fields", () => {
      renderPage();
      expect(screen.getByRole("heading", { level: 1, name: /Sign in/i })).toBeTruthy();
      expect(screen.getByLabelText(/^Email$/i)).toBeTruthy();
      expect(screen.getByLabelText(/^Password$/i)).toBeTruthy();
      expect(screen.getByTestId("login-submit")).toBeTruthy();
    });

    it("renders a polite aria-live region for status updates", () => {
      renderPage();
      const region = getLiveRegion();
      expect(region.getAttribute("aria-live")).toBe("polite");
      expect(region.getAttribute("role")).toBe("status");
      expect(region.getAttribute("aria-atomic")).toBe("true");
    });
  });

  describe("aria-live status announcements", () => {
    it("announces validation when credentials are empty", async () => {
      renderPage({
        onSubmit: vi.fn(() => Promise.resolve()),
      });

      fireEvent.click(screen.getByTestId("login-submit"));

      await waitFor(() => {
        expect(getLiveRegion().textContent).toMatch(/Enter both email and password/i);
      });
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("announces submitting then success on a successful sign-in", async () => {
      let resolveSignIn!: () => void;
      const onSubmit = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSignIn = resolve;
          }),
      );

      renderPage({ onSubmit });

      fireEvent.change(screen.getByLabelText(/^Email$/i), {
        target: { value: "dev@callora.dev" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "secret" },
      });
      fireEvent.click(screen.getByTestId("login-submit"));

      await waitFor(() => {
        expect(getLiveRegion().textContent).toMatch(/Signing in/i);
      });

      expect(screen.getByTestId("login-status-banner").getAttribute("data-status")).toBe(
        "submitting",
      );
      expect(screen.getByTestId("login-submit").getAttribute("aria-busy")).toBe("true");

      resolveSignIn();

      await waitFor(() => {
        expect(getLiveRegion().textContent).toMatch(/Sign-in successful/i);
      });
      expect(screen.getByTestId("login-status-banner").getAttribute("data-status")).toBe(
        "success",
      );
    });

    it("announces failure details when sign-in rejects", async () => {
      const onSubmit = vi.fn(() =>
        Promise.reject(new Error("Invalid credentials")),
      );

      renderPage({ onSubmit });

      fireEvent.change(screen.getByLabelText(/^Email$/i), {
        target: { value: "dev@callora.dev" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "wrong" },
      });
      fireEvent.click(screen.getByTestId("login-submit"));

      await waitFor(() => {
        expect(getLiveRegion().textContent).toMatch(/Sign-in failed/i);
      });
      expect(getLiveRegion().textContent).toMatch(/Invalid credentials/i);
      expect(screen.getByTestId("login-status-banner").getAttribute("data-status")).toBe(
        "error",
      );
      expect(screen.getByText("Invalid credentials")).toBeTruthy();
    });
  });

  describe("form behavior", () => {
    it("disables the submit button while submitting", async () => {
      const onSubmit = vi.fn(() => new Promise<void>(() => {}));
      renderPage({ onSubmit });

      fireEvent.change(screen.getByLabelText(/^Email$/i), {
        target: { value: "dev@callora.dev" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "secret" },
      });
      fireEvent.click(screen.getByTestId("login-submit"));

      await waitFor(() => {
        expect(screen.getByTestId("login-submit")).toBeDisabled();
      });
    });

    it("calls onSubmit with trimmed email and password", async () => {
      const onSubmit = vi.fn(() => Promise.resolve());
      renderPage({ onSubmit });

      fireEvent.change(screen.getByLabelText(/^Email$/i), {
        target: { value: "  dev@callora.dev  " },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "secret" },
      });
      fireEvent.click(screen.getByTestId("login-submit"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith("dev@callora.dev", "secret");
      });
    });

    it("navigates to the success redirect after a successful sign-in", async () => {
      const onSubmit = vi.fn(() => Promise.resolve());
      renderPage({ onSubmit, successRedirect: "/dashboard" });

      fireEvent.change(screen.getByLabelText(/^Email$/i), {
        target: { value: "dev@callora.dev" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "secret" },
      });
      fireEvent.click(screen.getByTestId("login-submit"));

      await waitFor(() => {
        expect(getLiveRegion().textContent).toMatch(/Sign-in successful/i);
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
      });
    });
  });
});
