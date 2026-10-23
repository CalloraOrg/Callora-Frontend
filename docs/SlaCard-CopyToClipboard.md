# SlaCard — Copy-to-Clipboard (Issue #545, Per-API SLA)

Per-value copy-to-clipboard buttons on the Service-Level Agreement (SLA)
details page, backed by the `useCopy` hook and dynamically resolved per API.

## Route

```
/marketplace/:apiId/sla
```

## What was added / updated

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

The SLA details page resolves the selected API from the catalogue using `fetchCatalog`.

#### Page States

1. **Loading**: Displays a skeleton placeholder with `aria-busy="true"`.
2. **Not Found**: When an invalid or unknown `apiId` is visited, an alert panel announces the not-found state with a link back to `/marketplace`.
3. **No Published SLA**: When an API does not define contractual SLA terms, a notice banner informs the user ("This provider has not published an SLA") and surfaces observed historical telemetry (Observed Uptime, Observed Average Latency) clearly labelled as observed and not contractual.
4. **Contractual SLA**: When an API defines an `sla` object in `APIItem`, contractual metrics are displayed inside a `<dl>` definition list with copy-to-clipboard buttons per value.

**Dynamic SLA fields (when defined):**

| Field | Source | Example Value |
|-------|--------|---------------|
| Uptime SLA | `api.sla.uptimeTargetPct` | `99.95%` |
| P99 Response Time | `api.sla.p99LatencyMs` | `≤ 250 ms` |
| Incident Response | `api.sla.incidentResponseMinutes` | `< 15 minutes` |
| Maintenance Window | `api.sla.maintenanceWindow` | `Sundays 02:00–04:00 UTC` |
| Support Tier | `api.sla.supportTier` | `Priority (24/7)` |
| Credit Threshold | `api.sla.creditThresholdPct` | `< 99.5% triggers SLA credit` |
| API Version | `api.version` | `v1.8.0` |

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
| 1.3.1 Info and Relationships | Values in a `<dl>` semantic structure; distinct observed vs contractual labels. |
| 2.4.7 Focus Visible | `:focus-visible` outline uses `--accent` design token (2 px, 2 px offset). |
| 2.5.5 Target Size | Copy buttons have `min-height: 36px`; touch area ≥ 44 px via `padding`. |
| 4.1.2 Name, Role, Value | Each button has `aria-label="Copy <Field>: <Value>"`, changing to `"<Field> copied"` after success. |
| 4.1.3 Status Messages | `aria-live="polite" aria-atomic="true"` region per row announces copy outcome; not-found state announced via `role="alert"`. |

---

## Design tokens used

| Token | Purpose |
|-------|---------|
| `--text` | Value text, page heading |
| `--muted` | Label text, idle copy button |
| `--surface` | Card background |
| `--border` | Card and row separator |
| `--accent` | Focus ring, back button |
| `--success` | "Copied!" button / CheckIcon colour |

No hardcoded hex values — dark and light themes work automatically.

---

## Route and Navigation Integration

- `src/App.tsx`: Added `slaCard: "/marketplace/:apiId/sla"` route mapping to `<SlaCard />`.
- `src/renderRoute.tsx`: The `/sla` exclusion in the custom router permits `/marketplace/:apiId/sla` for any API ID to pass through to `App.tsx` while preserving `/marketplace` standalone rendering.
- `src/pages/ApiDetailPage.tsx`: Added links pointing directly to `/marketplace/:id/sla`.
