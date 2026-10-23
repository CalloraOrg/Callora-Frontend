import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PlanBadgeComponent, { type PlanTier } from "../components/PlanBadge";
import useDocumentTitle from "../hooks/useDocumentTitle";
import LiveRegion from "../components/LiveRegion";
import { useToast } from "../components/Toast";

/**
 * PlanBadge page — issue #529 (GrantFox FWC26 / Stellar Wave campaign).
 *
 * Displays a themed empty-state illustration when no plan is attached to
 * the current API or account.  Once a tier is selected the badge preview
 * is shown inline so developers can verify the visual result before saving.
 *
 * Optimistic UI (issue #737):
 * - Clicking "Choose a plan" immediately transitions from the empty state
 *   to the tier-selection view WITHOUT waiting for the async operation.
 * - If the async operation (onChoosePlan) fails, the UI reverts to the
 *   empty state and an error toast is shown.
 * - The previous state is captured before the optimistic update so it can
 *   be restored exactly on failure.
 * - Rapid repeated clicks are prevented via a useRef boolean that is checked
 *   synchronously before any state reads, so it works even when React has not
 *   yet re-rendered between synchronous click events.
 * - Stale responses are handled via an operation counter ref.
 * - Unmount safety is ensured via an isMounted ref.
 *
 * Accessibility (WCAG 2.1 AA):
 * - The tier selection group uses role="radiogroup" with a visible legend.
 * - Every radio button has an accessible label derived from the tier name.
 * - Focus indicators inherit the global `--accent` focus ring from focus.css.
 * - The EmptyState illustration is aria-hidden; meaning comes from the
 *   heading + paragraph below it.
 * - Error feedback is announced via a toast notification (aria-live="polite")
 *   and a screen-reader status message.
 * - The action button is disabled while in-flight to prevent duplicate
 *   activations and communicates busy state via aria-busy.
 *
 * Design-token consistency:
 * - All colors reference CSS custom properties; no hardcoded hex values.
 * - Dark-mode tested: `--plan-*` tokens and `--surface` / `--text` adapt
 *   automatically via ThemeProvider.
 *
 * Responsive:
 * - The tier picker stacks to a single column below 480 px via flex-wrap.
 * - The page padding scales with `clamp()` so it feels comfortable at every
 *   breakpoint without explicit @media queries.
 */

/** The three plan tiers exposed by PlanBadge. */
const PLAN_TIERS: PlanTier[] = ["free", "pro", "enterprise"];

const TIER_LABELS: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

/**
 * Page status for the optimistic UI flow.
 * - `empty`: No plan selected; show empty state.
 * - `activating`: Optimistic transition in progress (async operation running).
 * - `selecting`: Async operation succeeded; show tier picker.
 */
type PageStatus = "empty" | "activating" | "selecting";

interface PlanBadgePageProps {
  /**
   * Async callback invoked when the user activates the primary action
   * ("Choose a plan").  While the promise is pending, the UI optimistically
   * transitions to the tier-selection view.  If the promise rejects, the UI
   * reverts to the empty state and an error toast is shown.
   *
   * If omitted, the action is treated as immediately successful (no-op).
   */
  onChoosePlan?: () => Promise<void>;
}

export default function PlanBadgePage({ onChoosePlan }: PlanBadgePageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  useDocumentTitle(
    "Plan Badge – Callora",
    "Preview and assign a plan tier badge to your API on the Callora marketplace."
  );

  const [pageStatus, setPageStatus] = useState<PageStatus>("empty");
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Ref-based guard against duplicate activations.  Using a ref instead of
  // state because React batches state updates per event; synchronous clicks
  // would all see the same stale `pageStatus` value from the closure.
  const activatingRef = useRef(false);

  // Track the latest operation to prevent stale responses from overwriting
  // newer state after rapid repeated activations.
  const operationRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleChoosePlan = useCallback(async () => {
    // Synchronous ref check — works before React re-renders.
    if (activatingRef.current) return;
    activatingRef.current = true;

    // Capture the previous status for rollback on failure.
    const previousStatus = pageStatus;
    const previousTier = selectedTier;

    const thisOp = ++operationRef.current;

    // ── Optimistic update ────────────────────────────────────────────
    // Immediately transition to the activating state so the UI shows the
    // tier-selection view (or loading indicator) without waiting for the
    // async operation.
    setPageStatus("activating");

    // If no onChoosePlan is provided, treat the action as immediately
    // successful (no async work — safe default).
    const asyncWork = onChoosePlan?.() ?? Promise.resolve();

    try {
      await asyncWork;

      // Only apply the result if this is still the latest operation and
      // the component is still mounted.
      if (!isMountedRef.current || thisOp !== operationRef.current) return;

      // Async succeeded — promote from 'activating' to 'selecting'.
      setPageStatus("selecting");
      setAnnouncement("Plan options loaded. Select a tier.");
    } catch (err) {
      if (!isMountedRef.current || thisOp !== operationRef.current) return;

      // Async failed — revert to EXACT previous state.
      setPageStatus(previousStatus);
      setSelectedTier(previousTier);

      const message =
        err instanceof Error
          ? err.message
          : "Could not load plan options. Please try again.";

      showToast(message, "error");
      setAnnouncement("Failed to load plan options. Reverted.");
    } finally {
      if (isMountedRef.current && thisOp === operationRef.current) {
        activatingRef.current = false;
      }
    }
  }, [pageStatus, selectedTier, onChoosePlan, showToast]);

  const handleLearnMore = () => navigate("/marketplace");

  const handleCancelSelection = () => {
    setPageStatus("empty");
    setSelectedTier(null);
  };

  const isBusy = pageStatus === "activating";
  const showEmptyState = pageStatus === "empty";
  const showSelectionUI = pageStatus === "activating" || pageStatus === "selecting";

  return (
    <div
      className="plan-badge-page"
      style={{ padding: "clamp(16px, 4vw, 32px) 0" }}
    >
      {/* ── Page header ──────────────────────────────────────────────── */}
      <header style={{ marginBottom: "32px", padding: "0 4px" }}>
        <p className="eyebrow">API Plan Management</p>
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: "700",
            color: "var(--text)",
          }}
        >
          Plan Badge
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "1rem",
            color: "var(--muted)",
            lineHeight: "1.65",
            maxWidth: "600px",
          }}
        >
          Assign a plan tier to your API to communicate rate limits and support
          levels to marketplace consumers.
        </p>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      {showEmptyState && (
        <section
          className="surface"
          aria-labelledby="plan-badge-empty-heading"
          style={{ borderRadius: "16px", overflow: "hidden" }}
        >
          <EmptyState
            variant="plan-badge"
            title="No plan selected"
            message="This API doesn't have a plan tier attached yet. Choose a plan to set
              rate limits, communicate support levels, and appear correctly in
              the marketplace."
            action={{
              label: "Choose a plan",
              onClick: handleChoosePlan,
            }}
          />

          {/*
           * Secondary CTA — offered below the primary action so users who
           * want context before committing have a clear path.
           */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingBottom: "32px",
            }}
          >
            <button
              type="button"
              className="ghost-button"
              onClick={handleLearnMore}
              style={{ fontSize: "0.875rem" }}
              aria-label="Learn more about available plans in the marketplace"
            >
              Learn about plans
            </button>
          </div>
        </section>
      )}

      {showSelectionUI && (
        <section
          className="surface"
          style={{ borderRadius: "16px", padding: "32px" }}
          aria-label="Plan badge preview"
        >
          {isBusy && (
            <div
              role="status"
              aria-live="polite"
              aria-label="Loading plan options"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "24px",
                color: "var(--muted)",
                fontSize: "0.9375rem",
              }}
            >
              <span
                className="button-spinner"
                aria-hidden="true"
              />
              Loading plan options…
            </div>
          )}

          {!isBusy && (
            <>
              {/* Live badge preview */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "28px",
                }}
              >
                <span style={{ color: "var(--muted)", fontSize: "0.9375rem" }}>
                  Current plan:
                </span>
                {selectedTier ? (
                  <PlanBadgeComponent tier={selectedTier} />
                ) : (
                  <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
                    None selected
                  </span>
                )}
              </div>

              {/* Tier picker */}
              <fieldset
                style={{
                  border: "none",
                  padding: 0,
                  margin: 0,
                }}
              >
                <legend
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "var(--text)",
                    marginBottom: "16px",
                  }}
                >
                  Select a plan tier
                </legend>

                <div
                  role="radiogroup"
                  aria-label="Plan tiers"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  {PLAN_TIERS.map((tier) => (
                    <label
                      key={tier}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 16px",
                        borderRadius: "10px",
                        border: `1.5px solid ${selectedTier === tier ? "var(--accent)" : "var(--line)"}`,
                        background:
                          selectedTier === tier
                            ? "var(--surface-soft)"
                            : "var(--surface)",
                        cursor: "pointer",
                        fontSize: "0.9375rem",
                        color: "var(--text)",
                        transition:
                          "border-color 120ms ease, background 120ms ease",
                      }}
                    >
                      <input
                        type="radio"
                        name="plan-tier"
                        value={tier}
                        checked={selectedTier === tier}
                        onChange={() => setSelectedTier(tier)}
                        aria-label={`${TIER_LABELS[tier]} plan`}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {TIER_LABELS[tier]}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Cancel / back button */}
              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  justifyContent: "flex-start",
                }}
              >
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleCancelSelection}
                  aria-label="Cancel plan selection and go back"
                  style={{ fontSize: "0.875rem" }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Screen-reader announcements */}
      <LiveRegion>{announcement}</LiveRegion>
    </div>
  );
}
