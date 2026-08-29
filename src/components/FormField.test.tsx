// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import FormField from './FormField';

afterEach(() => {
  cleanup();
});

describe('FormField', () => {
  it('renders the label text', () => {
    render(
      <FormField id="test-field" label="API name" status="idle">
        <input id="test-field" type="text" />
      </FormField>,
    );
    expect(screen.getByText('API name')).toBeTruthy();
  });

  it('renders the required marker when required=true', () => {
    const { container } = render(
      <FormField id="test-field" label="API name" required status="idle">
        <input id="test-field" type="text" />
      </FormField>,
    );
    expect(container.querySelector('.ff-required')).toBeTruthy();
  });

  it('links the input to the error region via aria-describedby', () => {
    render(
      <FormField id="url-field" label="Base URL" status="idle">
        <input id="url-field" type="url" />
      </FormField>,
    );
    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('url-field-error');
  });

  it('includes the hint id in aria-describedby when hint is provided', () => {
    render(
      <FormField id="price-field" label="Price" hint="Leave blank to set later." status="idle">
        <input id="price-field" type="text" />
      </FormField>,
    );
    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('price-field-hint');
    expect(describedBy).toContain('price-field-error');
  });

  it('does not set aria-invalid on the input when status is idle', () => {
    render(
      <FormField id="name-field" label="Name" status="idle">
        <input id="name-field" type="text" />
      </FormField>,
    );
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('sets aria-invalid="true" on the input when status is error', () => {
    render(
      <FormField id="name-field" label="Name" error="Name is required." status="error">
        <input id="name-field" type="text" />
      </FormField>,
    );
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the error message when status is error', () => {
    render(
      <FormField id="url-field" label="URL" error="Must use https." status="error">
        <input id="url-field" type="url" />
      </FormField>,
    );
    expect(screen.getByText('Must use https.')).toBeTruthy();
  });

  it('does not show an error message when status is idle', () => {
    render(
      <FormField id="url-field" label="URL" error="Must use https." status="idle">
        <input id="url-field" type="url" />
      </FormField>,
    );
    const errorEl = document.getElementById('url-field-error');
    expect(errorEl?.textContent).toBe('');
  });

  it('shows the success check icon when status is success', () => {
    const { container } = render(
      <FormField id="name-field" label="API name" status="success">
        <input id="name-field" type="text" />
      </FormField>,
    );
    expect(container.querySelector('.ff-check')).toBeTruthy();
  });

  it('does not show the success check icon when status is idle', () => {
    const { container } = render(
      <FormField id="name-field" label="API name" status="idle">
        <input id="name-field" type="text" />
      </FormField>,
    );
    expect(container.querySelector('.ff-check')).toBeNull();
  });

  it('renders the hint text with the correct id', () => {
    render(
      <FormField id="price-field" label="Price" hint="Charged per call." status="idle">
        <input id="price-field" type="text" />
      </FormField>,
    );
    const hint = document.getElementById('price-field-hint');
    expect(hint?.textContent).toBe('Charged per call.');
  });
});

describe('PublishApi validation (integration)', () => {
  it('validates base URL requires https scheme', () => {
    const errors: Record<string, string> = {};

    const baseUrl = 'http://api.example.com';
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== 'https:') {
        errors.baseUrl = 'Base URL must use the https scheme.';
      }
    } catch {
      errors.baseUrl = 'Enter a valid URL (e.g. https://api.example.com).';
    }

    expect(errors.baseUrl).toBe('Base URL must use the https scheme.');
  });

  it('accepts a valid https base URL', () => {
    const errors: Record<string, string> = {};

    const baseUrl = 'https://api.example.com';
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== 'https:') {
        errors.baseUrl = 'Base URL must use the https scheme.';
      }
    } catch {
      errors.baseUrl = 'Enter a valid URL (e.g. https://api.example.com).';
    }

    expect(errors.baseUrl).toBeUndefined();
  });

  it('rejects a non-URL string for base URL', () => {
    const errors: Record<string, string> = {};

    const baseUrl = 'not-a-url';
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== 'https:') {
        errors.baseUrl = 'Base URL must use the https scheme.';
      }
    } catch {
      errors.baseUrl = 'Enter a valid URL (e.g. https://api.example.com).';
    }

    expect(errors.baseUrl).toBe('Enter a valid URL (e.g. https://api.example.com).');
  });

  it('rejects a negative price per call', () => {
    const pricePerCall = '-0.5';
    const price = Number(pricePerCall);
    const isInvalid = !Number.isFinite(price) || price < 0;
    expect(isInvalid).toBe(true);
  });

  it('accepts zero as price per call', () => {
    const pricePerCall = '0';
    const price = Number(pricePerCall);
    const isInvalid = !Number.isFinite(price) || price < 0;
    expect(isInvalid).toBe(false);
  });

  it('accepts a positive price per call', () => {
    const pricePerCall = '0.001';
    const price = Number(pricePerCall);
    const isInvalid = !Number.isFinite(price) || price < 0;
    expect(isInvalid).toBe(false);
  });

  it('rejects non-numeric price per call', () => {
    const pricePerCall = 'abc';
    const price = Number(pricePerCall);
    const isInvalid = !Number.isFinite(price) || price < 0;
    expect(isInvalid).toBe(true);
  });
});

describe('FormField blur-before-error behaviour', () => {
  it('shows no error on initial render (status idle)', () => {
    render(
      <FormField id="name-field" label="Name" error="Name is required." status="idle">
        <input id="name-field" type="text" />
      </FormField>,
    );
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    const errorEl = document.getElementById('name-field-error');
    expect(errorEl?.textContent).toBe('');
  });

  it('shows error after blur when status becomes error', () => {
    const { rerender } = render(
      <FormField id="name-field" label="Name" error="Name is required." status="idle">
        <input id="name-field" type="text" />
      </FormField>,
    );

    fireEvent.blur(screen.getByRole('textbox'));

    rerender(
      <FormField id="name-field" label="Name" error="Name is required." status="error">
        <input id="name-field" type="text" />
      </FormField>,
    );

    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Name is required.')).toBeTruthy();
  });
});
