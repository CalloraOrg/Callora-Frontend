import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchNotifications,
  markAllRead,
  markRead,
  NotificationsApiError,
  parseNotificationItem,
} from "./notificationsApi";

const mockAuthFetch = vi.fn();

vi.mock("../services/authFetch", () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("notificationsApi", () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
  });

  it("fetches notifications and drops malformed items", async () => {
    mockAuthFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "n1",
            title: "Usage alert",
            body: "You reached 80% of your quota.",
            createdAt: "2026-11-22T10:00:00.000Z",
            readAt: null,
            kind: "usage",
            href: "/api-usage",
          },
          // Malformed: missing title
          {
            id: "bad-1",
            body: "No title",
            createdAt: "2026-11-22T10:00:00.000Z",
            readAt: null,
            kind: "system",
          },
          // Malformed: invalid createdAt
          {
            id: "bad-2",
            title: "Bad date",
            body: "Invalid timestamp",
            createdAt: "not-a-date",
            readAt: null,
            kind: "system",
          },
          // Valid item with unsafe javascript: href (href should be stripped)
          {
            id: "n2",
            title: "Billing receipt",
            body: "Deposit confirmed.",
            createdAt: "2026-11-21T09:00:00.000Z",
            readAt: "2026-11-21T10:00:00.000Z",
            kind: "billing",
            href: "javascript:alert(1)",
          },
        ],
        nextCursor: "cur_2",
      }),
    );

    const result = await fetchNotifications({ cursor: "cur_1" });

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/api/notifications?cursor=cur_1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.nextCursor).toBe("cur_2");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: "n1",
      href: "/api-usage",
    });
    expect(result.items[1]).toMatchObject({
      id: "n2",
    });
    expect(result.items[1].href).toBeUndefined();
  });

  it("throws NotificationsApiError with isUnauthorized on 401", async () => {
    mockAuthFetch.mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));

    await expect(fetchNotifications()).rejects.toSatisfy((err: unknown) => {
      return err instanceof NotificationsApiError && err.status === 401 && err.isUnauthorized;
    });
  });

  it("calls POST /api/notifications/:id/read for markRead", async () => {
    mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await markRead("notif/1");

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/api/notifications/notif%2F1/read",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls POST /api/notifications/read-all for markAllRead", async () => {
    mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await markAllRead();

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/api/notifications/read-all",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("parseNotificationItem rejects non-objects and missing required fields", () => {
    expect(parseNotificationItem(null)).toBeNull();
    expect(parseNotificationItem("str")).toBeNull();
    expect(
      parseNotificationItem({
        id: "",
        title: "Hi",
        body: "Body",
        createdAt: "2026-11-22T10:00:00.000Z",
        readAt: null,
        kind: "system",
      }),
    ).toBeNull();
  });
});
