import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OfflineBanner from './OfflineBanner';

describe('OfflineBanner', () => {
  it('shows a polite status notice while offline', () => {
    render(<OfflineBanner isOnline={false} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/you are offline/i);
    expect(status).toHaveTextContent(/may be out of date/i);
  });

  it('renders nothing while online', () => {
    const { container } = render(<OfflineBanner isOnline />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
