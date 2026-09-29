// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionExpiryBanner from './SessionExpiryBanner';

const defaultProps = {
  isVisible: true,
  countdown: null,
  onDismiss: vi.fn(),
};

describe('SessionExpiryBanner', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when isVisible is false', () => {
    render(<SessionExpiryBanner {...defaultProps} isVisible={false} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders banner when isVisible is true', async () => {
    vi.useFakeTimers();
    render(<SessionExpiryBanner {...defaultProps} />);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('displays default message when no custom message provided', async () => {
    vi.useFakeTimers();
    render(<SessionExpiryBanner {...defaultProps} />);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(
      screen.getByText('Your session has expired'),
    ).toBeInTheDocument();
  });

  it('displays custom message when provided', async () => {
    vi.useFakeTimers();
    render(
      <SessionExpiryBanner
        {...defaultProps}
        message="Custom expiry message"
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText('Custom expiry message')).toBeInTheDocument();
  });

  it('displays detail text about data preservation', async () => {
    vi.useFakeTimers();
    render(<SessionExpiryBanner {...defaultProps} />);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(
      screen.getByText(/Your unsaved form data has been preserved/),
    ).toBeInTheDocument();
  });

  it('shows countdown when provided', async () => {
    vi.useFakeTimers();
    render(<SessionExpiryBanner {...defaultProps} countdown={5} />);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText(/Redirecting in 5 seconds/)).toBeInTheDocument();
  });

  it('shows singular second for countdown of 1', async () => {
    vi.useFakeTimers();
    render(<SessionExpiryBanner {...defaultProps} countdown={1} />);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText(/Redirecting in 1 second\.\.\./)).toBeInTheDocument();
  });

  it('does not show countdown when null', async () => {
    vi.useFakeTimers();
    render(<SessionExpiryBanner {...defaultProps} countdown={null} />);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText(/Redirecting/)).not.toBeInTheDocument();
  });

  it('calls onDismiss when Dismiss button is clicked', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <SessionExpiryBanner {...defaultProps} onDismiss={onDismiss} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await user.click(
      screen.getByRole('button', { name: /dismiss/i }),
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows Re-authenticate button when onReauthenticate is provided', async () => {
    vi.useFakeTimers();
    const onReauthenticate = vi.fn();

    render(
      <SessionExpiryBanner
        {...defaultProps}
        onReauthenticate={onReauthenticate}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(
      screen.getByRole('button', { name: /re-authenticate/i }),
    ).toBeInTheDocument();
  });

  it('does not show Re-authenticate button when onReauthenticate is not provided', async () => {
    vi.useFakeTimers();
    render(<SessionExpiryBanner {...defaultProps} />);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(
      screen.queryByRole('button', { name: /re-authenticate/i }),
    ).not.toBeInTheDocument();
  });

  it('calls onReauthenticate when Re-authenticate button is clicked', async () => {
    vi.useFakeTimers();
    const onReauthenticate = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <SessionExpiryBanner
        {...defaultProps}
        onReauthenticate={onReauthenticate}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await user.click(
      screen.getByRole('button', { name: /re-authenticate/i }),
    );

    expect(onReauthenticate).toHaveBeenCalledTimes(1);
  });

  it('has correct ARIA attributes', async () => {
    vi.useFakeTimers();
    render(<SessionExpiryBanner {...defaultProps} />);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    const banner = screen.getByRole('alert');
    expect(banner).toHaveAttribute('aria-live', 'assertive');
    expect(banner).toHaveAttribute('tabindex', '-1');
  });
});
