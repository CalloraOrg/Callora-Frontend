// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PreviewCard, { type PreviewCardData } from './PreviewCard';

const MOCK_PREVIEW_DATA: PreviewCardData = {
  id: 'test-api-preview',
  title: 'WeatherSim API',
  subtitle: 'Callora Verified',
  category: 'Weather & Climate',
  description: 'Global high-resolution weather forecasting API endpoint.',
  status: 'operational',
  price: 0.005,
  tags: ['weather', 'forecast', 'climate'],
  metrics: [
    { label: 'Latency', value: '35ms' },
    { label: 'Uptime', value: '99.9%' },
  ],
  lastActive: '10 mins ago',
};

describe('PreviewCard Component', () => {
  afterEach(cleanup);

  it('does not render the preview panel initially', () => {
    render(
      <PreviewCard data={MOCK_PREVIEW_DATA}>
        <div>Card trigger</div>
      </PreviewCard>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renders trigger element with an accessible aria-label', () => {
    render(
      <PreviewCard data={MOCK_PREVIEW_DATA}>
        <div>Card trigger</div>
      </PreviewCard>,
    );

    const trigger = screen.getByRole('button', {
      name: /preview details for weathersim api/i,
    });
    expect(trigger).toBeTruthy();
  });

  it('opens panel on mouseEnter and hides on mouseLeave', () => {
    const { container } = render(
      <PreviewCard data={MOCK_PREVIEW_DATA}>
        <div>Card trigger</div>
      </PreviewCard>,
    );

    const wrapper = container.querySelector('.preview-card__wrapper') as HTMLElement;
    expect(wrapper).toBeTruthy();

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByRole('tooltip')).toHaveTextContent('WeatherSim API');

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens panel when trigger receives keyboard focus', () => {
    render(
      <PreviewCard data={MOCK_PREVIEW_DATA}>
        <div>Card trigger</div>
      </PreviewCard>,
    );

    const trigger = screen.getByRole('button', {
      name: /preview details for weathersim api/i,
    });

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('links trigger to preview panel via aria-describedby while open', () => {
    render(
      <PreviewCard data={MOCK_PREVIEW_DATA}>
        <div>Card trigger</div>
      </PreviewCard>,
    );

    const trigger = screen.getByRole('button', {
      name: /preview details for weathersim api/i,
    });

    fireEvent.focus(trigger);

    const panel = screen.getByRole('tooltip');
    expect(trigger.getAttribute('aria-describedby')).toBe(panel.id);
  });

  it('closes preview panel and clears aria-describedby on Escape key', () => {
    render(
      <PreviewCard data={MOCK_PREVIEW_DATA}>
        <div>Card trigger</div>
      </PreviewCard>,
    );

    const trigger = screen.getByRole('button', {
      name: /preview details for weathersim api/i,
    });

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('renders title, status, description, metrics, and tags inside panel', () => {
    render(
      <PreviewCard data={MOCK_PREVIEW_DATA}>
        <div>Card trigger</div>
      </PreviewCard>,
    );

    const trigger = screen.getByRole('button', {
      name: /preview details for weathersim api/i,
    });
    fireEvent.focus(trigger);

    const panel = screen.getByRole('tooltip');
    expect(panel).toHaveTextContent('WeatherSim API');
    expect(panel).toHaveTextContent('Global high-resolution weather forecasting API endpoint.');
    expect(panel).toHaveTextContent('Latency');
    expect(panel).toHaveTextContent('35ms');
    expect(panel).toHaveTextContent('#weather');
    expect(panel).toHaveTextContent('$0.005 / call');
  });
});
