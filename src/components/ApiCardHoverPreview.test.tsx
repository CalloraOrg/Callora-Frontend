// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { ApiCardHoverPreview, useHoverPreview } from './ApiCardHoverPreview';
import type { APIItem } from '../data/mockApis';

describe('ApiCardHoverPreview', () => {
  afterEach(() => {
    // cleanup is automatic with vitest/react-testing-library setupTests
  });

  const mockApi: APIItem = {
    id: 'test-api',
    name: 'Test API',
    provider: { name: 'Test Provider' },
    description: 'A test API description',
    pricePerRequest: 0.01,
    pricing: 0.05,
    tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'],
  };

  it('positions itself from anchorRect (left equals anchorRect.right + 8)', () => {
    const anchorRect = {
      top: 100,
      bottom: 150,
      left: 200,
      right: 350,
      width: 150,
      height: 50,
      x: 200,
      y: 100,
      toJSON: () => {},
    } as DOMRect;

    render(<ApiCardHoverPreview api={mockApi} anchorRect={anchorRect} />);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip.style.top).toBe('100px');
    expect(tooltip.style.left).toBe('358px'); // 350 + 8
  });

  it('renders at most four tags for a six-tag API', () => {
    const anchorRect = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect;

    render(<ApiCardHoverPreview api={mockApi} anchorRect={anchorRect} />);

    expect(screen.getByText('tag1')).toBeTruthy();
    expect(screen.getByText('tag2')).toBeTruthy();
    expect(screen.getByText('tag3')).toBeTruthy();
    expect(screen.getByText('tag4')).toBeTruthy();
    expect(screen.queryByText('tag5')).toBeNull();
    expect(screen.queryByText('tag6')).toBeNull();
  });

  it("renders 'Free' when pricing is falsy", () => {
    const anchorRect = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect;

    const freeApi: APIItem = {
      ...mockApi,
      pricing: undefined,
    };

    const { rerender } = render(<ApiCardHoverPreview api={freeApi} anchorRect={anchorRect} />);
    expect(screen.getByText('Free')).toBeTruthy();

    const zeroPricingApi: APIItem = {
      ...mockApi,
      pricing: 0,
    };
    rerender(<ApiCardHoverPreview api={zeroPricingApi} anchorRect={anchorRect} />);
    expect(screen.getByText('Free')).toBeTruthy();
  });
});

describe('useHoverPreview', () => {
  it('stores hovered API and rect on mouse enter and clears on mouse leave', () => {
    const { result } = renderHook(() => useHoverPreview());

    expect(result.current.hovered).toBeNull();

    const mockElement = document.createElement('div');
    mockElement.getBoundingClientRect = () => ({
      top: 10,
      bottom: 20,
      left: 30,
      right: 40,
      width: 10,
      height: 10,
      x: 30,
      y: 10,
      toJSON: () => {},
    } as DOMRect);

    const mockEvent = {
      currentTarget: mockElement,
    } as unknown as React.MouseEvent<HTMLElement>;

    const mockApi: APIItem = {
      id: 'hook-api',
      name: 'Hook API',
      provider: { name: 'Provider' },
      description: 'Desc',
      pricePerRequest: 0,
    };

    act(() => {
      result.current.onMouseEnter(mockApi, mockEvent);
    });

    expect(result.current.hovered).not.toBeNull();
    expect(result.current.hovered?.api).toEqual(mockApi);
    expect(result.current.hovered?.rect.right).toBe(40);

    act(() => {
      result.current.onMouseLeave();
    });

    expect(result.current.hovered).toBeNull();
  });
});
