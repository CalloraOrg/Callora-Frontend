import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PlanNudge from './PlanNudge';

function renderNudge(overrides: Partial<{ usagePercent: number; onDismiss: () => void }> = {}) {
  const onDismiss = vi.fn();
  const props = { usagePercent: 85, onDismiss, ...overrides };
  return { ...render(<PlanNudge {...props} />), onDismiss };
}

describe('PlanNudge', () => {
  it('renders nothing when usage is below 80', () => {
    renderNudge({ usagePercent: 50 });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the banner when usage is at 80', () => {
    renderNudge({ usagePercent: 80 });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders warning message for 80-94% usage', () => {
    renderNudge({ usagePercent: 85 });
    expect(screen.getByText(/Heads up/i)).toBeInTheDocument();
  });

  it('renders critical message for >=95% usage', () => {
    renderNudge({ usagePercent: 95 });
    expect(screen.getByText(/Critical/i)).toBeInTheDocument();
  });

  it('renders a responsive picture element with srcSet', () => {
    renderNudge();
    const picture = document.querySelector('picture');
    expect(picture).toBeInTheDocument();
    const sources = picture!.querySelectorAll('source');
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources[0]).toHaveAttribute('srcSet');
    expect(sources[0]).toHaveAttribute('media');
  });

  it('renders the upgrade illustration img with lazy loading', () => {
    renderNudge();
    const img = document.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('alt', '');
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderNudge();
    await user.click(screen.getByLabelText('Dismiss this notification'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders an upgrade link pointing to /billing/upgrade', () => {
    renderNudge();
    const link = screen.getByRole('link', { name: /upgrade your plan/i });
    expect(link).toHaveAttribute('href', '/billing/upgrade');
  });

  it('renders a keyboard shortcut hint on the upgrade link', () => {
    renderNudge();
    const link = screen.getByRole('link', { name: /upgrade your plan/i });
    const kbdHint = link.querySelector('.kbd-hint--subtle');
    expect(kbdHint).toBeInTheDocument();
    expect(kbdHint).toHaveAttribute('aria-label', 'Upgrade keyboard shortcut');
  });

  it('renders the correct keyboard shortcut key', () => {
    renderNudge();
    const link = screen.getByRole('link', { name: /upgrade your plan/i });
    const kbdKey = link.querySelector('.kbd-hint__key');
    expect(kbdKey).toBeInTheDocument();
    expect(kbdKey).toHaveTextContent('u');
  });
});
