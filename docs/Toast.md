# Toast

`src/components/Toast.tsx`

The app-wide toast notification system: a single `ToastProvider` that owns the
toast queue and a `useToast` hook for showing messages from anywhere in the tree.

---

## Provider location

There is **exactly one** `ToastProvider`, mounted in `src/main.tsx`. It wraps
every route render path (the `/publish`, `/marketplace`, `/details/`,
`/latency-chart` branches and the default `App`), so any component in the tree
can call `useToast()`.

Do **not** mount a second `ToastProvider` in `App.tsx` or anywhere else. The
provider renders the shared `.toast-queue` container; two providers would create
two independent queues, split notifications across two DOM containers, and make
the visible toast order depend on which provider received the call. Components
should assume the ancestor provider from `main.tsx` and never wrap themselves.

---

## API

```tsx
import { ToastProvider, useToast } from "../components/Toast";
```

### `ToastProvider`

Context provider. Renders `children` plus the fixed-position toast container.
Mount it once, at the application root (`src/main.tsx`).

### `useToast(): { showToast }`

Returns the context value. Throws if called outside a `ToastProvider`
(`"useToast must be used within a ToastProvider"`).

| Member | Signature | Description |
|--------|-----------|-------------|
| `showToast` | `(messageOrOptions: string \| ToastOptions, variant?: ToastVariant) => void` | Enqueues a toast. `variant` defaults to `"success"` |

### `ToastOptions`

```ts
type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  persistent?: boolean; // stays until dismissed; never auto-dismissed
  duration?: number;    // ms before auto-dismiss; overrides the default
};
```

### `ToastVariant`

```ts
type ToastVariant = "success" | "error" | "warning";
```

---

## Variants

| Variant | Icon | Use for | Example message |
|---------|------|---------|-----------------|
| `success` (default) | check | Confirmed completions the user was waiting on | `"API key rotated successfully."` |
| `error` | cross | Failures that need user action or retry | `"Failed to rotate API key. Please try again."` |
| `warning` | triangle | Caution states that are not failures yet | `"Balance is low — deposits may fail."` |

Choose the variant that matches the *outcome*, not the severity of the log.
Prefer plain, non-technical language; keep messages to one sentence. Never put
secrets (API keys, tokens, hashes) in a toast message — toasts are announced by
screen readers and may remain visible while the user shares their screen.

### Message guidelines

- Write in the user's vocabulary ("Deposit successful", not "tx confirmed on ledger").
- State the outcome first; add the next action second ("Deposit failed. Check your wallet and retry.").
- Keep messages short enough to read in one glance (the container is capped at 400px wide).
- Use sentence case and end without a period for fragment-style confirmations, or with one for full sentences — stay consistent within a screen.

---

## Queue behaviour

- **Cap:** the queue holds at most **4** toasts (`MAX_TOASTS`). When a fifth
  arrives, the oldest **non-persistent** toast is evicted; if every visible
  toast is persistent, the oldest toast is evicted instead.
- **Timing:** each non-persistent toast auto-dismisses after **5000 ms**
  (`DEFAULT_DURATION`), or **10000 ms** for `error` toasts, unless
  `duration` is passed. `persistent: true` toasts stay until dismissed.
- **Exit animation:** removal is staged — the toast is marked `exiting`, slides
  out over **200 ms**, and is then dropped from state.
- **Manual dismissal:** every toast renders a close button
  (`aria-label="Dismiss notification: <message>"`).

---

## Pause behaviour

The auto-dismiss timer pauses while the user interacts with a toast and resumes
with the **remaining** time afterwards:

| Event | Effect |
|-------|--------|
| `mouseenter` | Timer paused, remaining time stored |
| `mouseleave` | Timer resumes with remaining time |
| `focus` | Timer paused (keyboard or screen-reader focus) |
| `blur` | Timer resumes with remaining time |

Hovering never "resets" the 5 s window — users get at most the remainder, so a
toast can never be held on screen indefinitely by wiggling the mouse.

---

## Accessibility

- The queue container has `role="status"` and `aria-live="polite"`, so toasts
  are announced without interrupting the user's current task.
- The container has `aria-label="Notifications"`.
- Errors are announced politely, not assertively (`role="alert"` is not used
  here) — pair critical in-page failures with an inline `role="alert"` region if
  immediate announcement is required (see `KeyRotationModal`).
- Each close button is keyboard reachable and has a descriptive `aria-label`
  that includes the toast message.
- Pause-on-focus means a toast will not disappear while a keyboard or screen
  reader user is interacting with it.
- The progress indicator and slide animations are disabled under
  `prefers-reduced-motion: reduce`.
- Colour is never the only signal: each variant carries a distinct icon.

---

## Usage examples

### Basic usage (inside the app tree — provider already exists)

```tsx
import { useToast } from "../components/Toast";

function SaveButton() {
  const { showToast } = useToast();

  return (
    <button onClick={() => showToast("Settings saved.")}>Save</button>
  );
}
```

### Every variant

```tsx
const { showToast } = useToast();

showToast("API key rotated successfully.");        // success (default)
showToast("Failed to rotate API key. Please try again.", "error");
showToast("Balance is low — deposits may fail.", "warning");
```

### Error path with retry hint

```tsx
try {
  await publishApi(payload);
  showToast("API published.");
} catch {
  showToast("Publish failed. Check the endpoint URL and retry.", "error");
}
```

### Testing a component that calls `useToast`

Tests must wrap the component in `ToastProvider` themselves (the app provider in
`main.tsx` is not mounted under Vitest):

```tsx
import { ToastProvider } from "../components/Toast";

render(
  <ToastProvider>
    <KeyRotationModal {...props} />
  </ToastProvider>
);
```

---

## Consumers

| Component | Usage |
|-----------|-------|
| `src/pages/ApiDetailPage.tsx` | Success/error feedback for API actions |
| `src/pages/KeyRotationModal.tsx` | Rotation success and failure toasts |
| `src/pages/PlanBadge.tsx` | Plan change confirmations |
| `src/pages/WebhookDeliveries.tsx` | Delivery action feedback |

---

## Tests

`src/components/Toast.test.tsx` — covers:

- Variant rendering and default variant
- Queue cap of 4 with oldest non-persistent eviction
- Auto-dismiss after 5 s and the 200 ms exit animation
- Pause on hover/focus and resume with remaining time
- Manual dismissal via the close button
- `useToast` throwing outside a provider
- Accessibility: `role="status"`, `aria-live="polite"`, per-toast close labels

Run with:

```bash
npx vitest run src/components/Toast.test.tsx
```
