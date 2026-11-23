import { authFetch } from "../services/authFetch";

export type NotificationKind =
  | "campaign"
  | "billing"
  | "usage"
  | "system"
  | "security"
  | (string & {});

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  kind: NotificationKind;
  href?: string;
}

export interface FetchNotificationsParams {
  cursor?: string | null;
  signal?: AbortSignal;
}

export interface FetchNotificationsResult {
  items: NotificationItem[];
  nextCursor: string | null;
}

export class NotificationsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NotificationsApiError";
    this.status = status;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return !trimmed.startsWith("//");
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Validate and normalize a single notification record.
 * Returns `null` if the item is malformed so callers can safely drop it.
 */
export function parseNotificationItem(value: unknown): NotificationItem | null {
  if (!isRecord(value)) return null;

  const { id, title, body, createdAt, readAt, kind, href } = value;

  if (typeof id !== "string" || id.trim().length === 0) return null;
  if (typeof title !== "string" || title.trim().length === 0) return null;
  if (typeof body !== "string") return null;
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) {
    return null;
  }
  if (readAt !== null && typeof readAt !== "string") return null;
  if (typeof readAt === "string" && Number.isNaN(Date.parse(readAt))) {
    return null;
  }
  if (typeof kind !== "string" || kind.trim().length === 0) return null;

  if (href !== undefined && href !== null) {
    if (typeof href !== "string") return null;
  }

  const normalized: NotificationItem = {
    id: id.trim(),
    title,
    body,
    createdAt,
    readAt,
    kind: kind.trim(),
  };

  if (typeof href === "string" && isSafeHref(href)) {
    normalized.href = href.trim();
  }

  return normalized;
}

export async function fetchNotifications(
  params: FetchNotificationsParams = {},
): Promise<FetchNotificationsResult> {
  const { cursor, signal } = params;
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await authFetch(`/api/notifications${query}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new NotificationsApiError(
      `Failed to load notifications (${response.status}).`,
      response.status,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new NotificationsApiError("Invalid notifications response.", response.status);
  }

  let rawItems: unknown[] | null = null;
  let nextCursor: string | null = null;

  if (Array.isArray(data)) {
    rawItems = data;
  } else if (isRecord(data)) {
    if (Array.isArray(data.items)) {
      rawItems = data.items;
    } else if (Array.isArray(data.notifications)) {
      rawItems = data.notifications;
    }

    if (typeof data.nextCursor === "string" && data.nextCursor.trim().length > 0) {
      nextCursor = data.nextCursor;
    } else if (typeof data.cursor === "string" && data.cursor.trim().length > 0) {
      nextCursor = data.cursor;
    }
  }

  if (!rawItems) {
    throw new NotificationsApiError("Invalid notifications payload.", response.status);
  }

  const items: NotificationItem[] = [];
  for (const raw of rawItems) {
    const parsed = parseNotificationItem(raw);
    if (parsed) {
      items.push(parsed);
    }
  }

  return { items, nextCursor };
}

export async function markRead(id: string, signal?: AbortSignal): Promise<void> {
  if (!id || !id.trim()) {
    throw new Error("Notification id is required.");
  }

  const response = await authFetch(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!response.ok) {
    throw new NotificationsApiError(
      `Failed to mark notification as read (${response.status}).`,
      response.status,
    );
  }
}

export async function markAllRead(signal?: AbortSignal): Promise<void> {
  const response = await authFetch("/api/notifications/read-all", {
    method: "POST",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new NotificationsApiError(
      `Failed to mark all notifications as read (${response.status}).`,
      response.status,
    );
  }
}
