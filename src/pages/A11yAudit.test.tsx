// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import A11yAudit from './A11yAudit';

describe('A11yAudit — manifest upkeep docs link (#1158)', () => {
  afterEach(cleanup);

  it('links to the accessibility manifest upkeep guide', () => {
    render(<A11yAudit />);

    const link = screen.getByRole('link', { name: /manifest upkeep guide/i });
    expect(link).toHaveAttribute('href', 'docs/a11y-manifest.md');
  });
});
