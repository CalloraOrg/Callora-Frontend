import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmbedPreview from './EmbedPreview';
import { ThemeProvider } from '../ThemeContext';

// Mock useTheme hook
vi.mock('../ThemeContext', async () => {
  const actual = await vi.importActual('../ThemeContext');
  return {
    ...actual,
    useTheme: () => ({
      theme: 'dark',
      actualTheme: 'dark',
      setTheme: () => {},
    }),
  };
});

const mockProps = {
  providerName: 'Weather API',
  stats: {
    totalCalls: 1000000,
    avgLatencyMs: 150,
    uptime: 99.99,
  },
  apiId: 'weather-api-123',
};

const renderComponent = (props = mockProps) => {
  return render(
    <ThemeProvider>
      <EmbedPreview {...props} />
    </ThemeProvider>
  );
};

describe('EmbedPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders provider name and stats in preview', () => {
    renderComponent();

    // Check that provider name is rendered
    const providerText = screen.queryByText('Weather API');
    expect(providerText).toBeTruthy();
  });

  it('renders all three size buttons with correct labels', () => {
    renderComponent();

    const smallBtn = screen.getByRole('button', {
      name: /small/i,
    });
    const mediumBtn = screen.getByRole('button', {
      name: /medium/i,
    });
    const largeBtn = screen.getByRole('button', {
      name: /large/i,
    });

    expect(smallBtn).toBeTruthy();
    expect(mediumBtn).toBeTruthy();
    expect(largeBtn).toBeTruthy();
  });

  it('size selector updates snippet dimensions', async () => {
    renderComponent();

    // Default is medium (400×200)
    let textarea = screen.getByLabelText('Embed code') as HTMLTextAreaElement;
    expect(textarea.value).toContain('width="400"');
    expect(textarea.value).toContain('height="200"');

    // Click Large button
    const largeBtn = screen.getByRole('button', { name: /large/i });
    fireEvent.click(largeBtn);

    await waitFor(() => {
      textarea = screen.getByLabelText('Embed code') as HTMLTextAreaElement;
      expect(textarea.value).toContain('width="600"');
      expect(textarea.value).toContain('height="300"');
    });

    // Verify aria-pressed
    expect(largeBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('copy button shows copied feedback on success', async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    renderComponent();

    const copyBtn = screen.getByLabelText('Copy embed snippet');
    expect(copyBtn.textContent).toContain('Copy Snippet');

    fireEvent.click(copyBtn);

    // Wait for state update to show "Copied!"
    await waitFor(() => {
      expect(copyBtn.textContent).toContain('Copied!');
    }, { timeout: 2000 });

    // The button should revert after 2 seconds
    await waitFor(
      () => {
        expect(copyBtn.textContent).toContain('Copy Snippet');
      },
      { timeout: 3000 }
    );
  });

  it('snippet includes correct api id and theme', () => {
    renderComponent({ ...mockProps, apiId: 'test-api-123' });

    const textarea = screen.getByLabelText('Embed code') as HTMLTextAreaElement;
    expect(textarea.value).toContain('embed/api/test-api-123');
    expect(textarea.value).toContain('theme=dark');
  });

  it('renders correct aria attributes for accessibility', () => {
    renderComponent();

    // Size selector group
    const sizeGroup = screen.getByRole('group', { name: /widget size/i });
    expect(sizeGroup).toBeTruthy();

    // Size buttons have aria-pressed
    const mediumBtn = screen.getByRole('button', {
      name: /medium/i,
    });
    expect(mediumBtn.getAttribute('aria-pressed')).toBe('true');

    // Preview container
    const preview = screen.getByLabelText('Widget preview');
    expect(preview).toBeTruthy();

    // Textarea accessibility
    const textarea = screen.getByLabelText('Embed code');
    expect(textarea.getAttribute('aria-multiline')).toBe('true');
    expect(textarea.getAttribute('readonly')).toBe('');

    // Copy button
    const copyBtn = screen.getByLabelText('Copy embed snippet');
    expect(copyBtn).toBeTruthy();
  });

  it('includes API ID in iframe src', () => {
    const { apiId } = mockProps;
    renderComponent();

    const textarea = screen.getByLabelText('Embed code') as HTMLTextAreaElement;
    expect(textarea.value).toContain(
      `src="https://callora.io/embed/api/${apiId}`
    );
  });

  it('has correct snippet structure', () => {
    renderComponent();

    const textarea = screen.getByLabelText('Embed code') as HTMLTextAreaElement;
    const snippet = textarea.value;

    // Check iframe attributes
    expect(snippet).toContain('<iframe');
    expect(snippet).toContain('frameborder="0"');
    expect(snippet).toContain('allow="clipboard-read; clipboard-write"');
    expect(snippet).toContain('title=');
    expect(snippet).toContain('</iframe>');
  });
});
