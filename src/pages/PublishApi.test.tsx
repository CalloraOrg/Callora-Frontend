// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublishApi from './PublishApi';
import { ThemeProvider } from '../ThemeContext';
import { CollectionsProvider } from '../state/collectionsStore';
import { AccountProvider } from '../hooks/useAccountContext';
import { ToastProvider } from '../components/Toast';
import { MemoryRouter } from 'react-router-dom';

// Mock matchMedia (required by ThemeProvider)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <CollectionsProvider>
        <AccountProvider>
          <MemoryRouter>
            <ToastProvider>{ui}</ToastProvider>
          </MemoryRouter>
        </AccountProvider>
      </CollectionsProvider>
    </ThemeProvider>,
  );
}

describe('PublishApi', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders within the required providers with initial form fields', () => {
    renderWithProviders(<PublishApi />);

    expect(screen.getByRole('heading', { level: 1, name: /publish your api/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/api name/i)).toHaveValue('');
    expect(screen.getByLabelText(/base url/i)).toHaveValue('');
    expect(screen.getByLabelText(/category/i)).toHaveValue('');
    expect(screen.getByLabelText(/price per call/i)).toHaveValue('');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /publish api/i })).toBeInTheDocument();
  });

  describe('Validation - Scheme and URL validation', () => {
    it('shows https error for http:// base URLs on blur', () => {
      renderWithProviders(<PublishApi />);
      const urlInput = screen.getByLabelText(/base url/i);

      fireEvent.change(urlInput, { target: { value: 'http://api.example.com' } });
      fireEvent.blur(urlInput);

      expect(screen.getByText('Base URL must use the https scheme.')).toBeInTheDocument();
      expect(urlInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('shows valid URL error for malformed URL on blur', () => {
      renderWithProviders(<PublishApi />);
      const urlInput = screen.getByLabelText(/base url/i);

      fireEvent.change(urlInput, { target: { value: 'not-a-valid-url' } });
      fireEvent.blur(urlInput);

      expect(screen.getByText('Enter a valid URL (e.g. https://api.example.com).')).toBeInTheDocument();
      expect(urlInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('shows required error when base URL is empty after blur', () => {
      renderWithProviders(<PublishApi />);
      const urlInput = screen.getByLabelText(/base url/i);

      fireEvent.focus(urlInput);
      fireEvent.blur(urlInput);

      expect(screen.getByText('Base URL is required.')).toBeInTheDocument();
      expect(urlInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('clears URL error when valid https URL is provided', () => {
      renderWithProviders(<PublishApi />);
      const urlInput = screen.getByLabelText(/base url/i);

      fireEvent.change(urlInput, { target: { value: 'http://insecure.example.com' } });
      fireEvent.blur(urlInput);
      expect(screen.getByText('Base URL must use the https scheme.')).toBeInTheDocument();

      fireEvent.change(urlInput, { target: { value: 'https://secure.example.com' } });
      expect(screen.queryByText('Base URL must use the https scheme.')).not.toBeInTheDocument();
      expect(urlInput).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Validation - Price per call validation', () => {
    it('shows "must be 0 or greater" for a negative price on blur', () => {
      renderWithProviders(<PublishApi />);
      const priceInput = screen.getByLabelText(/price per call/i);

      fireEvent.change(priceInput, { target: { value: '-0.5' } });
      fireEvent.blur(priceInput);

      expect(screen.getByText('Price per call must be 0 or greater.')).toBeInTheDocument();
      expect(priceInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('shows "must be 0 or greater" for non-numeric price on blur', () => {
      renderWithProviders(<PublishApi />);
      const priceInput = screen.getByLabelText(/price per call/i);

      fireEvent.change(priceInput, { target: { value: 'abc' } });
      fireEvent.blur(priceInput);

      expect(screen.getByText('Price per call must be 0 or greater.')).toBeInTheDocument();
      expect(priceInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('accepts 0 and positive numeric price values without error', () => {
      renderWithProviders(<PublishApi />);
      const priceInput = screen.getByLabelText(/price per call/i);

      fireEvent.change(priceInput, { target: { value: '0' } });
      fireEvent.blur(priceInput);
      expect(screen.queryByText('Price per call must be 0 or greater.')).not.toBeInTheDocument();

      fireEvent.change(priceInput, { target: { value: '0.005' } });
      fireEvent.blur(priceInput);
      expect(screen.queryByText('Price per call must be 0 or greater.')).not.toBeInTheDocument();
    });

    it('allows price to remain empty as it is optional', () => {
      renderWithProviders(<PublishApi />);
      const priceInput = screen.getByLabelText(/price per call/i);

      fireEvent.focus(priceInput);
      fireEvent.blur(priceInput);
      expect(screen.queryByText('Price per call must be 0 or greater.')).not.toBeInTheDocument();
    });
  });

  describe('Validation - Category validation', () => {
    it('shows category error when blurred without selecting a category', () => {
      renderWithProviders(<PublishApi />);
      const categorySelect = screen.getByLabelText(/category/i);

      fireEvent.focus(categorySelect);
      fireEvent.blur(categorySelect);

      expect(screen.getByText('Please select a category.')).toBeInTheDocument();
      expect(categorySelect).toHaveAttribute('aria-invalid', 'true');
    });

    it('accepts a valid category selection', () => {
      renderWithProviders(<PublishApi />);
      const categorySelect = screen.getByLabelText(/category/i);

      fireEvent.change(categorySelect, { target: { value: 'AI & Machine Learning' } });
      fireEvent.blur(categorySelect);

      expect(screen.queryByText('Please select a category.')).not.toBeInTheDocument();
      expect(categorySelect).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Error visibility lifecycle', () => {
    it('keeps errors hidden before blur', () => {
      renderWithProviders(<PublishApi />);

      const nameInput = screen.getByLabelText(/api name/i);
      const urlInput = screen.getByLabelText(/base url/i);
      const priceInput = screen.getByLabelText(/price per call/i);

      // Typing invalid values into inputs without triggering blur
      fireEvent.change(nameInput, { target: { value: ' ' } });
      fireEvent.change(urlInput, { target: { value: 'http://insecure.com' } });
      fireEvent.change(priceInput, { target: { value: '-10' } });

      // Errors must not be displayed before blur
      expect(screen.queryByText('API name is required.')).not.toBeInTheDocument();
      expect(screen.queryByText('Base URL must use the https scheme.')).not.toBeInTheDocument();
      expect(screen.queryByText('Price per call must be 0 or greater.')).not.toBeInTheDocument();
      expect(screen.queryByText('Please select a category.')).not.toBeInTheDocument();

      expect(nameInput).not.toHaveAttribute('aria-invalid', 'true');
      expect(urlInput).not.toHaveAttribute('aria-invalid', 'true');
      expect(priceInput).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('submitting reveals all field errors', () => {
      renderWithProviders(<PublishApi />);

      const submitButton = screen.getByRole('button', { name: /publish api/i });
      fireEvent.click(submitButton);

      // Required fields are touched on submit and reveal errors
      expect(screen.getByText('API name is required.')).toBeInTheDocument();
      expect(screen.getByText('Base URL is required.')).toBeInTheDocument();
      expect(screen.getByText('Please select a category.')).toBeInTheDocument();

      expect(screen.getByLabelText(/api name/i)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(/base url/i)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(/category/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('submitting with invalid inputs reveals scheme and price errors', () => {
      renderWithProviders(<PublishApi />);

      fireEvent.change(screen.getByLabelText(/api name/i), { target: { value: 'My API' } });
      fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://plain-http.com' } });
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Finance & Payments' } });
      fireEvent.change(screen.getByLabelText(/price per call/i), { target: { value: 'not-a-number' } });

      // Click submit without blurring any fields manually
      fireEvent.click(screen.getByRole('button', { name: /publish api/i }));

      expect(screen.getByText('Base URL must use the https scheme.')).toBeInTheDocument();
      expect(screen.getByText('Price per call must be 0 or greater.')).toBeInTheDocument();
      expect(screen.queryByText('API name is required.')).not.toBeInTheDocument();
      expect(screen.queryByText('Please select a category.')).not.toBeInTheDocument();
    });
  });

  describe('Success screen submission and reset flow', () => {
    it('a valid submission renders the success screen and allows publishing another API', async () => {
      renderWithProviders(<PublishApi />);

      // Fill in all valid fields
      fireEvent.change(screen.getByLabelText(/api name/i), { target: { value: 'GeoCoder Pro API' } });
      fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'https://api.geocoder.example.com' } });
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Mapping & Location' } });
      fireEvent.change(screen.getByLabelText(/price per call/i), { target: { value: '0.002' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'High precision geocoding service.' } });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /publish api/i }));

      // Success screen should be visible
      expect(screen.getByRole('heading', { level: 1, name: /api submitted for review/i })).toBeInTheDocument();
      expect(screen.getByText('GeoCoder Pro API')).toBeInTheDocument();
      expect(screen.getByText(/has been submitted and is pending review/i)).toBeInTheDocument();

      const publishAnotherButton = screen.getByRole('button', { name: /publish another api/i });
      expect(publishAnotherButton).toBeInTheDocument();

      // Click "Publish another API" to verify reset
      fireEvent.click(publishAnotherButton);

      // Form is back to initial state
      expect(screen.getByRole('heading', { level: 1, name: /publish your api/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/api name/i)).toHaveValue('');
      expect(screen.getByLabelText(/base url/i)).toHaveValue('');
      expect(screen.getByLabelText(/category/i)).toHaveValue('');
      expect(screen.getByLabelText(/price per call/i)).toHaveValue('');
    });
  });
});
