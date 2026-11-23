// @vitest-environment jsdom

import React, { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RequireAuth, {
  RETURN_TO_STORAGE_KEY,
  sanitizeReturnTo,
} from "./RequireAuth";
import {
  resetSessionExpiryForTests,
  signalExpiry,
} from "../services/sessionExpiry";

const authState = vi.hoisted(() => {
  let signedIn = false;
  const listeners = new Set<() => void>();
  return {
    get signedIn() {
      return signedIn;
    },
    setSignedIn(next: boolean) {
      signedIn = next;
      for (const listener of Array.from(listeners)) {
        listener();
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    signIn: vi.fn(),
    reset() {
      signedIn = false;
      listeners.clear();
      this.signIn.mockReset();
    },
  };
});

vi.mock("../services/authService", () => {
  return {
    isSignedIn: () => authState.signedIn,
    subscribeAuth: (listener: () => void) => authState.subscribe(listener),
    useIsSignedIn: () =>
      React.useSyncExternalStore(
        authState.subscribe,
        () => authState.signedIn,
        () => authState.signedIn,
      ),
    signIn: (...args: unknown[]) => authState.signIn(...args),
  };
});

function LocationDisplay() {
  const loc = useLocation();
  return (
    <div data-testid="current-location">
      {loc.pathname}
      {loc.search}
      {loc.hash}
    </div>
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    authState.reset();
    resetSessionExpiryForTests();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the sign-in prompt when signed out and does not mount protected content or call protected APIs", () => {
    const protectedApiCall = vi.fn();

    function ProtectedPage() {
      useEffect(() => {
        protectedApiCall();
      }, []);
      return <div>Secret Billing Page</div>;
    }

    render(
      <MemoryRouter initialEntries={["/billing?deposit=true"]}>
        <Routes>
          <Route
            path="/billing"
            element={
              <RequireAuth>
                <ProtectedPage />
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /sign in to continue/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /connect freighter/i })).toBeTruthy();
    expect(screen.queryByText("Secret Billing Page")).toBeNull();
    expect(protectedApiCall).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RETURN_TO_STORAGE_KEY)).toBe("/billing?deposit=true");
  });

  it("signs in and returns the user to the original URL including query string and hash", async () => {
    authState.signIn.mockImplementation(async () => {
      authState.setSignedIn(true);
      return { accessToken: "tok", walletAddress: "GABC" };
    });

    render(
      <MemoryRouter initialEntries={["/billing?deposit=true#summary"]}>
        <Routes>
          <Route
            path="/billing"
            element={
              <RequireAuth>
                <div>Secret Billing Page</div>
                <LocationDisplay />
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /connect freighter/i }));

    await waitFor(() => {
      expect(screen.getByText("Secret Billing Page")).toBeTruthy();
    });
    expect(screen.getByTestId("current-location").textContent).toBe(
      "/billing?deposit=true#summary",
    );
    expect(sessionStorage.getItem(RETURN_TO_STORAGE_KEY)).toBeNull();
  });

  it("keeps the user on the prompt with a link to marketplace when Freighter sign-in is rejected", async () => {
    authState.signIn.mockRejectedValue(
      Object.assign(new Error("Signature rejected by the user."), {
        code: "SIGNATURE_REJECTED",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/apis/my-apis"]}>
        <Routes>
          <Route
            path="/apis/my-apis"
            element={
              <RequireAuth>
                <div>My APIs Content</div>
              </RequireAuth>
            }
          />
          <Route path="/marketplace" element={<div>Marketplace Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /connect freighter/i }));

    await waitFor(() => {
      expect(authState.signIn).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("heading", { name: /sign in to continue/i })).toBeTruthy();
    expect(screen.queryByText("My APIs Content")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

    const marketplaceLink = screen.getByRole("link", { name: /back to marketplace/i });
    expect(marketplaceLink.getAttribute("href")).toBe("/marketplace");
  });

  it("rejects open-redirect return targets and falls back to /dashboard", async () => {
    expect(sanitizeReturnTo("//evil.com")).toBe("/dashboard");
    expect(sanitizeReturnTo("https://evil.com")).toBe("/dashboard");
    expect(sanitizeReturnTo("https://evil.com/billing")).toBe("/dashboard");
    expect(sanitizeReturnTo("/\\evil.com")).toBe("/dashboard");
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/dashboard");
    expect(sanitizeReturnTo("/billing?tab=1#top")).toBe("/billing?tab=1#top");

    authState.signIn.mockImplementation(async () => {
      authState.setSignedIn(true);
      return { accessToken: "tok", walletAddress: "GABC" };
    });

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/billing", state: { returnTo: "//evil.com" } },
        ]}
      >
        <Routes>
          <Route
            path="/billing"
            element={
              <RequireAuth>
                <div>Billing Page</div>
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <div>
                Dashboard Page
                <LocationDisplay />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /connect freighter/i }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard Page")).toBeTruthy();
    });
    expect(screen.getByTestId("current-location").textContent).toBe("/dashboard");
  });

  it("reacts to mid-session expiry by replacing the protected page with the sign-in prompt", () => {
    authState.setSignedIn(true);

    render(
      <MemoryRouter initialEntries={["/webhooks/deliveries"]}>
        <Routes>
          <Route
            path="/webhooks/deliveries"
            element={
              <RequireAuth>
                <div>Webhook Deliveries Content</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Webhook Deliveries Content")).toBeTruthy();

    act(() => {
      signalExpiry("expired");
    });

    expect(screen.queryByText("Webhook Deliveries Content")).toBeNull();
    expect(screen.getByRole("heading", { name: /your session has expired/i })).toBeTruthy();
  });

  it("renders protected content immediately once a refreshed token restores the session", () => {
    render(
      <MemoryRouter initialEntries={["/publish"]}>
        <Routes>
          <Route
            path="/publish"
            element={
              <RequireAuth>
                <div>Publish API Page</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Publish API Page")).toBeNull();

    act(() => {
      authState.setSignedIn(true);
    });

    expect(screen.getByText("Publish API Page")).toBeTruthy();
  });
});
