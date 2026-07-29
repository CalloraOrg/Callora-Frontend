/**
 * OnboardingTour — GrantFox FWC26 campaign (WCAG 2.1 AA)
 *
 * A multi-step guided tour that introduces new users to Callora.
 *
 * Accessibility guarantees (WCAG 2.1 AA):
 *   2.1.1 Keyboard        — every interactive element is reachable and
 *                           operable via keyboard alone.
 *   2.4.7 Focus Visible   — all buttons, links, and the skip link display
 *                           the 2px solid var(--accent) focus ring via
 *                           :focus-visible (suppressed for mouse users).
 *   1.3.1 Info & Relation — step counter communicated via aria-label on
 *                           the tablist and each tab.
 *   4.1.2 Name, Role, Val — stepper tabs carry role="tab", aria-selected,
 *                           aria-controls; panels carry role="tabpanel".
 *
 * Focus management:
 *   - "Skip tour" link is the first focusable element so keyboard-only users
 *     can bypass the tour immediately.
 *   - Advancing / going back via keyboard moves focus to the step panel so
 *     the updated content is announced to screen readers.
 *   - Completing the tour moves focus to the "Done" / exit link.
 *
 * Design tokens:
 *   All colours reference var(--*) tokens so the component works in both
 *   light and dark themes without modification.
 *
 * Part of GrantFox FWC26 campaign UI/UX requirements.
 */

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";

/* ─── Tour step data ───────────────────────────────────────────────────── */

interface TourStep {
  /** Short heading shown inside the step panel. */
  title: string;
  /** Body copy for the step. */
  description: string;
  /** Decorative emoji illustration (aria-hidden). */
  icon: string;
  /** Hint displayed below the step body (optional). */
  hint?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: "👋",
    title: "Welcome to Callora",
    description:
      "Callora is a pay-per-call API marketplace. You only pay for the requests your app makes — no subscriptions, no waste.",
    hint: 'Press the right arrow key or click \u201cNext\u201d to continue.',
  },
  {
    icon: "🔑",
    title: "Get your API key",
    description:
      "Generate a live API key from the dashboard in seconds. Your key is scoped to your vault balance so billing stays transparent.",
  },
  {
    icon: "🛒",
    title: "Browse the Marketplace",
    description:
      "Search hundreds of programmable APIs by category, price, and availability. Pin your favourites to the dashboard for quick access.",
  },
  {
    icon: "💸",
    title: "Fund your vault",
    description:
      "Deposit USDC once and let Callora handle the rest. Every API call is settled on-chain with a verifiable record.",
  },
  {
    icon: "📊",
    title: "Track your usage",
    description:
      "The API Usage page shows request history, error rates, and spend so you always know what your app is doing.",
  },
];

const TOTAL_STEPS = TOUR_STEPS.length;

/* ─── Component ────────────────────────────────────────────────────────── */

interface OnboardingTourProps {
  /**
   * Called when the user finishes the tour ("Done" button or "Skip tour"
   * link). Callers typically navigate to the dashboard or close the overlay.
   */
  onComplete?: () => void;
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
  useDocumentTitle(
    "Getting Started – Callora",
    "A short guided tour that introduces the Callora API marketplace to new users.",
  );

  /** Zero-indexed current step. */
  const [activeStep, setActiveStep] = useState(0);

  /** Whether the tour has been finished. */
  const [isComplete, setIsComplete] = useState(false);

  // Refs for programmatic focus management
  const stepPanelRef = useRef<HTMLDivElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);

  /** Move to the next step, or complete the tour on the last step. */
  const handleNext = useCallback(() => {
    if (activeStep < TOTAL_STEPS - 1) {
      setActiveStep((s) => s + 1);
    } else {
      setIsComplete(true);
    }
  }, [activeStep]);

  /** Move to the previous step. */
  const handleBack = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep((s) => s - 1);
    }
  }, [activeStep]);

  /** Jump directly to a specific step via the stepper tabs. */
  const handleStepSelect = useCallback((index: number) => {
    setActiveStep(index);
  }, []);

  /** Skip the tour entirely. */
  const handleSkip = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  /** Complete the tour from the final screen. */
  const handleDone = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  /**
   * Keyboard arrow navigation for the stepper tab list (WAI-ARIA tabs pattern):
   *   Left/Up  → previous tab
   *   Right/Down → next tab
   *   Home     → first tab
   *   End      → last tab
   */
  const handleTabListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveStep((s) => Math.max(s - 1, 0));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveStep(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveStep(TOTAL_STEPS - 1);
      }
    },
    [],
  );

  // Move focus to the step panel whenever the active step changes so that
  // screen readers announce the new content.
  useEffect(() => {
    if (!isComplete) {
      stepPanelRef.current?.focus();
    }
  }, [activeStep, isComplete]);

  // Once the tour is marked complete, move focus to the "Done" button so the
  // congratulations screen is announced immediately.
  useEffect(() => {
    if (isComplete) {
      // Cast to HTMLElement so .focus() is always available
      (doneButtonRef.current as HTMLElement | null)?.focus();
    }
  }, [isComplete]);

  const step = TOUR_STEPS[activeStep];
  const isFirst = activeStep === 0;
  const isLast = activeStep === TOTAL_STEPS - 1;

  /* ── Shared style blocks ─────────────────────────────────────────── */

  const pageStyles = `
    /* ── OnboardingTour page layout ───────────────────────────────── */
    .onboarding-tour {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px 16px 48px;
      background: var(--page-bg);
    }

    .onboarding-tour__card {
      width: min(640px, 100%);
      background: var(--surface);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-xl, 28px);
      padding: 40px 36px 32px;
      box-shadow: var(--shadow);
      position: relative;
    }

    /* ── Skip link ────────────────────────────────────────────────── */
    .onboarding-tour__skip {
      display: block;
      margin-bottom: 24px;
      font-size: 0.8125rem;
      color: var(--muted);
      text-decoration: underline;
      text-underline-offset: 3px;
      /* outline is handled by focus.css @layer */
    }

    .onboarding-tour__skip:hover {
      color: var(--accent);
    }

    /* ── Stepper / tab list ──────────────────────────────────────── */
    .onboarding-tour__stepper {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 36px;
    }

    .tour-step-tab {
      /*
       * Each dot acts as a WAI-ARIA tab.
       * Sizing meets the 24×24 px minimum touch target.
       */
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid var(--line);
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6875rem;
      font-weight: 700;
      color: var(--muted);
      transition: background 180ms ease, border-color 180ms ease, color 180ms ease;
      /* outline suppressed for mouse (handled by focus.css) */
    }

    .tour-step-tab[aria-selected="true"] {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .tour-step-tab:hover:not([aria-selected="true"]) {
      border-color: var(--accent);
      color: var(--accent);
    }

    .onboarding-tour__step-counter {
      margin-left: auto;
      font-size: 0.8125rem;
      color: var(--muted);
    }

    /* ── Step panel ──────────────────────────────────────────────── */
    .onboarding-tour__panel {
      outline: none; /* visible ring applied in focus.css for :focus-visible */
      min-height: 220px;
    }

    .onboarding-tour__icon {
      font-size: 3rem;
      margin-bottom: 16px;
      line-height: 1;
    }

    .onboarding-tour__step-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 12px;
      line-height: 1.2;
    }

    .onboarding-tour__step-body {
      font-size: 0.9375rem;
      color: var(--muted);
      margin: 0 0 16px;
      line-height: 1.6;
    }

    .onboarding-tour__hint {
      font-size: 0.8125rem;
      color: var(--muted);
      opacity: 0.7;
      margin: 0;
    }

    /* ── Navigation buttons ──────────────────────────────────────── */
    .onboarding-tour__nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--line);
    }

    .tour-nav-button {
      padding: 10px 24px;
      border-radius: 10px;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px; /* touch target */
      transition: background 180ms ease, color 180ms ease, border-color 180ms ease;
    }

    .tour-nav-button--secondary {
      background: transparent;
      border: 1px solid var(--line-strong);
      color: var(--text);
    }

    .tour-nav-button--secondary:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .tour-nav-button--primary {
      background: var(--accent);
      border: 1px solid var(--accent);
      color: #fff;
    }

    .tour-nav-button--primary:hover {
      background: var(--accent-strong, #1ed6a4);
      border-color: var(--accent-strong, #1ed6a4);
    }

    .tour-nav-button--ghost {
      background: transparent;
      border: 1px solid transparent;
      color: var(--muted);
      padding: 10px 12px;
    }

    .tour-nav-button--ghost:hover {
      color: var(--text);
    }

    /* ── Progress bar ────────────────────────────────────────────── */
    .onboarding-tour__progress {
      height: 4px;
      background: var(--line);
      border-radius: 99px;
      margin-bottom: 28px;
      overflow: hidden;
    }

    .onboarding-tour__progress-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 99px;
      transition: width 300ms ease;
    }

    /* ── Completion screen ───────────────────────────────────────── */
    .onboarding-tour__complete {
      text-align: center;
      padding: 16px 0 8px;
    }

    .onboarding-tour__complete-icon {
      font-size: 4rem;
      margin-bottom: 20px;
      line-height: 1;
    }

    .onboarding-tour__complete-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 12px;
    }

    .onboarding-tour__complete-body {
      font-size: 0.9375rem;
      color: var(--muted);
      margin: 0 0 32px;
      line-height: 1.6;
    }

    .onboarding-tour__complete-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .tour-done-button {
      padding: 12px 32px;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      min-height: 48px;
      background: var(--accent);
      border: 1px solid var(--accent);
      color: #fff;
      transition: background 180ms ease, border-color 180ms ease;
    }

    .tour-done-button:hover {
      background: var(--accent-strong, #1ed6a4);
      border-color: var(--accent-strong, #1ed6a4);
    }

    .tour-restart-link {
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      min-height: 48px;
      background: transparent;
      border: 1px solid var(--line-strong);
      color: var(--text);
      display: flex;
      align-items: center;
      transition: border-color 180ms ease, color 180ms ease;
      text-decoration: none;
    }

    .tour-restart-link:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    /* ── Responsive ──────────────────────────────────────────────── */
    @media (max-width: 480px) {
      .onboarding-tour__card {
        padding: 28px 20px 24px;
      }

      .onboarding-tour__step-title {
        font-size: 1.25rem;
      }

      .tour-nav-button {
        padding: 10px 16px;
        font-size: 0.875rem;
      }
    }
  `;

  /* ─── Render ────────────────────────────────────────────────────── */

  return (
    <div className="onboarding-tour">
      {/* Scoped styles — same pattern as RateLimitCard / ApiDetailPage */}
      <style>{pageStyles}</style>

      <article className="onboarding-tour__card">
        {/*
         * "Skip tour" is the very first focusable element on the page so
         * keyboard-only users can bypass the tour in one Tab press.
         * WCAG 2.4.1 Bypass Blocks.
         */}
        <a
          ref={skipLinkRef}
          href="#"
          className="onboarding-tour__skip"
          onClick={(e) => {
            e.preventDefault();
            handleSkip();
          }}
          aria-label="Skip onboarding tour and go to dashboard"
        >
          Skip tour
        </a>

        {/* ── Progress bar (decorative, aria-hidden) ─────────────────── */}
        <div
          className="onboarding-tour__progress"
          aria-hidden="true"
          role="presentation"
        >
          <div
            className="onboarding-tour__progress-fill"
            style={{
              width: isComplete
                ? "100%"
                : `${((activeStep + 1) / TOTAL_STEPS) * 100}%`,
            }}
          />
        </div>

        {isComplete ? (
          /* ── Completion screen ─────────────────────────────────────── */
          <div className="onboarding-tour__complete" data-testid="tour-complete">
            <p className="onboarding-tour__complete-icon" aria-hidden="true">
              🎉
            </p>
            <h1 className="onboarding-tour__complete-title">
              You're all set!
            </h1>
            <p className="onboarding-tour__complete-body">
              You now know the core Callora workflow. Head to the dashboard to
              start using APIs or explore the marketplace.
            </p>
            <div className="onboarding-tour__complete-actions">
              {/*
               * Primary action — programmatic focus targets this button
               * when the tour completes.
               */}
              <button
                ref={doneButtonRef as React.RefObject<HTMLButtonElement>}
                type="button"
                className="tour-done-button"
                onClick={handleDone}
                aria-label="Finish onboarding tour and go to dashboard"
              >
                Go to Dashboard
              </button>

              {/*
               * Secondary action — restart the tour without navigation.
               * Rendered as a <button> (not a link) because it modifies
               * page state rather than navigating.
               */}
              <button
                type="button"
                className="tour-restart-link"
                onClick={() => {
                  setIsComplete(false);
                  setActiveStep(0);
                }}
                aria-label="Restart the onboarding tour from the beginning"
              >
                Restart tour
              </button>
            </div>
          </div>
        ) : (
          /* ── Stepper + step panel ──────────────────────────────────── */
          <>
            {/*
             * WAI-ARIA tabs pattern:
             *   role="tablist" on the container
             *   role="tab" + aria-selected + aria-controls on each dot
             *   role="tabpanel" on the content panel
             *
             * Arrow-key navigation is handled by handleTabListKeyDown so
             * keyboard users can jump to any step using arrow keys.
             */}
            <div
              role="tablist"
              aria-label={`Onboarding tour — step ${activeStep + 1} of ${TOTAL_STEPS}`}
              className="onboarding-tour__stepper"
              onKeyDown={handleTabListKeyDown}
            >
              {TOUR_STEPS.map((s, i) => (
                <button
                  key={s.title}
                  role="tab"
                  type="button"
                  id={`tour-tab-${i}`}
                  aria-selected={i === activeStep}
                  aria-controls="tour-panel"
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  className="tour-step-tab"
                  tabIndex={i === activeStep ? 0 : -1}
                  onClick={() => handleStepSelect(i)}
                >
                  {i + 1}
                </button>
              ))}

              <span
                className="onboarding-tour__step-counter"
                aria-hidden="true"
              >
                {activeStep + 1} / {TOTAL_STEPS}
              </span>
            </div>

            {/*
             * tabIndex={0} — the panel receives programmatic focus when the
             * step changes, ensuring screen readers announce the new content
             * without the user needing to navigate there manually.
             *
             * role="tabpanel" matches the WAI-ARIA tabs pattern above.
             * aria-labelledby points to the active tab id.
             */}
            <div
              id="tour-panel"
              ref={stepPanelRef}
              role="tabpanel"
              aria-labelledby={`tour-tab-${activeStep}`}
              aria-live="polite"
              tabIndex={0}
              className="onboarding-tour__panel"
              data-testid="tour-panel"
            >
              <p
                className="onboarding-tour__icon"
                aria-hidden="true"
              >
                {step.icon}
              </p>
              <h2 className="onboarding-tour__step-title">{step.title}</h2>
              <p className="onboarding-tour__step-body">{step.description}</p>
              {step.hint && (
                <p className="onboarding-tour__hint">{step.hint}</p>
              )}
            </div>

            {/* ── Navigation ─────────────────────────────────────────── */}
            <nav
              className="onboarding-tour__nav"
              aria-label="Tour navigation"
            >
              {/*
               * "Back" is hidden on the first step so there is nothing to
               * go back to.  We render it as a ghost button with reduced
               * visibility rather than removing it to maintain layout
               * stability (avoids jump when it disappears).
               */}
              <button
                type="button"
                className="tour-nav-button tour-nav-button--ghost"
                onClick={handleBack}
                disabled={isFirst}
                aria-disabled={isFirst}
                aria-label="Go to previous onboarding step"
                style={{ visibility: isFirst ? "hidden" : "visible" }}
              >
                ← Back
              </button>

              <button
                type="button"
                className="tour-nav-button tour-nav-button--primary"
                onClick={handleNext}
                aria-label={
                  isLast
                    ? "Finish onboarding tour"
                    : `Go to step ${activeStep + 2} of ${TOTAL_STEPS}`
                }
              >
                {isLast ? "Finish" : "Next →"}
              </button>
            </nav>
          </>
        )}
      </article>
    </div>
  );
}
