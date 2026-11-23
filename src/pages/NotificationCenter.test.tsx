// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import NotificationCenter from "./NotificationCenter";
import type { NotificationItem } from "../api/notificationsApi";

const mockFetchNotifications = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

vi.mock("../api/notificationsApi", async () => {
  const actual = await vi.importActual<typeof import("../api/notificationsApi")>(
    "../api/notificationsApi",
  );
  return {
    ...actual,
    fetchNotifications: (...args: unknown[]) => mockFetchNotifications(...args),
    markRead: (...args: unknown[]) => mockMarkRead(...args),
    markAllRead: (...args: unknown[]) => mockMarkAllRead(...args),
  };
});

function renderPage(props?: React.ComponentProps<typeof NotificationCenter>) {
  return render(
    <MemoryRouter>
      <NotificationCenter {...props} />
    </MemoryRouter>,
  );
}

describe("NotificationCenter", () => {
  beforeEach(() => {
    mockFetchNotifications.mockReset();
    mockMarkRead.mockReset();
    mockMarkAllRead.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("hides the feed when signed out", () => {
    renderPage({ enabled: false });

    expect(screen.getByText("Sign in to view notifications")).toBeTruthy();
    expect(mockFetchNotifications).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pinned-campaign-banner")).toBeNull();
  });

  it("renders empty state when feed returns no items", async () => {
    mockFetchNotifications.mockResolvedValueOnce({ items: [], nextCursor: null });

    renderPage({ enabled: true });

    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeTruthy();
    });
    expect(screen.queryByTestId("pinned-campaign-banner")).toBeNull();
  });

  it("renders error state with retry button", async () => {
    mockFetchNotifications
      .mockRejectedValueOnce(new Error("Service unavailable"))
      .mockResolvedValueOnce({ items: [], nextCursor: null });

    renderPage({ enabled: true });

    await waitFor(() => {
      expect(screen.getByText("Could not load notifications")).toBeTruthy();
      expect(screen.getByText("Service unavailable")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeTruthy();
    });
  });

  it("renders grouped list, campaign banner only when campaign item exists, and supports mark-read", async () => {
    const longTitle =
      "SuperLongNotificationTitleWithoutSpaces".repeat(4);
    const items: NotificationItem[] = [
      {
        id: "camp-1",
        title: "GrantFox FWC26 Campaign Live",
        body: "Welcome to the new campaign dashboard.",
        createdAt: new Date().toISOString(),
        readAt: null,
        kind: "campaign",
      },
      {
        id: "usage-1",
        title: longTitle,
        body: "Quota threshold reached.",
        createdAt: new Date().toISOString(),
        readAt: null,
        kind: "usage",
        href: "/api-usage",
      },
    ];

    mockFetchNotifications.mockResolvedValueOnce({ items, nextCursor: null });
    mockMarkRead.mockResolvedValueOnce(undefined);

    renderPage({ enabled: true });

    await waitFor(() => {
      expect(screen.getByTestId("pinned-campaign-banner")).toBeTruthy();
    });

    // Responsive image srcset preserved
    const img = screen.getByAltText("GrantFox FWC26 Campaign Announcement");
    expect(img.getAttribute("srcset")).toContain("/assets/grantfox-desktop.webp 1024w");
    expect(screen.getByText(longTitle)).toBeTruthy();

    // Mark one item as read
    const markBtn = screen.getByRole("button", {
      name: `Mark as read: ${longTitle}`,
    });
    fireEvent.click(markBtn);

    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalledWith("usage-1");
    });
  });
});
