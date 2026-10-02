# Analytics Consent & Event Tracking

How Callora collects (or refuses to collect) product analytics, where the
consent preference lives, what redaction applies, and what the current
implementation actually does.

**Status: consent-gated, console-only, no network egress.** Nothing is sent
to an external analytics provider today.

---

## 1. Consent storage and default

Consent is stored as the `analyticsConsent` field on the shared user-preferences
object.

| Property | Value |
| --- | --- |
| Storage key | `callora.prefs` (via `PREFS_STORAGE_KEY` in `src/utils/userPrefs.ts`) |
| Storage mechanism | `window.localStorage`, JSON-encoded |
| Field name | `analyticsConsent` |
| Type | `boolean` |
| **Default** | **`false`** (`DEFAULT_PREFS.analyticsConsent` in `src/utils/userPrefs.ts`) |
| Source of truth | Local browser storage only - never synced to the server |

Because the default is `false` and prefs are merged as
`{ ...DEFAULT_PREFS, ...stored }`, a user who has never touched the preference
is treated as **not consenting**, even if a legacy prefs blob predates this field.

Reads and writes go through the typed accessors:

    import { getPref, setPref } from "../utils/userPrefs";
    getPref("analyticsConsent");        // boolean
    setPref("analyticsConsent", true);  // opt in
    setPref("analyticsConsent", false); // opt out

### Where consent is set today

**Nowhere in the application UI yet.** No settings page, onboarding step, or
consent banner calls `setPref("analyticsConsent", true)`. The only consumers
of the field are:

- `src/services/AnalyticsService.ts` - reads it and gates on it.
- `src/utils/userPrefs.ts` - declares it and defaults it to `false`.
- `src/utils/userPrefs.test.ts` and `src/services/AnalyticsService.test.ts`.

Net effect: **analytics is effectively disabled for every user** until a UI is
added to opt in. Any future integration must ship that UI in the same change;
silently flipping the default to `true` would be a privacy regression.

---

## 2. Gating behaviour

`src/services/AnalyticsService.ts` exposes a single instance:

    import { analytics } from "../services/AnalyticsService";
    analytics.trackEvent({
      eventName: "marketplace_filter_applied",
      payload: { category: "ai", tag: "fwc26" },
    });

`trackEvent` runs three steps in order:

1. **Consent check (fail-closed).** If `getPref("analyticsConsent")` is not
   truthy, the function returns immediately. It does not log, does not call
   the redactor, and does not touch the payload. Callers cannot distinguish
   "dropped due to no consent" from "succeeded with no observable output".
2. **Shape validation.** If `event` is missing, or `eventName` is not a
   non-empty string, the event is dropped and a single
   `console.warn("[Analytics] Invalid or malformed input. Event dropped.")`
   is emitted. No part of the payload is echoed.
3. **Redaction.** If consent is present and the shape is valid, the payload
   is passed through `redactDeeply` from `SecureErrorHandler` before the
   event is logged.

---

## 3. Redaction limits

Redaction is delegated entirely to `SecureErrorHandler`. The guarantees below
are inherited - see [Secure Error Handling](./Secure-Error-Handling.md) for the
full helper reference.

### Key-name based redaction

Any object **key** whose name contains one of these substrings (case-insensitive)
has its value replaced with `[REDACTED]`, regardless of the value's type:

    key · token · secret · password · credential · auth · apikey · api_key

Examples: `apiKey`, `Authorization`, `refresh_token`, `userPassword`, `credentials`.

### Value-pattern based redaction

String values pass through `redactSensitiveData`, which applies these regexes:

| Category | Replacement |
| --- | --- |
| JSON-shaped credentials (`"password": "..."`) | `"[REDACTED]"` |
| API key prefixes `ck_live_`, `sk_`, `pk_` | `[REDACTED_KEY]` |
| `Bearer <token>` | `Bearer [REDACTED_TOKEN]` |
| JWT (`eyJ...eyJ....`) | `[REDACTED_TOKEN]` |
| Email addresses | `[REDACTED_EMAIL]` |
| `https://user:pass@host` | `https://[REDACTED_CREDENTIALS]` |
| `password: ...` / `pwd=...` | `[REDACTED_PASSWORD]` |
| `username=...` / `user: ...` | `[REDACTED_USERNAME]` |
| URL params `?api_key=...` / `?token=...` | `[REDACTED_PARAM]` |
| 16-digit card sequences | `[REDACTED_CARD]` |
| 10-digit phone sequences | `[REDACTED_PHONE]` |

### Depth cap

`redactDeeply` walks the payload recursively. Once it reaches **depth 5**
(`MAX_REDACTION_DEPTH`), the subtree is replaced with `[TRUNCATED]`. Arrays
are traversed element-wise at the same depth budget; a value that exceeds the
cap is replaced, not dropped, so the surrounding shape stays stable.

### What redaction does NOT cover

- **Shape / cardinality.** A payload of 10,000 entries is still 10,000 entries.
  Redaction is not a size limiter. Contributors should keep payloads small.
- **Timing and identifiers.** Event timing, request counts, route names,
  feature flags, and non-sensitive opaque IDs (e.g. a numeric `user_id`) are
  not redacted and would be sent to a provider verbatim.
- **Future PII you have not named yet.** The regex list is a denylist. A new
  field that carries PII but is not named after a sensitive key and does not
  match a value pattern will pass through. **Treat any payload you have not
  reviewed against this table as unsafe.**

### False positives

The value patterns occasionally redact safe data: long numeric IDs may be
caught by the card/phone regexes, and any string containing the substring
`auth` or `key` in a **key name** (not value) is dropped entirely. This is
the intended trade-off - prefer over-redaction to leakage.

---

## 4. Event naming conventions

`trackEvent` does not enforce a naming scheme. The following convention is
expected of contributors and will be enforced when a real provider is added.

- **Format**: `snake_case`, `noun_past_tense_verb`.
  - Good: `marketplace_filter_applied`, `api_published`, `subscribe_clicked`.
  - Bad: `filterApplied`, `PUBLISH`, `click`.
- **Scope**: `<surface>_<action>` where `<surface>` is a stable product noun
  (`marketplace`, `api_detail`, `billing`, `onboarding`).
- **Do not** embed user identifiers, raw query strings, or payload values in
  the event name - the name is not passed through redaction.
- **Payload keys** should be `snake_case`, short, and drawn from a known set.
  Do not pass arbitrary user input as a payload key.

`AnalyticsEvent` is the only accepted shape:

    interface AnalyticsEvent {
      eventName: string;
      payload?: Record<string, unknown>;
    }

---

## 5. Current behaviour: console-only

`trackEvent` does not make any network request. When consent is present and
the event is valid and redacted, the service calls:

    console.info("[Analytics Event Tracked]", eventName, safePayload);

That is the entire sink. Consequences:

- **No data leaves the browser.** DevTools console is the only destination.
- **No persistence.** Reloading discards every "tracked" event.
- **No batching, retries, or offline queue.** None of that exists.
- **No provider SDK is imported.** No Mixpanel, PostHog, Segment, Sentry, or
  similar package is a dependency of this repository for the purpose of
  product analytics.

If you are looking for an analytics dashboard or a "why is this event missing
on the backend" answer: **there is no backend.** Any contributor who assumes
otherwise is the exact case this document exists to prevent.

---

## 6. Plan for a real provider

Adding a provider is out of scope for the current consent work. When it is
undertaken, the following are the preconditions, in order:

1. **Consent UI first.** Ship a settings control (and, if desired, an initial
   opt-in prompt) that calls `setPref("analyticsConsent", true)`. Nothing
   else ships before this.
2. **Server-side consent enforcement.** `localStorage` is trivially editable
   by the user. A real provider call should also be gated by a server-issued
   consent state, or at minimum by a signed token, so a user who clears the
   pref locally is not silently re-enabled.
3. **DPA / privacy notice.** Publish a notice that names the provider, the
   event categories sent, retention, and the deletion process. Update this
   doc to link to it.
4. **Sampling and quotas.** Add per-session and per-event caps so a runaway
   loop in a caller cannot flood the provider. `AnalyticsService` currently
   has no rate limit.
5. **Typed event catalogue.** Replace the free-form `eventName: string` with
   a union or a generated map so new events go through review.
6. **Observability for drops.** Emit a counter for "dropped due to no consent"
   vs. "dropped due to invalid shape" so the maintainers can measure adoption
   without logging the payloads.
7. **Fail-open vs fail-closed policy.** Today the service fails closed on any
   unexpected condition. A provider integration should keep that default and
   only fail-open (drop silently) on transport errors, never on consent.

Until all seven are satisfied, `AnalyticsService` should stay console-only.

---

## 7. Testing

`src/services/AnalyticsService.test.ts` covers:

- Consent `false` -> event dropped, no redaction, no console output.
- Consent `true` -> event logged.
- Malformed input -> dropped with a warning.
- Redaction of values by pattern (email) and by key (`apiKey`, `Authorization`).
- Element-wise array redaction.
- Depth-cap truncation.

`src/utils/userPrefs.test.ts` covers the storage layer, including default
fallback when the stored blob omits `analyticsConsent` or is corrupted.

Run:

    npx vitest run src/services/AnalyticsService.test.ts

---

## See also

- [Secure Error Handling](./Secure-Error-Handling.md) - canonical reference
  for `redactSensitiveData`, `redactDeeply`, and friends.
- [Local Storage Inventory](./localstorage-inventory.md) - the `callora.prefs`
  entry is registered there.
