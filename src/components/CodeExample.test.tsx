// @vitest-environment jsdom
/**
 * CodeExample test suite
 *
 * Issue #724 — added focused tests for narrow (≤375 px) mobile viewports:
 *   - No inline layout styles on any structural element
 *   - panel has overflow-x: auto (handled via CSS class, not inline)
 *   - tab strip has correct ARIA and CSS classes
 *   - copy button has correct CSS class and min-height/width from CSS
 *   - component is fully keyboard-navigable at any viewport width
 *
 * Viewport-width assertions test the CSS *class contract*, not computed
 * layout, because jsdom does not apply @media rules. Each test verifies that
 * the correct class is present so that the CSS media-query rule can take
 * effect in a real browser — no inline styles must override those rules.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CodeExample from './CodeExample';

const mockSnippets = {
  bash: 'curl -X GET "https://api.example.com/data"',
  javascript: 'fetch("https://api.example.com/data").then(r => r.json())',
  python: 'import requests\nresponse = requests.get("https://api.example.com/data")',
};

describe('CodeExample', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── Persistence ──────────────────────────────────────────────────────────

  it('persists_selected_language_to_localStorage', async () => {
    render(<CodeExample snippets={mockSnippets} />);

    const pythonTab = screen.getByRole('tab', { name: /python/i });
    fireEvent.click(pythonTab);

    await waitFor(() => {
      const stored = localStorage.getItem('callora:codeExample:language');
      expect(stored).toBe(JSON.stringify('python'));
    });
  });

  it('restores_persisted_language_on_remount', () => {
    localStorage.setItem('callora:codeExample:language', JSON.stringify('python'));

    const { unmount } = render(<CodeExample snippets={mockSnippets} />);

    let pythonTab = screen.getByRole('tab', { name: /python/i });
    expect(pythonTab.getAttribute('aria-selected')).toBe('true');

    unmount();

    render(<CodeExample snippets={mockSnippets} />);
    pythonTab = screen.getByRole('tab', { name: /python/i });
    expect(pythonTab.getAttribute('aria-selected')).toBe('true');
  });

  it('falls_back_to_first_language_when_stored_language_not_in_list', () => {
    localStorage.setItem('callora:codeExample:language', JSON.stringify('cobol'));

    render(<CodeExample snippets={mockSnippets} />);

    const bashTab = screen.getByRole('tab', { name: /bash/i });
    expect(bashTab.getAttribute('aria-selected')).toBe('true');
  });

  // ── ARIA / Accessibility ──────────────────────────────────────────────────

  it('renders all language tabs with proper ARIA attributes', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist.getAttribute('aria-label')).toBe('Code language');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);

    tabs.forEach((tab) => {
      expect(tab.getAttribute('aria-selected')).toBeTruthy();
      expect(tab.getAttribute('aria-controls')).toBeTruthy();
      expect(tab.getAttribute('id')).toBeTruthy();
    });
  });

  it('renders_tabpanel_with_correct_ARIA_attributes', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabpanel = screen.getByRole('tabpanel');
    expect(tabpanel.getAttribute('id')).toMatch(/^tabpanel-/);
    expect(tabpanel.getAttribute('aria-labelledby')).toMatch(/^tab-/);
  });

  it('copy_button_has_accessible_label', () => {
    render(<CodeExample snippets={mockSnippets} />);
    const copyBtn = screen.getByLabelText(/copy code/i);
    expect(copyBtn).toBeTruthy();
  });

  it('announces_copy_success_to_screen_readers', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<CodeExample snippets={mockSnippets} />);

    const copyBtn = screen.getByLabelText(/copy code/i);
    fireEvent.click(copyBtn);

    await waitFor(
      () => {
        const announcement = screen.getByText('Code copied to clipboard');
        expect(announcement).toBeTruthy();
      },
      { timeout: 3000 }
    );
  });

  // ── Display ───────────────────────────────────────────────────────────────

  it('displays code for selected tab', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const pythonTab = screen.getByRole('tab', { name: /python/i });
    fireEvent.click(pythonTab);

    expect(screen.getByText(/import requests/)).toBeTruthy();
  });

  // ── Copy button behaviour ─────────────────────────────────────────────────

  it('copy_button_shows_copied_state_on_click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<CodeExample snippets={mockSnippets} />);

    const copyBtn = screen.getByLabelText(/copy code/i);
    expect(copyBtn.textContent).toContain('Copy');

    fireEvent.click(copyBtn);

    await waitFor(
      () => expect(copyBtn.textContent).toContain('Copied'),
      { timeout: 3000 }
    );
  });

  it('copy_button_reverts_after_delay', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<CodeExample snippets={mockSnippets} />);

    const copyBtn = screen.getByLabelText(/copy code/i);
    fireEvent.click(copyBtn);

    await waitFor(
      () => expect(copyBtn.textContent).toContain('Copied'),
      { timeout: 3000 }
    );

    // 2-second auto-revert + buffer
    await waitFor(
      () => expect(copyBtn.textContent).toContain('Copy'),
      { timeout: 4000 }
    );
  });

  // ── Keyboard navigation ───────────────────────────────────────────────────

  it('roving_tabindex_active_tab_has_0_others_have_negative_1', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('tabIndex')).toBe('0');
    expect(tabs[1].getAttribute('tabIndex')).toBe('-1');
  });

  it('arrow_right_moves_focus_to_next_tab', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });

    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('tabIndex')).toBe('0');
  });

  it('arrow_right_wraps_from_last_tab_to_first', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    const lastTab = tabs[tabs.length - 1];

    fireEvent.click(lastTab);
    fireEvent.keyDown(lastTab, { key: 'ArrowRight' });

    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('arrow_left_moves_focus_to_previous_tab', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[1]);
    fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' });

    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('arrow_left_wraps_from_first_tab_to_last', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    const lastTab = tabs[tabs.length - 1];

    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });

    expect(lastTab.getAttribute('aria-selected')).toBe('true');
  });

  it('home_key_moves_to_first_tab', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    const lastTab = tabs[tabs.length - 1];

    fireEvent.click(lastTab);
    fireEvent.keyDown(lastTab, { key: 'Home' });

    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('end_key_moves_to_last_tab', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    const lastTab = tabs[tabs.length - 1];

    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'End' });

    expect(lastTab.getAttribute('aria-selected')).toBe('true');
  });

  // ── Dark-theme CSS hooks ──────────────────────────────────────────────────

  describe('dark theme styling', () => {
    it('applies code-sample class for styling hooks', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const container = document.querySelector('.code-sample');
      expect(container).toBeTruthy();
    });

    it('has accessible focus styles on tabs (via CSS class)', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab.classList.contains('code-sample__tab')).toBe(true);
      });
    });
  });

  // ── Mobile layout — CSS-class contract (Issue #684) ───────────────────────
  //
  // jsdom does not evaluate @media rules, so these tests verify the *class
  // contract*: the correct BEM class is present so the CSS breakpoint rules
  // can apply in a real browser.  Inline styles must NOT be present on layout-
  // bearing elements because they would override @media rules at any
  // specificity level.
  //
  // New in Issue #684:
  // • Header carries a CSS transition for smooth flex-direction change
  // • All breakpoint references updated from #724 to #684
  // • Additional verification of mobile-scale tap targets and wrapping

  describe('mobile layout — CSS-class contract (Issue #684)', () => {
    it('header has no inline layout styles that would override @media rules', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const header = document.querySelector('.code-sample__header');
      expect(header).toBeTruthy();
      // An inline `style` attribute would prevent @media rules from applying.
      expect(header).not.toHaveAttribute('style');
    });

    it('tab strip has no inline layout styles that would override @media rules', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).not.toHaveAttribute('style');
    });

    it('each tab button has no inline layout styles', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).not.toHaveAttribute('style');
      });
    });

    it('copy button has no inline layout styles', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const copyBtn = screen.getByLabelText(/copy code/i);
      expect(copyBtn).not.toHaveAttribute('style');
    });

    it('panel has no inline layout styles that would override overflow-x', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const panel = screen.getByRole('tabpanel');
      // The panel must not have an inline style — overflow-x: auto comes from CSS.
      expect(panel).not.toHaveAttribute('style');
    });

    it('tab strip has code-sample__tabs class for responsive scroll behaviour', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tablist = screen.getByRole('tablist');
      expect(tablist.classList.contains('code-sample__tabs')).toBe(true);
    });

    it('each tab has code-sample__tab class for mobile tap-target styles', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab.classList.contains('code-sample__tab')).toBe(true);
      });
    });

    it('copy button has code-sample__copy class for responsive sizing', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const copyBtn = screen.getByLabelText(/copy code/i);
      expect(copyBtn.classList.contains('code-sample__copy')).toBe(true);
    });

    it('panel has code-sample__panel class for overflow-x: auto rule', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const panel = screen.getByRole('tabpanel');
      expect(panel.classList.contains('code-sample__panel')).toBe(true);
    });

    it('pre has code-sample__pre class for font-size and white-space rules', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const pre = document.querySelector('.code-sample__pre');
      expect(pre).toBeTruthy();
    });

    it('all tabs remain interactive on any viewport width', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(3);

      tabs.forEach(tab => expect(tab).toBeEnabled());

      fireEvent.click(tabs[2]);
      expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    });

    it('copy button remains accessible on any viewport width', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });

      render(<CodeExample snippets={mockSnippets} />);
      const copyBtn = screen.getByLabelText(/copy code/i);
      expect(copyBtn).toBeEnabled();

      fireEvent.click(copyBtn);

      await waitFor(() => expect(copyBtn.textContent).toContain('Copied'));
    });

    it('copy inner span uses code-sample__copy-inner class when copied', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });

      render(<CodeExample snippets={mockSnippets} />);
      const copyBtn = screen.getByLabelText(/copy code/i);
      fireEvent.click(copyBtn);

      await waitFor(() => {
        const inner = copyBtn.querySelector('.code-sample__copy-inner');
        expect(inner).toBeTruthy();
      });
    });

    // ── Issue #684: enhanced mobile layout tests ─────────────────────────
    //
    // These tests verify the CSS-class contract for the improvements added
    // as part of Issue #684.  jsdom does not evaluate @media rules, so
    // we check that the correct classes are present; the real @media query
    // applies in a browser.

    it('header uses CSS class for layout so @media breakpoint transitions take effect (Issue #684)', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const header = document.querySelector('.code-sample__header');
      expect(header).toBeTruthy();
      // No inline styles — all layout (including the flex-direction transition)
      // comes from code.css so @media rules can override at the breakpoint.
      expect(header).not.toHaveAttribute('style');
      expect(header!.classList.contains('code-sample__header')).toBe(true);
    });

    it('tab strip stays fully interactive when many tabs overflow (Issue #684)', () => {
      const manySnippets: Record<string, string> = {};
      for (let i = 0; i < 12; i++) {
        manySnippets[`lang-${i}`] = `code for lang ${i}`;
      }
      render(<CodeExample snippets={manySnippets} />);

      // All tabs must be rendered and clickable
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(12);
      tabs.forEach((tab) => expect(tab).toBeEnabled());

      // The tab strip must have overflow-x for horizontal scroll
      const tablist = screen.getByRole('tablist');
      expect(tablist.classList.contains('code-sample__tabs')).toBe(true);
    });

    it('panel has overflow-x: auto from CSS (not inline style) (Issue #684)', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const panel = screen.getByRole('tabpanel');
      // No inline style — overflow comes from CSS
      expect(panel).not.toHaveAttribute('style');
      expect(panel.classList.contains('code-sample__panel')).toBe(true);
    });

    it('pre uses code-sample__pre class for font-size and white-space rules (Issue #684)', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const pre = document.querySelector('.code-sample__pre');
      expect(pre).toBeTruthy();
      expect(pre!.classList.contains('code-sample__pre')).toBe(true);
    });
  });

  // ── Single-snippet edge case ──────────────────────────────────────────────

  describe('edge cases', () => {
    it('renders with a single snippet and no tab switching', () => {
      render(<CodeExample snippets={{ bash: 'echo hello' }} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(1);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      expect(tabs[0].getAttribute('tabIndex')).toBe('0');
    });

    it('shows nothing when snippets is empty object', () => {
      render(<CodeExample snippets={{}} />);
      const tabs = screen.queryAllByRole('tab');
      expect(tabs.length).toBe(0);
    });

    it('uses defaultLanguage when provided and no preference stored', () => {
      render(
        <CodeExample snippets={mockSnippets} defaultLanguage="javascript" />
      );
      const jsTab = screen.getByRole('tab', { name: /javascript/i });
      expect(jsTab.getAttribute('aria-selected')).toBe('true');
    });
  });
});
