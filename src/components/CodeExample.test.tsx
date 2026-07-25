// @vitest-environment jsdom
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

  it('displays code for selected tab', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const pythonTab = screen.getByRole('tab', { name: /python/i });
    fireEvent.click(pythonTab);

    expect(screen.getByText(/import requests/)).toBeTruthy();
  });

  it('copy_button_shows_copied_state_on_click', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<CodeExample snippets={mockSnippets} />);

    const copyBtn = screen.getByLabelText(/copy code/i);
    expect(copyBtn.textContent).toContain('Copy');

    fireEvent.click(copyBtn);

    await waitFor(
      () => {
        expect(copyBtn.textContent).toContain('Copied');
      },
      { timeout: 3000 }
    );
  });

  it('copy_button_reverts_after_delay', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<CodeExample snippets={mockSnippets} />);

    const copyBtn = screen.getByLabelText(/copy code/i);
    fireEvent.click(copyBtn);

    // Wait for copied state
    await waitFor(
      () => {
        expect(copyBtn.textContent).toContain('Copied');
      },
      { timeout: 3000 }
    );

    // Wait for revert (2 seconds + buffer)
    await waitFor(
      () => {
        expect(copyBtn.textContent).toContain('Copy');
      },
      { timeout: 4000 }
    );
  });

  it('roving_tabindex_active_tab_has_0_others_have_negative_1', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    const activeTab = tabs[0];
    const inactiveTab = tabs[1];

    expect(activeTab.getAttribute('tabIndex')).toBe('0');
    expect(inactiveTab.getAttribute('tabIndex')).toBe('-1');
  });

  it('arrow_right_moves_focus_to_next_tab', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    const firstTab = tabs[0];

    firstTab.focus();
    fireEvent.keyDown(firstTab, { key: 'ArrowRight' });

    const secondTab = tabs[1];
    expect(secondTab.getAttribute('aria-selected')).toBe('true');
    expect(secondTab.getAttribute('tabIndex')).toBe('0');
  });

  it('arrow_right_wraps_from_last_tab_to_first', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    const lastTab = tabs[tabs.length - 1];

    fireEvent.click(lastTab);
    fireEvent.keyDown(lastTab, { key: 'ArrowRight' });

    const firstTab = tabs[0];
    expect(firstTab.getAttribute('aria-selected')).toBe('true');
  });

  it('arrow_left_moves_focus_to_previous_tab', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    const secondTab = tabs[1];

    fireEvent.click(secondTab);
    fireEvent.keyDown(secondTab, { key: 'ArrowLeft' });

    const firstTab = tabs[0];
    expect(firstTab.getAttribute('aria-selected')).toBe('true');
  });

  it('arrow_left_wraps_from_first_tab_to_last', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabs = screen.getAllByRole('tab');
    const firstTab = tabs[0];
    const lastTab = tabs[tabs.length - 1];

    firstTab.focus();
    fireEvent.keyDown(firstTab, { key: 'ArrowLeft' });

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
    const firstTab = tabs[0];
    const lastTab = tabs[tabs.length - 1];

    firstTab.focus();
    fireEvent.keyDown(firstTab, { key: 'End' });

    expect(lastTab.getAttribute('aria-selected')).toBe('true');
  });

  it('renders_tabpanel_with_correct_ARIA_attributes', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const tabpanel = screen.getByRole('tabpanel');
    expect(tabpanel.getAttribute('id')).toMatch(/^tabpanel-/);
    expect(tabpanel.getAttribute('aria-labelledby')).toMatch(/^tab-/);
  });

  it('announces_copy_success_to_screen_readers', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
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

  it('copy_button_has_accessible_label', () => {
    render(<CodeExample snippets={mockSnippets} />);

    const copyBtn = screen.getByLabelText(/copy code/i);
    expect(copyBtn).toBeTruthy();
  });

  describe('dark theme styling', () => {
    it('applies code-sample class for styling hooks', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const container = document.querySelector('.code-sample');
      expect(container).toBeTruthy();
    });

    it('has accessible focus styles on tabs', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab.classList.contains('code-sample__tab')).toBe(true);
      });
    });
  });

  describe('narrow viewport layout (≤375px)', () => {
    it('tab buttons have minimum tap-target height of 36px', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab.style.minHeight).toBe('36px');
      });
    });

    it('tab buttons have minimum width of 44px for touch accessibility', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab.style.minWidth).toBe('44px');
      });
    });

    it('copy button has minimum tap-target height of 36px', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const copyBtn = screen.getByLabelText(/copy code/i);
      expect(copyBtn.style.minHeight).toBe('36px');
    });

    it('header wraps on narrow viewports via flexWrap', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const header = document.querySelector('.code-sample__header') as HTMLElement;
      expect(header).toBeTruthy();
      expect(header.style.flexWrap).toBe('wrap');
    });

    it('tablist scrolls horizontally on narrow viewports', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tablist = screen.getByRole('tablist');
      expect(tablist.style.overflowX).toBe('auto');
    });

    it('tab buttons do not shrink on narrow viewports', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab.style.flexShrink).toBe('0');
      });
    });

    it('code panel is horizontally scrollable on narrow viewports', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const panel = screen.getByRole('tabpanel');
      expect(panel.style.overflowX).toBe('auto');
    });

    it('tabs have whitespace nowrap to prevent text breaking', () => {
      render(<CodeExample snippets={mockSnippets} />);
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab.style.whiteSpace).toBe('nowrap');
      });
    });
  });
});
