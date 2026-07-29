# SlaCard — Copy-to-Clipboard (Issue #545, FWC26 campaign)

Added per-value copy-to-clipboard buttons to the GrantFox Wave Compute API SLA
details page, backed by the new `useCopy` hook.

## Route

```
/marketplace/grantfox-wave-compute/sla
```

## What was added

### `src/hooks/useCopy.ts`

A reusable hook that writes text to the clipboard and drives a transient
"Copied!" feedback state.

#### API

```ts
import useCopy from "../hooks/useCopy";
// or
import { useCopy } from "../hooks/useCopy";

const { copied, supported, handleCopy } = useCopy();
```

| Member | Type | Description |
|--------|------|-------------|
| `copied` | `boolean` | `true` for 2 s after a successful copy. Use to swap labels / icons. |
| `supported` | `boolean` | `true` when the clipboard API *or* the `execCommand` fallback is available. Hide copy buttons when `false`. |
| `handleCopy` | `(text: string) => Promise<boolean>` | Copies `text`; returns `true` on success. |

#### Behaviour

- **Clipboard API first**: uses `navigator.clipboard.writeText` when available
  (requires HTTPS or `localhost`).
- **`execCommand` fallback**: creates an off-screen `<textarea>`, selects it,
  and calls `document.execCommand("copy")` for older browsers and HTTP contexts.
- **`copied` auto-resets** after 2 000 ms.
- **Timer restart**: clicking again before the 2 s window expires resets the
  countdown from the most recent click (no "Copy → Copied!" flicker).
- **Cleanup on unmount**: the pending timer is cancelled so React never updates
  state on an unmounted component.
- **`supported` flag**: `false` when neither mechanism is present so consumers
  can conditionally hide copy UI.

#### Exports

Both a default export and a named export are provided for flexibility:

```ts
import useCopy from "../hooks/useCopy";          // default
import { useCopy } from "../hooks/useCopy";       // named
```

---

### `src/pages/SlaCard.tsx`

The SLA details page for the GrantFox Wave Compute API – Stellar Edition.

Each of the 8 SLA metrics is displayed as a `<dt>` / `<dd>` pair inside a
`<dl>`. The `<dd>` contains both the value text and a copy button.

**SLA fields:**

| Field | Value |
|-------|-------|
| Uptime SLA | `99.95%` |
| P99 Response Time | `≤ 250 ms` |
| Incident Response | `< 15 minutes` |
| Maintenance Window | `Sundays 02:00–04:00 UTC` |
| Support Tier | `Priority (24/7)` |
| Credit Threshold | `< 99.5% triggers SLA credit` |
| API Version | `v2.4.1` |
| Contract ID | `FWC26-SLA-0042` |

**Copy interaction:**

1. User clicks the "Copy" button next to a value.
2. The button label changes to "Copied!" and the copy icon swaps to a green
   `CheckIcon`.
3. An `aria-live="polite"` region announces "<Field label> copied to
   clipboard" to screen readers (WCAG 2.1 AA SC 4.1.3).
4. After 2 seconds both the button label and the live region revert to their
   default state.
5. Each row's copy state is independent — clicking one button does not affect
   the others.

---

## Accessibility

| WCAG criterion | Implementation |
|----------------|----------------|
| 1.3.1 Info and Relationships | Values in a `<dl>` semantic structure. |
| 2.4.7 Focus Visible | `:focus-visible` outline uses `--accent` design token (2 px, 3 px offset). |
| 2.5.5 Target Size | Copy buttons have `min-height: 36px`; touch area ≥ 44 px via `padding`. |
| 4.1.2 Name, Role, Value | Each button has `aria-label="Copy <Field>: <Value>"`, changing to `"<Field> copied"` after success. |
| 4.1.3 Status Messages | `aria-live="polite" aria-atomic="true"` region per row announces copy outcome. |

---

## Design tokens used

| Token | Purpose |
|-------|---------|
| `--text` | Value text, page heading |
| `--muted` | Label text, idle copy button |
| `--surface` | Card background |
| `--border` | Card and row separator |
| `--accent` | Focus ring |
| `--success` | "Copied!" button / CheckIcon colour |

No hardcoded hex values — dark and light themes work automatically.

---

## Tests

| File | Count | What is covered |
|------|-------|-----------------|
| `src/hooks/__tests__/useCopy.test.ts` | 7 | Initial state, clipboard write, `copied` true after copy, 2 s reset, `execCommand` fallback, unmount cleanup, rapid re-copy timer restart |
| `src/pages/SlaCard.test.tsx` | 22 | Static rendering (heading, all 8 labels and values, 8 copy buttons, subtitle, region landmark), aria-labels, copy interaction, aria-live announcements, rapid re-copy, independent state per button |

Run with:

```bash
npx vitest run src/hooks/__tests__/useCopy.test.ts src/pages/SlaCard.test.tsx
```

---

## `src/App.tsx` changes

- Added `import SlaCard from "./pages/SlaCard"`.
- Added `slaCard: "/marketplace/grantfox-wave-compute/sla"` to `APP_ROUTES`.
- Added `<Route path={APP_ROUTES.slaCard} element={<SlaCard />} />`.

---

## `src/components/EmptyState.tsx` changes

`EmptyState` previously used the old `useCopy` API (`copy` + `supported`).
Updated to use `handleCopy` (renamed) while keeping the `supported` guard so
the copy button is hidden when neither clipboard mechanism is available.
