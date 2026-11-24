// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast';
import PublishApi, {
  isPublishFormDraft,
  toPublishPayload,
  toValidationErrors,
  validateForm,
  validateEndpoints,
  type PublishFormState,
} from './PublishApi';
import type { ParsedEndpoint } from '../components/OpenAPIImport';

const { submitPublishApi } = vi.hoisted(() => ({ submitPublishApi: vi.fn() }));

vi.mock('../services/publishApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/publishApi')>();
  return { ...actual, submitPublishApi: (...args: unknown[]) => submitPublishApi(...args) };
});

let mockImportProps: { onImport: (endpoints: ParsedEndpoint[]) => void; onCancel: () => void } | null = null;
vi.mock('../components/OpenAPIImport', () => ({
  default: (props: { onImport: (endpoints: ParsedEndpoint[]) => void; onCancel: () => void }) => {
    mockImportProps = props;
    return (
      <div data-testid="mock-openapi-import">
        <button type="button" onClick={() => props.onImport([])}>Emit zero</button>
        <button type="button" onClick={() => props.onImport([
          { path: '/users', method: 'GET', summary: 'Imported users' },
          { path: '/orders', method: 'POST', summary: 'Create order' },
        ])}>Emit endpoints</button>
      </div>
    );
  },
}));

const DRAFT_KEY = 'callora:publish-api:draft';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/publish']}>
      <ToastProvider>
        <PublishApi />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function validDraft(overrides: Partial<PublishFormState> = {}): PublishFormState {
  return {
    apiName: 'Weather API',
    baseUrl: 'https://api.example.com',
    category: 'Weather & Environment',
    description: 'Forecast data',
    pricePerCall: '0.001',
    endpoints: [{ id: 'ep-existing', path: '/users', method: 'GET', summary: 'Existing users' }],
    ...overrides,
  };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/API name/i), '  Weather API  ');
  await user.type(screen.getByLabelText(/Base URL/i), '  https://api.example.com  ');
  await user.selectOptions(screen.getByLabelText(/Category/i), 'Weather & Environment');
  await user.type(screen.getByLabelText(/^Description/i), 'Forecast data');
  await user.type(screen.getByLabelText(/Price per call/i), '0.001');
}

beforeEach(() => {
  localStorage.clear();
  submitPublishApi.mockReset();
  mockImportProps = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('PublishApi pure validation', () => {
  it('validates required fields and URL scheme', () => {
    const errors = validateForm(validDraft({ apiName: ' ', baseUrl: 'http://example.com', category: '', endpoints: [] }));
    expect(errors.apiName).toBe('API name is required.');
    expect(errors.baseUrl).toBe('Base URL must use the https scheme.');
    expect(errors.category).toBe('Please select a category.');
    expect(errors.endpoints).toContain('Add at least one endpoint');
  });

  it('validates name, description, price and duplicate endpoints', () => {
    const form = validDraft({ description: 'x'.repeat(501), pricePerCall: '-1', endpoints: [
      { id: '1', path: '/x', method: 'GET' },
      { id: '2', path: '/x', method: 'get' },
    ] });
    const errors = validateForm(form);
    expect(errors.description).toContain('500');
    expect(errors.pricePerCall).toBe('Price per call must be 0 or greater.');
    expect(validateEndpoints(form.endpoints)).toContain('unique method and path');
  });

  it('normalises server field names and preserves unmapped messages', () => {
    expect(toValidationErrors({ 'base_url': 'Bad host', 'API.Name': 'Taken', unknown: 'No input' })).toEqual({
      mapped: { baseUrl: 'Bad host', apiName: 'Taken' },
      unmapped: ['No input'],
    });
  });

  it('shapes trimmed submit payload with numeric price and normalised endpoints', () => {
    expect(toPublishPayload(validDraft({ apiName: '  Weather  ', baseUrl: ' https://api.example.com ', description: ' x ', pricePerCall: ' 0.25 ' }))).toEqual({
      apiName: 'Weather',
      baseUrl: 'https://api.example.com',
      category: 'Weather & Environment',
      description: ' x ',
      pricePerCall: 0.25,
      endpoints: [{ path: '/users', method: 'GET', summary: 'Existing users' }],
    });
  });

  it('uses null price for blank price and rejects corrupt draft shapes', () => {
    expect(toPublishPayload(validDraft({ pricePerCall: '' })).pricePerCall).toBeNull();
    expect(isPublishFormDraft(validDraft())).toBe(true);
    expect(isPublishFormDraft({ ...validDraft(), endpoints: 'bad' })).toBe(false);
    expect(isPublishFormDraft(null)).toBe(false);
  });
});

describe('PublishApi validation UI', () => {
  it('shows required errors on blur and submit', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByLabelText(/API name/i));
    await user.tab();
    expect(screen.getByText('API name is required.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Publish API' }));
    expect(screen.getByText('Base URL is required.')).toBeTruthy();
    expect(screen.getByText('Please select a category.')).toBeTruthy();
  });

  it('shows invalid URL, negative price and over-limit description errors', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/Base URL/i), 'http://example.com');
    await user.type(screen.getByLabelText(/Price per call/i), '-1');
    await user.type(screen.getByLabelText(/^Description/i), 'x'.repeat(501));
    await user.click(screen.getByRole('button', { name: 'Publish API' }));
    expect(screen.getByText('Base URL must use the https scheme.')).toBeTruthy();
    expect(screen.getByText('Price per call must be 0 or greater.')).toBeTruthy();
    expect(screen.getByText('Description is over the maximum of 500 characters.')).toBeTruthy();
  });

  it('shows the counter and live announcement near the limit', async () => {
    const user = userEvent.setup();
    renderPage();
    const description = screen.getByLabelText(/^Description/i);
    await user.type(description, 'x'.repeat(451));
    expect(screen.getByText('451 / 500')).toBeTruthy();
    expect(screen.getByText('49 characters remaining')).toBeTruthy();
  });

  it('flags duplicate endpoints and exposes the endpoint error id', async () => {
    const user = userEvent.setup();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft({ endpoints: [
      { id: '1', path: '/x', method: 'GET' },
      { id: '2', path: '/x', method: 'GET' },
    ] })));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Publish API' }));
    const error = document.getElementById('pa-endpoints-error');
    expect(error?.textContent).toContain('Remove the duplicates');
    expect(screen.getAllByText('Duplicate')).toHaveLength(2);
  });
});

describe('PublishApi persistence', () => {
  it('writes typed data and remount restores the draft', async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await user.type(screen.getByLabelText(/API name/i), 'My Draft');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!).apiName).toBe('My Draft'));
    first.unmount();
    renderPage();
    expect(screen.getByLabelText(/API name/i)).toHaveValue('My Draft');
    expect(screen.getByText(/previous draft has been restored/i)).toBeTruthy();
  });

  it('ignores corrupt JSON and invalid draft shapes', () => {
    localStorage.setItem(DRAFT_KEY, 'not json');
    const first = renderPage();
    expect(screen.getByLabelText(/API name/i)).toHaveValue('');
    first.unmount();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ apiName: 42 }));
    renderPage();
    expect(screen.getByLabelText(/API name/i)).toHaveValue('');
  });

  it('clears the draft after successful submit', async () => {
    const user = userEvent.setup();
    submitPublishApi.mockResolvedValue({ kind: 'success', listingId: 'api_1' });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft()));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Publish API' }));
    await screen.findByText('API submitted for review');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('clear draft reset removes the stored copy', async () => {
    const user = userEvent.setup();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft()));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Clear draft' }));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.getByLabelText(/API name/i)).toHaveValue('');
  });
});

describe('PublishApi beforeunload guard', () => {
  it('is prevented only while the form has unsaved changes', async () => {
    const user = userEvent.setup();
    renderPage();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await user.type(screen.getByLabelText(/API name/i), 'Unsaved');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('is removed after reset', async () => {
    const user = userEvent.setup();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft()));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Clear draft' }));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('PublishApi OpenAPI import', () => {
  it('merges endpoints, skips duplicates, and announces counts', async () => {
    const user = userEvent.setup();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft()));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Import spec' }));
    await user.click(screen.getByRole('button', { name: 'Emit endpoints' }));
    expect(screen.getByText('/users')).toBeTruthy();
    expect(screen.getByText('/orders')).toBeTruthy();
    expect(screen.queryAllByText('/users')).toHaveLength(1);
    expect(screen.getByText('1 endpoint imported; 1 duplicate skipped.')).toBeTruthy();
  });

  it('handles zero endpoints with a count message', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Import spec' }));
    await user.click(screen.getByRole('button', { name: 'Emit zero' }));
    expect(screen.getByText('No endpoints found in the specification.')).toBeTruthy();
  });
});

describe('PublishApi submit', () => {
  it('posts the trimmed payload, price and normalised endpoints, then shows success', async () => {
    const user = userEvent.setup();
    submitPublishApi.mockResolvedValue({ kind: 'success', listingId: 'listing_42' });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft({ apiName: '  Weather  ', baseUrl: ' https://api.example.com ', pricePerCall: ' 0.25 ' })));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Publish API' }));
    await screen.findByText('API submitted for review');
    expect(submitPublishApi).toHaveBeenCalledWith(expect.objectContaining({
      apiName: 'Weather', baseUrl: 'https://api.example.com', pricePerCall: 0.25,
      endpoints: [{ path: '/users', method: 'GET', summary: 'Existing users' }],
    }), expect.objectContaining({ idempotencyKey: expect.any(String) }));
  });

  it('maps casing and dotted/snake_case server field errors onto inputs', async () => {
    const user = userEvent.setup();
    submitPublishApi.mockResolvedValue({ kind: 'fieldErrors', fields: { 'base_url': 'Host rejected', 'API.Name': 'Name taken', unknown: 'Unexpected' } });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft()));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Publish API' }));
    expect(await screen.findByText('Host rejected')).toBeTruthy();
    expect(screen.getByText('Name taken')).toBeTruthy();
    expect(screen.getByText(/Unexpected/)).toBeTruthy();
  });

  it('shows a generic server failure and preserves the draft', async () => {
    const user = userEvent.setup();
    submitPublishApi.mockResolvedValue({ kind: 'error', message: 'Service unavailable', retryable: true });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft()));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Publish API' }));
    expect(await screen.findByText('Service unavailable')).toBeTruthy();
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('prevents double submit and exposes loading state', async () => {
    const user = userEvent.setup();
    let resolveSubmit!: (value: unknown) => void;
    submitPublishApi.mockImplementation(() => new Promise((resolve) => { resolveSubmit = resolve; }));
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft()));
    renderPage();
    const form = screen.getByRole('form', { name: 'Publish API form' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(submitPublishApi).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    resolveSubmit({ kind: 'success', listingId: 'api_1' });
    await screen.findByText('API submitted for review');
  });

  it('does not touch state after unmounting mid-submit', async () => {
    let resolveSubmit!: (value: unknown) => void;
    submitPublishApi.mockImplementation(() => new Promise((resolve) => { resolveSubmit = resolve; }));
    localStorage.setItem(DRAFT_KEY, JSON.stringify(validDraft()));
    const view = renderPage();
    fireEvent.submit(screen.getByRole('form', { name: 'Publish API form' }));
    view.unmount();
    resolveSubmit({ kind: 'success', listingId: 'api_1' });
    await Promise.resolve();
  });
});
