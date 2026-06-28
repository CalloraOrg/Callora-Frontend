// @vitest-environment jsdom
/**
 * Tests for src/components/Tabs.tsx
 *
 * Coverage goals
 * ──────────────
 * • Rendering: all tabs appear; active tab is marked aria-selected=true.
 * • Mouse interaction: clicking a tab calls onChange with the correct id.
 * • Keyboard navigation (APG Tab Pattern):
 *   - ArrowRight advances focus to the next tab (wraps).
 *   - ArrowLeft retreats focus to the previous tab (wraps).
 *   - Home focuses the first tab.
 *   - End focuses the last tab.
 * • Accessibility attributes:
 *   - role="tablist" present on the list container.
 *   - Each button has role="tab".
 *   - aria-selected="true" on active, "false" on others.
 *   - aria-controls points to the correct panel id.
 *   - tabIndex=0 on active tab, -1 on inactive tabs.
 *   - tabpanel role, id, and aria-labelledby on each panel.
 * • Indicator element: the decorative span is aria-hidden.
 * • Custom tabPanelId prop is respected.
 * • Single-tab edge case: arrow keys do not crash.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Tabs from './Tabs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_TABS = [
  { id: 'overview',      label: 'Overview'      },
  { id: 'documentation', label: 'Documentation' },
  { id: 'pricing',       label: 'Pricing'       },
];

function renderTabs(
  activeTab = 'overview',
  onChange = vi.fn(),
  tabs = DEFAULT_TABS,
) {
  return render(
    <Tabs tabs={tabs} activeTab={activeTab} onChange={onChange} />,
  );
}

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('Tabs — rendering', () => {
  it('renders all tab labels', () => {
    renderTabs();
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Documentation')).toBeTruthy();
    expect(screen.getByText('Pricing')).toBeTruthy();
  });

  it('renders a nav element with aria-label', () => {
    const { container } = renderTabs();
    const nav = container.querySelector('nav');
    expect(nav).toBeTruthy();
    expect(nav?.getAttribute('aria-label')).toBeTruthy();
  });

  it('renders a tablist container', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('renders each tab as role="tab"', () => {
    renderTabs();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('renders the decorative indicator span as aria-hidden', () => {
    const { container } = renderTabs();
    const indicator = container.querySelector('.tabs-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// aria-selected
// ---------------------------------------------------------------------------

describe('Tabs — aria-selected', () => {
  it('sets aria-selected="true" on the active tab', () => {
    renderTabs('documentation');
    const docTab = screen.getByRole('tab', { name: 'Documentation' });
    expect(docTab.getAttribute('aria-selected')).toBe('true');
  });

  it('sets aria-selected="false" on inactive tabs', () => {
    renderTabs('documentation');
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    const pricingTab  = screen.getByRole('tab', { name: 'Pricing'  });
    expect(overviewTab.getAttribute('aria-selected')).toBe('false');
    expect(pricingTab.getAttribute('aria-selected')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// tabIndex roving
// ---------------------------------------------------------------------------

describe('Tabs — tabIndex', () => {
  it('gives tabIndex=0 to the active tab', () => {
    renderTabs('pricing');
    const pricingTab = screen.getByRole('tab', { name: 'Pricing' });
    expect(pricingTab.getAttribute('tabIndex') ?? pricingTab.tabIndex).toBe('0');
  });

  it('gives tabIndex=-1 to inactive tabs', () => {
    renderTabs('pricing');
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    expect(overviewTab.getAttribute('tabIndex') ?? overviewTab.tabIndex).toBe('-1');
  });
});

// ---------------------------------------------------------------------------
// aria-controls
// ---------------------------------------------------------------------------

describe('Tabs — aria-controls', () => {
  it('defaults aria-controls to "panel-{id}"', () => {
    renderTabs();
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    expect(overviewTab.getAttribute('aria-controls')).toBe('panel-overview');
  });

  it('respects a custom tabPanelId function', () => {
    render(
      <Tabs
        tabs={DEFAULT_TABS}
        activeTab="overview"
        onChange={vi.fn()}
        tabPanelId={(id) => `custom-panel-${id}`}
      />,
    );
    const tab = screen.getByRole('tab', { name: 'Overview' });
    expect(tab.getAttribute('aria-controls')).toBe('custom-panel-overview');
  });

  it('each tab has a unique aria-controls value', () => {
    renderTabs();
    const tabs = screen.getAllByRole('tab');
    const controls = tabs.map((t) => t.getAttribute('aria-controls'));
    const unique = new Set(controls);
    expect(unique.size).toBe(controls.length);
  });
});

// ---------------------------------------------------------------------------
// Mouse interaction
// ---------------------------------------------------------------------------

describe('Tabs — mouse interaction', () => {
  it('calls onChange with the correct id on click', () => {
    const onChange = vi.fn();
    renderTabs('overview', onChange);

    fireEvent.click(screen.getByRole('tab', { name: 'Pricing' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('pricing');
  });

  it('calls onChange when the already-active tab is clicked', () => {
    const onChange = vi.fn();
    renderTabs('overview', onChange);

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(onChange).toHaveBeenCalledWith('overview');
  });
});

// ---------------------------------------------------------------------------
// Keyboard navigation (APG Tab Pattern)
// ---------------------------------------------------------------------------

describe('Tabs — keyboard navigation', () => {
  it('ArrowRight moves to the next tab', () => {
    const onChange = vi.fn();
    renderTabs('overview', onChange);

    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith('documentation');
  });

  it('ArrowRight wraps from last to first', () => {
    const onChange = vi.fn();
    renderTabs('pricing', onChange);

    const pricingTab = screen.getByRole('tab', { name: 'Pricing' });
    fireEvent.keyDown(pricingTab, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith('overview');
  });

  it('ArrowLeft moves to the previous tab', () => {
    const onChange = vi.fn();
    renderTabs('documentation', onChange);

    const docTab = screen.getByRole('tab', { name: 'Documentation' });
    fireEvent.keyDown(docTab, { key: 'ArrowLeft' });

    expect(onChange).toHaveBeenCalledWith('overview');
  });

  it('ArrowLeft wraps from first to last', () => {
    const onChange = vi.fn();
    renderTabs('overview', onChange);

    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    fireEvent.keyDown(overviewTab, { key: 'ArrowLeft' });

    expect(onChange).toHaveBeenCalledWith('pricing');
  });

  it('Home jumps to the first tab', () => {
    const onChange = vi.fn();
    renderTabs('pricing', onChange);

    const pricingTab = screen.getByRole('tab', { name: 'Pricing' });
    fireEvent.keyDown(pricingTab, { key: 'Home' });

    expect(onChange).toHaveBeenCalledWith('overview');
  });

  it('End jumps to the last tab', () => {
    const onChange = vi.fn();
    renderTabs('overview', onChange);

    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    fireEvent.keyDown(overviewTab, { key: 'End' });

    expect(onChange).toHaveBeenCalledWith('pricing');
  });

  it('other keys do not call onChange', () => {
    const onChange = vi.fn();
    renderTabs('overview', onChange);

    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    fireEvent.keyDown(overviewTab, { key: 'Tab' });
    fireEvent.keyDown(overviewTab, { key: 'Enter' });
    fireEvent.keyDown(overviewTab, { key: ' ' });

    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Tabs — edge cases', () => {
  it('handles a single tab without crashing on arrow keys', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        tabs={[{ id: 'only', label: 'Only' }]}
        activeTab="only"
        onChange={onChange}
      />,
    );
    const onlyTab = screen.getByRole('tab', { name: 'Only' });
    // Should not throw
    expect(() => fireEvent.keyDown(onlyTab, { key: 'ArrowRight' })).not.toThrow();
    expect(() => fireEvent.keyDown(onlyTab, { key: 'ArrowLeft'  })).not.toThrow();
    // Wraps back to itself
    expect(onChange).toHaveBeenCalledWith('only');
  });

  it('renders correctly with two tabs', () => {
    render(
      <Tabs
        tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]}
        activeTab="a"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('applies custom className to the nav', () => {
    const { container } = render(
      <Tabs
        tabs={DEFAULT_TABS}
        activeTab="overview"
        onChange={vi.fn()}
        className="my-custom-tabs"
      />,
    );
    const nav = container.querySelector('nav');
    expect(nav?.classList.contains('my-custom-tabs')).toBe(true);
    expect(nav?.classList.contains('tabs-nav')).toBe(true);
  });

  it('id attribute on each tab button matches "tab-{id}"', () => {
    renderTabs();
    DEFAULT_TABS.forEach(({ id, label }) => {
      const tab = screen.getByRole('tab', { name: label });
      expect(tab.id).toBe(`tab-${id}`);
    });
  });
});
