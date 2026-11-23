import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import LiveRegion from "../components/LiveRegion";
import type { NotificationItem } from "../api/notificationsApi";
import {
  useNotifications,
  useNotificationsContext,
  type UseNotificationsResult,
} from "../hooks/useNotifications";

export interface NotificationCenterProps {
  /** Override signed-in state (primarily for tests). */
  enabled?: boolean;
  /** Optional external hook state (primarily for tests). */
  notificationsState?: UseNotificationsResult;
}

interface NotificationGroup {
  dateKey: string;
  label: string;
  items: NotificationItem[];
}

function getDateKey(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateGroupLabel(isoDate: string, now: Date): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const todayKey = getDateKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday.toISOString());

  const itemKey = getDateKey(isoDate);
  if (itemKey === todayKey) return "Today";
  if (itemKey === yesterdayKey) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupNotificationsByDate(items: NotificationItem[]): NotificationGroup[] {
  const now = new Date();
  const sorted = [...items].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

  const groups = new Map<string, NotificationGroup>();
  for (const item of sorted) {
    const dateKey = getDateKey(item.createdAt);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(dateKey, {
        dateKey,
        label: formatDateGroupLabel(item.createdAt, now),
        items: [item],
      });
    }
  }

  return Array.from(groups.values());
}

export default function NotificationCenter({
  enabled,
  notificationsState,
}: NotificationCenterProps = {}) {
  const [announcement, setAnnouncement] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const handleActionError = useCallback((message: string) => {
    setActionError(message);
    setAnnouncement(message);
  }, []);

  const contextState = useNotificationsContext();
  const useExternal = Boolean(notificationsState || contextState);
  const localState = useNotifications({
    enabled: useExternal ? false : enabled,
    onActionError: handleActionError,
  });

  const state = notificationsState ?? contextState ?? localState;
  const {
    items,
    status,
    error,
    isLoading,
    isLoadingMore,
    isEmpty,
    hasMore,
    unreadCount,
    isSignedIn: signedIn,
    pendingIds,
    isMarkingAll,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = state;

  const campaignItem = useMemo(
    () => items.find((item) => item.kind === "campaign") ?? null,
    [items],
  );

  const groups = useMemo(() => groupNotificationsByDate(items), [items]);

  const handleMarkAsRead = useCallback(
    async (item: NotificationItem) => {
      setActionError(null);
      const ok = await markAsRead(item.id);
      if (ok) {
        setAnnouncement(`Marked "${item.title}" as read.`);
      } else {
        const msg = "Could not mark notification as read. Please try again.";
        setActionError(msg);
        setAnnouncement(msg);
      }
    },
    [markAsRead],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    setActionError(null);
    const ok = await markAllAsRead();
    if (ok) {
      setAnnouncement("All notifications marked as read.");
    } else {
      const msg = "Could not mark all notifications as read. Please try again.";
      setActionError(msg);
      setAnnouncement(msg);
    }
  }, [markAllAsRead]);

  return (
    <div
      className="notification-center-page"
      style={{
        padding: "var(--mkt-space-3xl, 2rem)",
        maxWidth: "960px",
        margin: "0 auto",
      }}
    >
      <LiveRegion message={announcement} />

      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Notifications", href: "", isCurrent: true },
        ]}
      />

      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "var(--mkt-space-2xl, 1.5rem)",
          marginTop: "var(--mkt-space-xl, 1.25rem)",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Notification Center</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px", marginBottom: 0 }}>
            Stay updated on your API usage, billing, and current campaigns.
          </p>
        </div>

        {signedIn && unreadCount > 0 && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleMarkAllAsRead()}
            disabled={isMarkingAll}
            aria-busy={isMarkingAll}
          >
            {isMarkingAll ? "Marking all as read…" : "Mark all as read"}
          </button>
        )}
      </header>

      <section aria-label="Notifications feed">
        {!signedIn ? (
          <div
            className="surface"
            style={{
              padding: "var(--mkt-space-3xl, 2rem)",
              borderRadius: "var(--radius-lg, 12px)",
              textAlign: "center",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Sign in to view notifications</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>
              Connect and sign in with your wallet to see your notifications feed.
            </p>
          </div>
        ) : (
          <>
            {actionError && (
              <div
                role="alert"
                className="status-banner"
                style={{
                  marginBottom: "1rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--danger, #ff7d8d)",
                }}
              >
                {actionError}
              </div>
            )}

            {campaignItem && (
              <aside
                aria-label="Pinned campaign announcement"
                className="surface"
                data-testid="pinned-campaign-banner"
                style={{
                  padding: "var(--mkt-space-2xl, 1.5rem)",
                  borderRadius: "var(--radius-lg, 12px)",
                  marginBottom: "var(--mkt-space-2xl, 1.5rem)",
                }}
              >
                {/* Issue #692: Implementation of responsive image srcset */}
                <picture>
                  <source
                    srcSet="/assets/grantfox-mobile.webp"
                    media="(max-width: 600px)"
                  />
                  <img
                    srcSet="/assets/grantfox-desktop.webp 1024w, /assets/grantfox-mobile.webp 480w"
                    sizes="(max-width: 600px) 480px, 1024px"
                    src="/assets/grantfox-desktop.webp"
                    alt="GrantFox FWC26 Campaign Announcement"
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: "var(--radius-md, 8px)",
                    }}
                    loading="lazy"
                  />
                </picture>
                <div style={{ marginTop: "var(--mkt-space-lg, 1rem)" }}>
                  <h2
                    style={{
                      margin: "0 0 0.5rem 0",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {campaignItem.title}
                  </h2>
                  <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                    {campaignItem.body}
                  </p>
                </div>
              </aside>
            )}

            {isLoading && items.length === 0 && (
              <div
                className="surface"
                role="status"
                aria-busy="true"
                style={{
                  padding: "var(--mkt-space-3xl, 2rem)",
                  borderRadius: "var(--radius-lg, 12px)",
                  textAlign: "center",
                }}
              >
                Loading notifications…
              </div>
            )}

            {status === "error" && items.length === 0 && (
              <div
                className="surface"
                role="alert"
                style={{
                  padding: "var(--mkt-space-3xl, 2rem)",
                  borderRadius: "var(--radius-lg, 12px)",
                  textAlign: "center",
                }}
              >
                <h2 style={{ marginTop: 0 }}>Could not load notifications</h2>
                <p style={{ color: "var(--text-secondary)" }}>
                  {error ?? "An unexpected error occurred."}
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void refresh()}
                >
                  Retry
                </button>
              </div>
            )}

            {isEmpty && (
              <div
                className="surface"
                style={{
                  padding: "var(--mkt-space-3xl, 2rem)",
                  borderRadius: "var(--radius-lg, 12px)",
                  textAlign: "center",
                }}
              >
                <h2 style={{ marginTop: 0 }}>No notifications yet</h2>
                <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>
                  You&apos;re all caught up. Updates about your API usage, billing, and
                  campaigns will appear here.
                </p>
              </div>
            )}

            {groups.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {groups.map((group) => (
                  <section
                    key={group.dateKey}
                    aria-labelledby={`notif-group-${group.dateKey}`}
                  >
                    <h2
                      id={`notif-group-${group.dateKey}`}
                      style={{
                        fontSize: "0.9rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--text-secondary)",
                        margin: "0 0 0.75rem 0",
                      }}
                    >
                      {group.label}
                    </h2>

                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      {group.items.map((item) => {
                        const isUnread = item.readAt === null;
                        const isPending = pendingIds.has(item.id);

                        return (
                          <li
                            key={item.id}
                            className={`surface notification-item${isUnread ? " notification-item--unread" : ""}`}
                            data-unread={isUnread ? "true" : "false"}
                            style={{
                              padding: "1rem 1.25rem",
                              borderRadius: "var(--radius-md, 10px)",
                              borderLeft: isUnread
                                ? "4px solid var(--accent, #4e85ff)"
                                : "4px solid transparent",
                              background: isUnread
                                ? "var(--surface-soft, rgba(78, 133, 255, 0.08))"
                                : undefined,
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: "1rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {isUnread && (
                                    <span
                                      aria-label="Unread"
                                      style={{
                                        display: "inline-block",
                                        width: "8px",
                                        height: "8px",
                                        borderRadius: "50%",
                                        background: "var(--accent, #4e85ff)",
                                        flexShrink: 0,
                                      }}
                                    />
                                  )}
                                  <h3
                                    style={{
                                      margin: 0,
                                      fontSize: "1rem",
                                      fontWeight: isUnread ? 700 : 500,
                                      overflowWrap: "anywhere",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {item.title}
                                  </h3>
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      padding: "2px 8px",
                                      borderRadius: "999px",
                                      background: "var(--surface-soft, rgba(255,255,255,0.06))",
                                      color: "var(--text-secondary)",
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {item.kind}
                                  </span>
                                </div>

                                <p
                                  style={{
                                    margin: "0.35rem 0 0 0",
                                    color: "var(--text-secondary)",
                                    lineHeight: 1.5,
                                    overflowWrap: "anywhere",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {item.body}
                                </p>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.75rem",
                                  flexShrink: 0,
                                }}
                              >
                                <time
                                  dateTime={item.createdAt}
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "var(--text-secondary)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {formatTimestamp(item.createdAt)}
                                </time>

                                {isUnread && (
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => void handleMarkAsRead(item)}
                                    disabled={isPending || isMarkingAll}
                                    aria-label={`Mark as read: ${item.title}`}
                                  >
                                    Mark as read
                                  </button>
                                )}
                              </div>
                            </div>

                            {item.href && (
                              <div>
                                {item.href.startsWith("/") ? (
                                  <Link to={item.href} style={{ fontSize: "0.85rem" }}>
                                    View details
                                  </Link>
                                ) : (
                                  <a
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: "0.85rem" }}
                                  >
                                    View details
                                  </a>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}

                {hasMore && (
                  <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void loadMore()}
                      disabled={isLoadingMore}
                      aria-busy={isLoadingMore}
                    >
                      {isLoadingMore ? "Loading more…" : "Load more"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
