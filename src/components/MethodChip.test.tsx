// @vitest-environment jsdom
/**
 * MethodChip.test.tsx
 *
 * Focused tests for the MethodChip component (GrantFox FWC26).
 *
 * Coverage:
 *  - Renders all recognised HTTP verbs
 *  - Case-insensitive input
 *  - Fallback for unknown verbs
 *  - aria-label / role="img" accessibility contract
 *  - Tooltip shown on hover and hidden on mouse-leave
 *  - Tooltip shown on focus and hidden on blur
 *  - CSS class contracts (method-chip, method-chip-icon, method-chip-label)
 *  - Token colour contract: inline style references --method-<verb>-bg / --method-<verb>-color
 *  - Responsive tap-target contract via ::before (class-level contract)
 *  - No overflow-triggering inline style on the chip (high-contrast safe)
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MethodChip } from './MethodChip';

afterEach(cleanup);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Renders a MethodChip and returns the root chip element via its aria-label. */
function renderChip(method: string) {
  render(<MethodChip method={method} />);
  // aria-label is "<METHOD> request", e.g. "GET request"
  const upperMethod = method.toUpperCase();
  return screen.getByRole('img', { name: `${upperMethod} request` });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering — all recognised verbs
// ─────────────────────────────────────────────────────────────────────────────

describe('MethodChip — rendering', () => {
  it.each(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])(
    'renders a chip for %s with role="img"',
    (method) => {
      const chip = renderChip(method);
      expect(chip).toBeTruthy();
      expect(chip.getAttribute('role')).toBe('img');
    },
  );

  it('renders the method label as visible text inside a .method-chip-label span', () => {
    renderChip('GET');
    // The label span should contain the method text
    const label = document.querySelector('.method-chip-label');
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe('GET');
  });

  it('renders the label in upper-case regardless of input casing', () => {
    render(<MethodChip method="delete" />);
    const chip = screen.getByRole('img', { name: 'DELETE request' });
    expect(chip).toBeTruthy();
    const label = chip.querySelector('.method-chip-label');
    expect(label?.textContent).toBe('DELETE');
  });

  it('is case-insensitive for all recognised verbs', () => {
    render(<MethodChip method="patch" />);
    const chip = screen.getByRole('img', { name: 'PATCH request' });
    expect(chip).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fallback — unknown verb
// ─────────────────────────────────────────────────────────────────────────────

describe('MethodChip — unknown verb fallback', () => {
  it('renders a chip for an unrecognised verb without throwing', () => {
    render(<MethodChip method="HEAD" />);
    const chip = screen.getByRole('img', { name: 'HEAD request' });
    expect(chip).toBeTruthy();
  });

  it('displays the label text for an unrecognised verb', () => {
    render(<MethodChip method="OPTIONS" />);
    const label = document.querySelector('.method-chip-label');
    expect(label?.textContent).toBe('OPTIONS');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accessibility — aria contract
// ─────────────────────────────────────────────────────────────────────────────

describe('MethodChip — accessibility', () => {
  it('has role="img" on the chip element', () => {
    const chip = renderChip('GET');
    expect(chip.getAttribute('role')).toBe('img');
  });

  it('has an aria-label of "<VERB> request"', () => {
    const chip = renderChip('POST');
    expect(chip.getAttribute('aria-label')).toBe('POST request');
  });

  it('is keyboard-focusable via tabIndex=0', () => {
    const chip = renderChip('PUT');
    expect(chip.getAttribute('tabindex')).toBe('0');
  });

  it('icon wrapper has aria-hidden="true" so it is not announced by screen readers', () => {
    renderChip('DELETE');
    const iconWrapper = document.querySelector('.method-chip-icon');
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Token colour contract — inline style maps to corrected CSS var names
// ─────────────────────────────────────────────────────────────────────────────

describe('MethodChip — colour token contract (FWC26 bug-fix)', () => {
  /**
   * The inline style must reference --method-<verb>-bg for background and
   * --method-<verb>-color for color (NOT -fg which was the pre-fix name).
   * jsdom does not resolve CSS custom properties, but it preserves the
   * var(…) string in element.style so we can assert the correct token name.
   */
  it.each([
    ['GET', '--method-get-bg', '--method-get-color'],
    ['POST', '--method-post-bg', '--method-post-color'],
    ['PUT', '--method-put-bg', '--method-put-color'],
    ['DELETE', '--method-delete-bg', '--method-delete-color'],
    ['PATCH', '--method-patch-bg', '--method-patch-color'],
  ])(
    '%s chip references the correct bg and color tokens',
    (method, expectedBg, expectedColor) => {
      const chip = renderChip(method);
      expect(chip.style.backgroundColor).toBe(`var(${expectedBg})`);
      expect(chip.style.color).toBe(`var(${expectedColor})`);
    },
  );

  it.each(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])(
    '%s chip does NOT use the deprecated -fg token suffix',
    (method) => {
      const chip = renderChip(method);
      expect(chip.style.color).not.toMatch(/-fg\)/);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CSS class contract
// ─────────────────────────────────────────────────────────────────────────────

describe('MethodChip — CSS class contract', () => {
  it('root element has the "method-chip" class', () => {
    const chip = renderChip('GET');
    expect(chip.classList.contains('method-chip')).toBe(true);
  });

  it('icon wrapper has the "method-chip-icon" class (not "method-icon")', () => {
    renderChip('GET');
    const iconWrapper = document.querySelector('.method-chip-icon');
    expect(iconWrapper).toBeTruthy();
    // Make sure the old broken class name is not present
    expect(document.querySelector('.method-icon')).toBeNull();
  });

  it('label has the "method-chip-label" class', () => {
    renderChip('GET');
    const label = document.querySelector('.method-chip-label');
    expect(label).toBeTruthy();
    expect(label?.classList.contains('method-chip-label')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip — hover and focus interactions
// ─────────────────────────────────────────────────────────────────────────────

describe('MethodChip — tooltip', () => {
  it('shows a tooltip with role="tooltip" on mouseEnter', () => {
    const chip = renderChip('GET');
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(chip);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip.textContent).toBe('GET request');
  });

  it('hides the tooltip on mouseLeave', () => {
    const chip = renderChip('GET');
    fireEvent.mouseEnter(chip);
    expect(screen.queryByRole('tooltip')).toBeTruthy();
    fireEvent.mouseLeave(chip);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows a tooltip on focus', () => {
    const chip = renderChip('POST');
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(chip);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toBe('POST request');
  });

  it('hides the tooltip on blur', () => {
    const chip = renderChip('POST');
    fireEvent.focus(chip);
    expect(screen.queryByRole('tooltip')).toBeTruthy();
    fireEvent.blur(chip);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('tooltip text matches the aria-label', () => {
    const chip = renderChip('DELETE');
    fireEvent.focus(chip);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toBe(chip.getAttribute('aria-label'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tap target — ::before contract (WCAG 2.1 AA §2.5.5, FWC26)
// ─────────────────────────────────────────────────────────────────────────────

describe('MethodChip — tap target (WCAG 2.1 AA §2.5.5)', () => {
  /**
   * jsdom does not apply CSS, so we cannot measure the pseudo-element
   * dimensions at runtime.  We verify the structural contract instead:
   *  - The chip carries the "method-chip" class that the CSS ::before rule
   *    targets.
   *  - There are no inline width/height overrides that would cap the visual
   *    size and thereby block the pseudo-element from expanding the hit area.
   *
   * The actual 44×44px measurement is covered by the companion Playwright
   * snapshot test (if/when added).
   */
  it('carries the "method-chip" class so ::before tap-target rule applies', () => {
    const chip = renderChip('GET');
    expect(chip.classList.contains('method-chip')).toBe(true);
  });

  it('does not set inline width or height that would block the CSS ::before expansion', () => {
    const chip = renderChip('GET');
    expect(chip.style.width).toBe('');
    expect(chip.style.height).toBe('');
    expect(chip.style.minWidth).toBe('');
    expect(chip.style.minHeight).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Text overflow contract
// ─────────────────────────────────────────────────────────────────────────────

describe('MethodChip — text overflow (FWC26 wrapping fix)', () => {
  it('does not set whitespace or overflow as inline styles (CSS handles it)', () => {
    const chip = renderChip('DELETE');
    // Overflow/wrapping must come from CSS classes, not inline styles,
    // so high-contrast overrides and design-token cascades are not blocked.
    expect(chip.style.whiteSpace).toBe('');
    expect(chip.style.overflow).toBe('');
    expect(chip.style.textOverflow).toBe('');
  });

  it('label span exists so CSS text-overflow: ellipsis can target it precisely', () => {
    renderChip('DELETE');
    const label = document.querySelector('.method-chip-label');
    expect(label).toBeTruthy();
  });
});
