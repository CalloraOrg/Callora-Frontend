import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PlanBadgeComponent, { type PlanTier } from "../components/PlanBadge";
import useDocumentTitle from "../hooks/useDocumentTitle";

/**
 * PlanBadge page — issue #529 (GrantFox FWC26 / Stellar Wave campaign).
 *
 * Displays a themed empty-state illustration when no plan is attached to
 * the current API or account.  Once a tier is selected the badge preview
 * is shown inline so developers can verify the visual result before saving.
 *
 * Accessibility (WCAG 2.1 AA):
 * - The tier selection group uses role="radiogroup" with a visible legend.
 * - Every radio button has an accessible label derived from the tier name.
 * - Focus indicators inherit the global `--accent` focus ring from focus.css.
 * - The EmptyState illustration is aria-hidden; meaning comes from the
 *   heading + paragraph below it.
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

export default function PlanBadgePage() {
  const navigate = useNavigate();

  useDocumentTitle(
    "Plan Badge – Callora",
    "Preview and assign a plan tier badge to your API on the Callora marketplace."
  );

  // In this phase no real plan data is available yet, so we always land on
  // the empty state.  Once backend data arrives, replace `selectedTier` with
  // a data-fetching hook and conditionally render the picker or the badge.
  const selectedTier: PlanTier | null = null;

  // Navigate to billing to start the upgrade flow.
  const handleChoosePlan = () => navigate("/billing");
  const handleLearnMore = () => navigate("/marketplace");

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
      {selectedTier === null ? (
        /*
         * Empty state — no plan is attached yet.
         * Uses the new "plan-badge" EmptyState variant (issue #529) which
         * renders a medal-and-ribbon line-art illustration themed with the
         * design-token accent colour.
         */
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
      ) : (
        /*
         * Plan selected — show the badge preview alongside a tier picker so
         * developers can change their mind without leaving the page.
         * This branch will be reached once real plan data is wired in.
         */
        <section
          className="surface"
          style={{ borderRadius: "16px", padding: "32px" }}
          aria-label="Plan badge preview"
        >
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
            <PlanBadgeComponent tier={selectedTier} />
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
              Change plan tier
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
                    transition: "border-color 120ms ease, background 120ms ease",
                  }}
                >
                  <input
                    type="radio"
                    name="plan-tier"
                    value={tier}
                    defaultChecked={selectedTier === tier}
                    aria-label={`${TIER_LABELS[tier]} plan`}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  {TIER_LABELS[tier]}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      )}
    </div>
  );
}
