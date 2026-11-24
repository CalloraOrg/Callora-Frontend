// @vitest-environment jsdom
/**
 * Accessibility regression suite for every route in `ROUTE_CATALOGUE`.
 *
 * Each catalogue entry renders the real `App` (with the same providers as
 * `renderRoute.tsx`) inside a `MemoryRouter`, waits for the lazy page chunk to
 * replace the `Suspense` fallback, then runs axe-core against the rendered
 * tree. `serious` and `critical` violations fail the suite; `moderate` and
 * `minor` ones are logged as warnings so they stay visible without blocking.
 *
 * jsdom cannot compute colour contrast or layout, so the `color-contrast` rule
 * is disabled here. Contrast stays covered by the dedicated contrast tests.
 *
 * Network access (`fetch`) and the Freighter wallet are stubbed so a render is
 * deterministic and never depends on a backend being reachable.
 */

import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { AxeResults, Result } from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { configureAxe } from "vitest-axe";

import App from "../App";
import { AccountProvider } from "../hooks/useAccountContext";
import { ThemeProvider } from "../ThemeContext";
import { CollectionsProvider } from "../state/collectionsStore";
import { ToastProvider } from "../components/Toast";
import { APP_ROUTES } from "../app/routes";
import { ROUTE_CATALOGUE } from "../config/routeCatalogue";
import manifest from "../data/a11y-manifest.json";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn().mockResolvedValue({ isConnected: false }),
  isAllowed: vi.fn().mockResolvedValue({ isAllowed: false }),
  getAddress: vi.fn().mockResolvedValue({ address: "" }),
  getNetwork: vi.fn().mockResolvedValue({ network: "TESTNET", networkPassphrase: "" }),
  requestAccess: vi.fn().mockResolvedValue({ address: "" }),
  signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "" }),
  WatchWalletChanges: class {
    watch() {
      return { stop: () => {} };
    }
    stop() {}
  },
}));

/**
 * Documented axe violations the suite accepts, keyed by route path.
 *
 * Every entry needs a rule id, the route it occurs on, the components it comes
 * from, and a reason. Fixing the underlying issue means deleting the entry: the
 * per-route assertion compares the observed serious/critical violations against
 * this list exactly, so a new violation fails and a stale entry fails too.
 */
const KNOWN_VIOLATIONS: ReadonlyArray<{
  path: string;
  rule: string;
  components: readonly string[];
  reason: string;
}> = [
  {
    path: "/dashboard",
    rule: "nested-interactive",
    components: ["PreviewCard", "BalanceReadout"],
    reason:
      "PreviewCard's trigger is role=button but wraps dashboard cards that contain their own buttons " +
      "(for example Unpin and balance retry). Refactor the trigger into a non-interactive wrapper with a " +
      "dedicated preview control. Reported by the route suite added for issue #1379.",
  },
  {
    path: "/marketplace",
    rule: "nested-interactive",
    components: ["ApiCard"],
    reason:
      "ApiCard puts role=button on the whole card while it contains its own action buttons (bookmark, pin, " +
      "favorite, compare). Move the view-details affordance to a dedicated control. Reported by the route " +
      "suite added for issue #1379.",
  },
];

/**
 * Where each `audited` component from `a11y-manifest.json` is rendered.
 * `null` means no catalogue route renders it (modal, loading skeleton, or a
 * page outside the catalogue), so it cannot be covered by this suite.
 */
const AUDITED_COMPONENT_ROUTES: Readonly<Record<string, string | null>> = {
  BillingSortSelect: "/billing/history",
  CodeExample: null,
  EmptyState: "/marketplace",
  MethodChip: null,
  RouteProgressBar: null,
  SearchBar: "/marketplace",
  Skeleton: null,
  TransactionCard: "/billing/history",
  TransactionDetails: "/billing/history",
};

const axe = configureAxe({
  rules: {
    // jsdom has no layout or paint, so contrast cannot be evaluated here.
    "color-contrast": { enabled: false },
  },
});

function blockingViolations(results: AxeResults): Result[] {
  return results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
}

function nonBlockingViolations(results: AxeResults): Result[] {
  return results.violations.filter(
    (violation) => violation.impact === "moderate" || violation.impact === "minor",
  );
}

function describeNodes(violation: Result): string {
  return violation.nodes.map((node) => node.target.join(" ")).join(", ");
}

function expectedRulesFor(path: string): string[] {
  return KNOWN_VIOLATIONS.filter((entry) => entry.path === path)
    .map((entry) => entry.rule)
    .sort();
}

function installFetchStub() {
  const jsonResponse = (body: unknown) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this;
    },
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/api/apis")) return jsonResponse({ apis: [], total: 0, page: 1, pageSize: 20 });
      if (url.includes("/api/invoices")) return jsonResponse({ invoices: [] });
      if (url.includes("/api/subscriptions")) return jsonResponse({ subscriptions: [] });
      if (url.includes("/api/quota")) return jsonResponse({ quota: null });
      if (url.includes("/api/notifications")) return jsonResponse({ notifications: [] });
      if (url.includes("/api/usage")) return jsonResponse({ usage: [], total: 0 });

      return jsonResponse({});
    }),
  );
}

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <CollectionsProvider>
        <AccountProvider>
          <MemoryRouter initialEntries={[path]}>
            <ToastProvider>
              <App />
            </ToastProvider>
          </MemoryRouter>
        </AccountProvider>
      </CollectionsProvider>
    </ThemeProvider>,
  );
}

/**
 * Waits for data-driven renders to finish. The lazy chunk resolves before a
 * page's mount fetch settles, so waiting only for the Suspense fallback can run
 * axe against a half-loaded page. This flushes pending microtasks and timers
 * until two consecutive frames match and nothing is marked `aria-busy`.
 */
async function settle(container: HTMLElement) {
  let previous = "";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const markup = container.innerHTML;
    if (markup === previous && !container.querySelector('[aria-busy="true"]')) return;
    previous = markup;
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("route catalogue accessibility", () => {
  it.each(ROUTE_CATALOGUE.map((entry) => [entry.label, entry.path] as const))(
    "%s (%s) has no serious or critical axe violations",
    async (label, path) => {
      installFetchStub();
      const { container } = renderAt(path);

      await waitFor(
        () => {
          expect(container.querySelector(".route-loading-fallback")).toBeNull();
        },
        { timeout: 15000 },
      );
      await settle(container);

      expect(container.textContent ?? "", `${label} (${path}) fell through to the 404 route`).not.toContain(
        "Page Not Found",
      );

      const results = await axe(container);

      const warnings = nonBlockingViolations(results);
      if (warnings.length > 0) {
        console.warn(
          `[a11y] ${label} (${path}) moderate/minor: ${warnings
            .map((violation) => `${violation.id} -> ${describeNodes(violation)}`)
            .join("; ")}`,
        );
      }

      const blocking = blockingViolations(results);
      const observed = blocking.map((violation) => violation.id).sort();
      const expected = expectedRulesFor(path);

      const unexpected = blocking.filter((violation) => !expected.includes(violation.id));
      expect({ ...results, violations: unexpected }).toHaveNoViolations();

      expect(
        observed,
        `${label} (${path}) serious/critical violations changed. Observed: ${
          blocking
            .map((violation) => `${violation.id} [${violation.impact}] on ${describeNodes(violation)}`)
            .join(" | ") || "none"
        }. Fix them, or add a documented KNOWN_VIOLATIONS entry.`,
      ).toEqual(expected);
    },
    20000,
  );
});

describe("route catalogue and audit manifest guards", () => {
  it("keeps every catalogue path in APP_ROUTES", () => {
    const appRoutePaths = new Set<string>(Object.values(APP_ROUTES));
    const missing = ROUTE_CATALOGUE.filter((entry) => !appRoutePaths.has(entry.path)).map(
      (entry) => `${entry.label} (${entry.path})`,
    );

    expect(missing, `Catalogue paths missing from APP_ROUTES: ${missing.join(", ")}`).toEqual([]);
  });

  it("documents every allowlisted violation with a rule, route, component and reason", () => {
    const cataloguePaths = new Set(ROUTE_CATALOGUE.map((entry) => entry.path));
    const problems: string[] = [];
    const seen = new Set<string>();

    for (const entry of KNOWN_VIOLATIONS) {
      const key = `${entry.path}::${entry.rule}`;
      if (seen.has(key)) problems.push(`duplicate allowlist entry ${key}`);
      seen.add(key);
      if (!cataloguePaths.has(entry.path)) problems.push(`${entry.rule}: unknown route ${entry.path}`);
      if (!entry.reason.trim()) problems.push(`${entry.rule}: missing reason on ${entry.path}`);
      if (entry.components.length === 0) problems.push(`${entry.rule}: no components on ${entry.path}`);
    }

    expect(problems).toEqual([]);
  });

  it("accounts for every audited manifest component", () => {
    const audited = manifest.components
      .filter((component) => component.status === "audited")
      .map((component) => component.id)
      .sort();

    expect(Object.keys(AUDITED_COMPONENT_ROUTES).sort()).toEqual(audited);

    const cataloguePaths = new Set(ROUTE_CATALOGUE.map((entry) => entry.path));
    const problems = Object.entries(AUDITED_COMPONENT_ROUTES)
      .filter(([, route]) => route !== null && !cataloguePaths.has(route))
      .map(([component, route]) => `${component}: ${route} is not a catalogue route`);

    expect(problems).toEqual([]);
  });

  it("does not mark a violating component as audited", () => {
    const audited = new Set(
      manifest.components
        .filter((component) => component.status === "audited")
        .map((component) => component.id),
    );

    const problems = KNOWN_VIOLATIONS.flatMap((entry) =>
      entry.components
        .filter((component) => audited.has(component))
        .map((component) => `${component} is audited but allowlisted for ${entry.rule} on ${entry.path}`),
    );

    expect(problems).toEqual([]);
  });
});
