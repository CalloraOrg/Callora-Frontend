import { render, screen } from '@testing-library/react';
import UsageChart from './UsageChart';

describe('UsageChart', () => {
  it('renders with default props', () => {
    render(<UsageChart />);
    
    expect(screen.getByLabelText('Usage Chart')).toBeInTheDocument();
    expect(screen.getByText('Usage Statistics')).toBeInTheDocument();
  });

  it('renders with custom props', () => {
    render(
      <UsageChart
        label="Custom Label"
        title="Custom Title"
        alt="Custom alt text"
      />
    );
    
    expect(screen.getByLabelText('Custom Label')).toBeInTheDocument();
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('renders responsive image with srcset', () => {
    render(<UsageChart />);
    
    const picture = document.querySelector('picture');
    expect(picture).toBeInTheDocument();
    
    const sources = picture?.querySelectorAll('source');
    expect(sources).toHaveLength(3);
    
    // Check small screen source
    expect(sources[0]).toHaveAttribute('srcSet', '/images/usage-chart-sm.svg');
    expect(sources[0]).toHaveAttribute('media', '(max-width: 480px)');
    
    // Check medium screen source
    expect(sources[1]).toHaveAttribute('srcSet', '/images/usage-chart-md.svg');
    expect(sources[1]).toHaveAttribute('media', '(max-width: 960px)');
    
    // Check large screen source
    expect(sources[2]).toHaveAttribute('srcSet', '/images/usage-chart-lg.svg');
    expect(sources[2]).toHaveAttribute('media', '(min-width: 961px)');
  });

  it('renders fallback img with correct attributes', () => {
    render(<UsageChart />);
    
    const img = document.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/images/usage-chart-md.svg');
    expect(img).toHaveAttribute('alt', 'Usage statistics chart showing API call trends');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('width', '400');
    expect(img).toHaveAttribute('height', '250');
  });

  it('applies correct CSS classes', () => {
    render(<UsageChart />);
    
    const container = screen.getByLabelText('Usage Chart');
    expect(container).toHaveClass('usage-chart');
    
    const img = document.querySelector('img');
    expect(img).toHaveClass('usage-chart__img');
  });

  it('has aria-hidden on illustration container', () => {
    render(<UsageChart />);
    
    const illustration = document.querySelector('.usage-chart__illustration');
    expect(illustration).toHaveAttribute('aria-hidden', 'true');
  });
});
