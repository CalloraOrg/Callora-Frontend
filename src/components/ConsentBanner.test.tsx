// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConsentBanner, { AnalyticsToggle } from "./ConsentBanner";
import { analytics } from "../services/AnalyticsService";
import { getPref, PREFS_STORAGE_KEY, setPref } from "../utils/userPrefs";

describe("ConsentBanner & AnalyticsToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    analytics.clearQueue();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    analytics.clearQueue();
  });

  it("renders a non-blocking, keyboard-accessible banner until a decision is made", () => {
    render(<ConsentBanner />);

    const region = screen.getByRole("region", { name: /analytics consent/i });
    expect(region).toBeTruthy();
    expect(region.getAttribute("aria-modal")).toBeNull();

    const acceptBtn = screen.getByRole("button", { name: /^accept$/i });
    const declineBtn = screen.getByRole("button", { name: /^decline$/i });
    expect(acceptBtn).toBeTruthy();
    expect(declineBtn).toBeTruthy();
  });

  it("persists consent and hides the banner on Accept", () => {
    render(<ConsentBanner />);

    fireEvent.click(screen.getByRole("button", { name: /^accept$/i }));

    expect(getPref("analyticsConsent")).toBe(true);
    expect(getPref("analyticsConsentDecided")).toBe(true);
    expect(screen.queryByRole("region", { name: /analytics consent/i })).toBeNull();
  });

  it("persists decline, clears the queue, and does not re-prompt on remount", () => {
    const clearSpy = vi.spyOn(analytics, "clearQueue");
    const { unmount } = render(<ConsentBanner />);

    fireEvent.click(screen.getByRole("button", { name: /^decline$/i }));

    expect(getPref("analyticsConsent")).toBe(false);
    expect(getPref("analyticsConsentDecided")).toBe(true);
    expect(clearSpy).toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: /analytics consent/i })).toBeNull();

    unmount();
    render(<ConsentBanner />);
    expect(screen.queryByRole("region", { name: /analytics consent/i })).toBeNull();
  });

  it("recovers safely when stored prefs are malformed", () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, "{not valid json");
    render(<ConsentBanner />);
    expect(screen.getByRole("region", { name: /analytics consent/i })).toBeTruthy();
    expect(getPref("analyticsConsent")).toBe(false);
    expect(getPref("analyticsConsentDecided")).toBe(false);
  });

  it("AnalyticsToggle reads and writes analyticsConsent and clears queue when disabled", () => {
    setPref("analyticsConsent", true);
    setPref("analyticsConsentDecided", true);
    const clearSpy = vi.spyOn(analytics, "clearQueue");

    render(<AnalyticsToggle />);
    const toggle = screen.getByRole("switch", { name: /analytics/i });
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(getPref("analyticsConsent")).toBe(false);
    expect(clearSpy).toHaveBeenCalled();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(getPref("analyticsConsent")).toBe(true);
  });
});
