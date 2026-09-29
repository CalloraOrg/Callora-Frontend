// @vitest-environment jsdom
/**
 * A11yAudit.test.tsx
 *
 * Tests for the Accessibility Audit Board page (src/pages/A11yAudit.tsx).
 *
 * Coverage areas:
 *   - Default render: heading, summary stats, one card per manifest component
 *   - Status filtering ("Needs Work" shows only needs-work components)
 *   - Empty-state message when the selected status has no components
 *   - Result count announced through the aria-live region
 *   - useDocumentTitle is called with "Accessibility Audit"
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import A11yAudit from './A11yAudit';
import useDocumentTitle from '../hooks/useDocumentTitle';

type ManifestComponent = { id: string; name: string; status: string; docs?: string };

// The page reads the manifest from a JSON module. Mock it with a live object so
// individual tests can swap the component list while keeping the module shape.
const mockManifest = vi.hoisted(() => ({
  components: [] as ManifestComponent[],
}));

vi.mock('../data/a11y-manifest.json', () => ({ default: mockManifest }));

vi.mock('../hooks/useDocumentTitle', () => ({ default: vi.fn() }));

const mockedUseDocumentTitle = vi.mocked(useDocumentTitle);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Component names rendered as cards, in document order. */
function cardNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.a11y-card')).map(
    (card) => card.querySelector('h3')?.textContent?.trim() ?? ''
  );
}

/** Status pill labels rendered as cards, in document order. */
function cardPills(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.a11y-card .status-pill')).map(
    (pill) => pill.textContent?.trim() ?? ''
  );
}

/** The status filter <select>. */
function statusFilter(): HTMLElement {
  return screen.getByRole('combobox', { name: /filter by status/i });
}

/** The summary figure printed next to a stat label, e.g. "Audited:" -> "7". */
function statValue(label: string): string {
  const item = screen.getByText(label).closest('.stat-item') as HTMLElement;
  expect(item).toBeTruthy();
  return (item.textContent ?? '').slice((item.textContent ?? '').indexOf(':') + 1).trim();
}

function selectStatus(value: string) {
  fireEvent.change(statusFilter(), { target: { value } });
}

const EMPTY_MESSAGE = 'No components found for this status.';

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('A11yAudit', () => {
  let realComponents: ManifestComponent[] = [];

  beforeAll(async () => {
    const actual = await vi.importActual<{ default: { components: ManifestComponent[] } }>(
      '../data/a11y-manifest.json'
    );
    realComponents = actual.default.components;
  });

  beforeEach(() => {
    mockManifest.components = realComponents;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Default render ─────────────────────────────────────────────────────────

  it('renders the audit board heading and subtitle', () => {
    render(<A11yAudit />);

    expect(screen.getByRole('heading', { name: /accessibility audit board/i, level: 1 })).toBeTruthy();
    expect(screen.getByText(/WCAG 2\.1 AA compliance status/i)).toBeTruthy();
  });

  it('renders a card for every component in the manifest by default', () => {
    const { container } = render(<A11yAudit />);

    expect(cardNames(container)).toEqual(realComponents.map((c) => c.name));
    expect(realComponents.length).toBeGreaterThan(0);
    expect(statusFilter()).toHaveValue('all');
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it('gives each card a heading and a status pill matching the manifest', () => {
    const { container } = render(<A11yAudit />);

    for (const comp of realComponents) {
      expect(screen.getByRole('heading', { name: comp.name, level: 3 })).toBeTruthy();
    }
    expect(cardPills(container)).toEqual(realComponents.map((c) => c.status));
  });

  it('reports summary stats derived from the whole manifest', () => {
    render(<A11yAudit />);

    const count = (status: string) => realComponents.filter((c) => c.status === status).length;
    const percent = Math.round((count('audited') / realComponents.length) * 100);

    expect(statValue('Audited:')).toBe(String(count('audited')));
    expect(statValue('Needs Work:')).toBe(String(count('needs-work')));
    expect(statValue('N/A:')).toBe(String(count('n/a')));
    expect(statValue('Audited (%):')).toBe(`${percent}%`);
  });

  // ── Filtering ──────────────────────────────────────────────────────────────

  it('shows only needs-work components when "Needs Work" is selected', () => {
    const { container } = render(<A11yAudit />);
    const needsWork = realComponents.filter((c) => c.status === 'needs-work');
    expect(needsWork.length).toBeGreaterThan(0);

    selectStatus('needs-work');

    expect(cardNames(container)).toEqual(needsWork.map((c) => c.name));
    expect(cardPills(container)).toEqual(needsWork.map(() => 'needs-work'));
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();

    // Components with another status must be hidden.
    const hidden = realComponents.filter((c) => c.status !== 'needs-work');
    hidden.forEach((c) => {
      expect(screen.queryByRole('heading', { name: c.name, level: 3 })).toBeNull();
    });
  });

  it('announces the number of shown components in the live region', () => {
    render(<A11yAudit />);
    const liveRegion = screen.getByText(`${realComponents.length} components shown`);

    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion.id).toBe('filter-count');

    const needsWorkCount = realComponents.filter((c) => c.status === 'needs-work').length;
    selectStatus('needs-work');
    expect(screen.getByText(`${needsWorkCount} components shown`)).toBeTruthy();
  });

  it('restores every component when the filter returns to "All"', () => {
    const { container } = render(<A11yAudit />);

    selectStatus('needs-work');
    expect(cardNames(container).length).toBeLessThan(realComponents.length);

    selectStatus('all');
    expect(cardNames(container)).toEqual(realComponents.map((c) => c.name));
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows the empty-state message for a status with no components', () => {
    // A manifest with audited and needs-work entries only — nothing is n/a.
    mockManifest.components = [
      { id: 'ApiCard', name: 'ApiCard', status: 'audited' },
      { id: 'Breadcrumb', name: 'Breadcrumb', status: 'needs-work' },
    ];

    const { container } = render(<A11yAudit />);
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();

    selectStatus('n/a');

    expect(cardNames(container)).toEqual([]);
    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
  });

  // ── Document title ─────────────────────────────────────────────────────────

  it('calls useDocumentTitle with "Accessibility Audit"', () => {
    render(<A11yAudit />);

    expect(mockedUseDocumentTitle).toHaveBeenCalledWith('Accessibility Audit');
  });
});
