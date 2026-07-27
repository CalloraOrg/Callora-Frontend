// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchInput, type SearchStatusFilter } from './SearchInput';

afterEach(cleanup);

describe('SearchInput Component', () => {
  it('renders input field with default placeholder', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    const input = screen.getByRole('searchbox', { name: 'Search query input' });
    expect(input).toBeTruthy();
    expect(input.getAttribute('placeholder')).toBe('Search APIs, status, keywords...');
  });

  it('updates text on input change', () => {
    const handleChange = vi.fn();
    render(<SearchInput value="" onChange={handleChange} />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'payment' } });
    expect(handleChange).toHaveBeenCalledWith('payment');
  });

  it('clears query on clear button click', () => {
    const handleChange = vi.fn();
    render(<SearchInput value="test query" onChange={handleChange} />);
    const clearButton = screen.getByRole('button', { name: 'Clear search query' });
    fireEvent.click(clearButton);
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('triggers onSearch callback when Enter key is pressed', () => {
    const handleSearch = vi.fn();
    render(<SearchInput value="analytics" onChange={() => {}} onSearch={handleSearch} />);
    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(handleSearch).toHaveBeenCalledTimes(1);
  });

  it('clears query when Escape key is pressed', () => {
    const handleChange = vi.fn();
    render(<SearchInput value="analytics" onChange={handleChange} />);
    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(handleChange).toHaveBeenCalledWith('');
  });

  describe('Color-blind safe status chips', () => {
    it('renders all default status filter chips', () => {
      render(<SearchInput value="" onChange={() => {}} />);
      expect(screen.getByRole('button', { name: 'Status filter: All Statuses' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Status filter: Operational' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Status filter: Degraded' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Status filter: Error' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Status filter: Pending' })).toBeTruthy();
    });

    it('applies color-blind safe pattern classes to status chips', () => {
      render(<SearchInput value="" onChange={() => {}} />);

      const errorChip = screen.getByRole('button', { name: 'Status filter: Error' });
      expect(errorChip.classList.contains('sb-pattern-error')).toBe(true);
      expect(errorChip.classList.contains('search-status-pattern-error')).toBe(true);
      expect(errorChip.getAttribute('data-pattern')).toBe('stripes');

      const degradedChip = screen.getByRole('button', { name: 'Status filter: Degraded' });
      expect(degradedChip.classList.contains('sb-pattern-degraded')).toBe(true);
      expect(degradedChip.classList.contains('search-status-pattern-degraded')).toBe(true);
      expect(degradedChip.getAttribute('data-pattern')).toBe('opposite-stripes');

      const pendingChip = screen.getByRole('button', { name: 'Status filter: Pending' });
      expect(pendingChip.classList.contains('sb-pattern-pending')).toBe(true);
      expect(pendingChip.classList.contains('search-status-pattern-pending')).toBe(true);
      expect(pendingChip.getAttribute('data-pattern')).toBe('dots');
    });

    it('provides detailed aria-description for screen readers to explain non-color patterns', () => {
      render(<SearchInput value="" onChange={() => {}} />);

      const errorChip = screen.getByRole('button', { name: 'Status filter: Error' });
      expect(errorChip.getAttribute('aria-description')).toContain('Color-blind safe status chip');
      expect(errorChip.getAttribute('aria-description')).toContain('diagonal stripes');

      const degradedChip = screen.getByRole('button', { name: 'Status filter: Degraded' });
      expect(degradedChip.getAttribute('aria-description')).toContain('opposite diagonal stripes');
    });

    it('handles status chip selection callback', () => {
      const handleStatusChange = vi.fn();
      render(
        <SearchInput
          value=""
          onChange={() => {}}
          selectedStatus="all"
          onStatusChange={handleStatusChange}
        />
      );

      const errorChip = screen.getByRole('button', { name: 'Status filter: Error' });
      fireEvent.click(errorChip);
      expect(handleStatusChange).toHaveBeenCalledWith('error');
    });

    it('indicates selected state with aria-pressed', () => {
      function Wrapper() {
        const [st, setSt] = useState<SearchStatusFilter>('degraded');
        return <SearchInput value="" onChange={() => {}} selectedStatus={st} onStatusChange={setSt} />;
      }
      render(<Wrapper />);

      const degradedChip = screen.getByRole('button', { name: 'Status filter: Degraded' });
      expect(degradedChip.getAttribute('aria-pressed')).toBe('true');

      const errorChip = screen.getByRole('button', { name: 'Status filter: Error' });
      expect(errorChip.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(errorChip);
      expect(errorChip.getAttribute('aria-pressed')).toBe('true');
      expect(degradedChip.getAttribute('aria-pressed')).toBe('false');
    });
  });
});
