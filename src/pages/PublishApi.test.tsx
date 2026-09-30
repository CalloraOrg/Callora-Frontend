import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublishApi from './PublishApi';
import { resetSessionExpiryForTests } from '../services/sessionExpiry';

const DRAFT_KEY = 'callora:publish-api:draft';

function jsonResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** A response whose promise the test controls, to observe the in-flight state. */
function deferredResponse() {
  let resolveWith: (value: Response) => void = () => {};
  const promise = new Promise<Response>((resolve) => {
    resolveWith = resolve;
  });
  const fetchImpl = vi.fn().mockReturnValue(promise);
  return { fetchImpl, resolveWith };
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/api name/i), {
    target: { value: 'Weather Forecast API' },
  });
  fireEvent.change(screen.getByLabelText(/base url/i), {
    target: { value: 'https://api.example.com' },
  });
  fireEvent.change(screen.getByLabelText(/category/i), {
    target: { value: 'Weather & Environment' },
  });
}

/** The always-present error paragraph rendered by FormField for a field. */
function errorNodeFor(fieldId: string) {
  return document.getElementById(`${fieldId}-error`);
}

function submitButton() {
  return screen.getByRole('button', { name: /publish api/i });
}

beforeEach(() => {
  localStorage.clear();
  resetSessionExpiryForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSessionExpiryForTests();
});

describe('PublishApi submission', () => {
  it('issues exactly one POST carrying an Idempotency-Key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();

    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    const [url, init] = fetchImpl.mockResults.calls[0];
    expect(url).toContain('/v1/apis');
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBeTruthy();
  });

  it('sends every field the form collected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/price per call/i), {
      target: { value: '0.0025' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Forecasts for the next 7 days.' },
    });

    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchImpl.mockResults[0][1].body);

    expect(body).toMatchObject({
      apiName: 'Weather Forecast API',
      baseUrl: 'https://api.example.com',
      category: 'Weather & Environment',
      description: 'Forecasts for the next 7 days.',
      pricePerCall: 0.0025,
      endpoints: [],
    });
  });

  it('sends a null price when the field is left blank', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchImpl.mockResults[0][1].body).pricePerCall).toBeNull();
  });

  it('does not POST when client-side validation fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await userEvent.click(submitButton());

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByText(/submitted for review/i)).not.toBeInDocument();
  });

  it('reuses the same idempotency key when an identical submission is retried', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();

    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    expect(fetchImpl.mockResults[0][1].headers['Idempotency-Key']).toBe(
      fetchImpl.mockResults[1][1].headers['Idempotency-Key'],
    );
  });

  it('mints a new idempotency key once the payload changes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/api name/i), {
      target: { value: 'A Different API' },
    });
    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    expect(fetchImpl.mockResults[1][1].headers['Idempotency-Key']).not.toBe(
      fetchImpl.mockResults[0][1].headers['Idempotency-Key'],
    );
  });
});

describe('PublishApi success screen', () => {
  it('does not render the success screen before the server responds', async () => {
    const { fetchImpl, resolveWith } = deferredResponse();
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    expect(screen.queryByText(/submitted for review/i)).not.toBeInDocument();
    expect(screen.getByRole('form', { name: /publish api form/i })).toBeInTheDocument();

    await act(async () => {
      resolveWith(jsonResponse(201, { id: 'api_1' }));
    });
  });

  it('renders the success screen only after a 2xx response', async () => {
    const { fetchImpl, resolveWith } = deferredResponse();
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    await act(async () => {
      resolveWith(jsonResponse(201, { id: 'api_1' }));
    });

    expect(await screen.findByText(/submitted for review/i)).toBeInTheDocument();
    expect(screen.getByText(/Weather Forecast API/)).toBeInTheDocument();
  });

  it('shows the listing reference returned by the server', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_xyz' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText('api_xyz')).toBeInTheDocument();
  });

  it('does not show the success screen on a 4xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(screen.queryByText(/submitted for review/i)).not.toBeInDocument();
  });

  it('does not show the success screen on a 5xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(screen.queryByText(/submitted for review/i)).not.toBeInDocument();
  });

  it('does not show the success screen on a network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
    expect(screen.queryByText(/submitted for review/i)).not.toBeInTheDocument();
  });
});

describe('PublishApi server field errors', () => {
  it('shows a 422 field error under the matching input', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { errors: { apiName: 'That name is already taken.' } }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    const errorNode = await waitFor(() => {
      const node = errorNodeFor('pa-api-name');
      expect(node).toHaveTextContent('That name is already taken.');
      return node;
    });
    expect(errorNode).toBeVisible();
    expect(screen.getByLabelText(/api name/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('associates the server message with the input for screen readers', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { errors: { baseUrl: 'Base URL is unreachable.' } }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    const input = screen.getByLabelText(/base url/i);
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(input.getAttribute('aria-describedby')).toContain('pa-base-url-error');
    expect(errorNodeFor('pa-base-url')).toHaveTextContent('Base URL is unreachable.');
  });

  it('maps a snake_case server field onto the matching input', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { errors: { base_url: 'Unreachable host.' } }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(errorNodeFor('pa-base-url')).toHaveTextContent('Unreachable host.'),
    );
  });

  it('keeps unrelated fields free of the server message', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { errors: { apiName: 'Taken.' } }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() => expect(errorNodeFor('pa-api-name')).toHaveTextContent('Taken.'));
    expect(errorNodeFor('pa-base-url')).toHaveTextContent('');
    expect(errorNodeFor('pa-category')).toHaveTextContent('');
  });

  it('clears the server message once the field is edited', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { errors: { apiName: 'That name is already taken.' } }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(errorNodeFor('pa-api-name')).toHaveTextContent('That name is already taken.'),
    );

    fireEvent.change(screen.getByLabelText(/api name/i), {
      target: { value: 'A Brand New Name' },
    });

    await waitFor(() => expect(errorNodeFor('pa-api-name')).toHaveTextContent(''));
  });

  it('surfaces a message for a field the form does not render', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(422, { errors: { organisation: 'You are not verified to publish.' } }),
    );
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText(/You are not verified to publish\./)).toBeInTheDocument();
  });

  it('shows a form-level error when a 4xx carries no field detail', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(403, { message: 'Publishing is restricted.' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText(/Publishing is restricted./)).toBeInTheDocument();
  });
});

describe('PublishApi description length', () => {
  const MAX_DESCRIPTION_LENGTH = 500;

  function descriptionInput() {
    return screen.getByLabelText(/description/i);
  }

  function counterNode() {
    return document.getElementById('pa-description-counter');
  }

  it('shows a live character counter that updates as the user types', () => {
    render(<PublishApi />);

    expect(counterNode()).textContent().to.match(/0 \/ 500/);

    fireEvent.change(descriptionInput(), {
      target: { value: 'Hello' },
    });

    expect(counterNode()).textContent().to.match(/5 \/ 500/);
  });

  it('references the counter via aria-describedby', () => {
    render(<PublishApi />);

    const input = descriptionInput();
    expect(input.getAttribute('aria-describedby')).toContain('pa-description-counter');
  });

  it('shows a validation error when the description exceeds the limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    fireEvent.change(descriptionInput(), {
      target: { value: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1) },
    });

    await userEvent.click(submitButton());

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(errorNodeFor('pa-description')).toHaveTextContent(/maximum/i);
    expect(descriptionInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not show a validation error at the limit boundary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidForm();
    fireEvent.change(descriptionInput(), {
      target: { value: 'x'.repeat(MAX_DESCRIPTION_LENGTH) },
    });

    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled(1));
    expect(errorNodeFor('pa-description')).toHaveTextContent('');
  });

  it('announces the remaining count only when under 50 characters remain', () == {
    render(<PublishApi />);

    fireEvent.change(descriptionInput(), {
      target: { value: 'x'.repeat(451) },
    });

    const liveRegion = document.getElementById('pa-description-counter-live');
    expect(liveRegion).toBeDefined();
    expect(liveRegion!).textContent().to.match(/49/);
  });

  it('does not announce while more than 50 characters remain', () => {
    render(<PublishApi />);

    fireEvent.change(descriptionInput(), {
      target: { value: 'x'.repeat(100) },
    });

    const liveRegion = document.getElementById('pa-description-counter-live');
    expect(liveRegion).toBeDefined();
    expect(liveRegion!).textContent().to.Be('');
  });
});
