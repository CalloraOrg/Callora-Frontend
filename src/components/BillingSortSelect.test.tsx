// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingSortSelect } from './BillingSortSelect';

const getSelect = () => screen.getByRole('combobox', { name: /sort transactions/i }) as HTMLSelectElement;

describe('BillingSortSelect', () => {
  afterEach(cleanup);

  it('shows a disabled "Default order" placeholder when nothing is sorted', () => {
    render(<BillingSortSelect column={null} direction="asc" onChange={vi.fn()} />);
    expect(getSelect().value).toBe('');
    expect(screen.getByRole('option', { name: 'Default order' })).toBeTruthy();
  });

  it('offers the four date/amount options and no placeholder once sorted', () => {
    render(<BillingSortSelect column="amount" direction="desc" onChange={vi.fn()} />);
    expect(getSelect().value).toBe('amount:desc');
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.queryByRole('option', { name: 'Default order' })).toBeNull();
  });

  it('reports the chosen column and direction', () => {
    const onChange = vi.fn();
    render(<BillingSortSelect column={null} direction="asc" onChange={onChange} />);
    fireEvent.change(getSelect(), { target: { value: 'date:asc' } });
    expect(onChange).toHaveBeenCalledWith('date', 'asc');
  });
});
