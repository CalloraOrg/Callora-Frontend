# NotificationCenter - Responsive Image srcSet & Feed Contract

## Responsive Campaign Banner

`NotificationCenter` preserves the responsive `<picture>` + `srcSet` banner for the GrantFox campaign:

- Mobile (`(max-width: 600px)`): `/assets/grantfox-mobile.webp` (`480w`)
- Desktop: `/assets/grantfox-desktop.webp` (`1024w`)
- Lazy-loaded (`loading="lazy"`)

The banner is rendered as a pinned announcement **only when the notifications feed contains an item with `kind: "campaign"`**.

## Feed API Contract

All requests are authenticated via `authFetch` and are skipped when the user is signed out.

### `GET /api/notifications`

Query parameters:

- `cursor` (optional): Opaque pagination cursor returned by the previous page.

Response payload (`200 OK`):

```json
{
  "items": [
    {
      "id": "notif_123",
      "title": "GrantFox FWC26 Campaign Live",
      "body": "Welcome to the new campaign dashboard.",
      "createdAt": "2026-11-22T10:00:00.000Z",
      "readAt": null,
      "kind": "campaign",
      "href": "/dashboard"
    }
  ],
  "nextCursor": "cursor_abc"
}
```

Item schema validation:

- `id`: non-empty string
- `title`: non-empty string
- `body`: string
- `createdAt`: valid ISO-8601 date string
- `readAt`: valid ISO-8601 date string or `null`
- `kind`: non-empty string (e.g. `"campaign"`, `"billing"`, `"usage"`, `"system"`, `"security"`)
- `href` (optional): relative path (`/…`) or `http(s)://` URL; unsafe schemes are stripped

Malformed items in the response array are dropped rather than failing the entire feed.

### `POST /api/notifications/:id/read`

Marks a single notification as read. The UI applies an optimistic update (immediately updating unread styling and the topbar badge) and rolls back if the request fails.

### `POST /api/notifications/read-all`

Marks all unread notifications as read. The UI applies an optimistic update and rolls back if the request fails.

## Polling & Session Handling

- `useNotifications` polls `GET /api/notifications` every 60 seconds while `document.visibilityState === "visible"`.
- Signed-out users do not trigger requests and do not see the feed or topbar notification bell.
- A `401 Unauthorized` response mid-session clears the feed and halts polling.
