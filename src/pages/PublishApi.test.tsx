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

/** Fill every required detail field, leaving the endpoint list untouched. */
function fillValidDetails() {
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

/** Operations to put in an imported spec, keyed by path: `{ '/users': ['get'] }`. */
type SpecPaths = Record<string, string[]>;

/**
 * Add endpoints the way a provider does: open the importer, pick an OpenAPI
 * file, and confirm the preview. fireEvent keeps it usable under fake timers.
 */
async function importEndpoints(paths: SpecPaths) {
  const spec = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: Object.fromEntries(
      Object.entries(paths).map(([path, methods]) => [
        path,
        Object.fromEntries(methods.map((m) => [m, { summary: `${m.toUpperCase()} ${path}` }])),
      ]),
    ),
  };
  const file = new File([JSON.stringify(spec)], 'api.json', { type: 'application/json' });

  fireEvent.click(screen.getByRole('button', { name: /import spec/i }));
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
  // FileReader resolves on a later task; under a loaded full-suite run that
  // can outlast findBy's 1s default.
  fireEvent.click(
    await screen.findByRole('button', { name: /confirm import/i }, { timeout: 5000 }),
  );
}

/** A form that passes client validation: details plus one endpoint. */
async function fillValidForm() {
  fillValidDetails();
  await importEndpoints({ '/forecast': ['get'] });
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
    await fillValidForm();

    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/v1/apis');
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBeTruthy();
  });

  it('sends every field the form collected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    fireEvent.change(screen.getByLabelText(/price per call/i), {
      target: { value: '0.0025' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Forecasts for the next 7 days.' },
    });

    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);

    expect(body).toMatchObject({
      apiName: 'Weather Forecast API',
      baseUrl: 'https://api.example.com',
      category: 'Weather & Environment',
      description: 'Forecasts for the next 7 days.',
      pricePerCall: 0.0025,
      endpoints: [{ path: '/forecast', method: 'GET', summary: 'GET /forecast' }],
    });
  });

  it('sends a null price when the field is left blank', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).pricePerCall).toBeNull();
  });

  it('does not POST when client-side validation fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await userEvent.click(submitButton());

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByText(/submitted for review/i)).not.toBeInTheDocument();
  });

  it('reuses the same idempotency key when an identical submission is retried', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();

    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    expect(fetchImpl.mock.calls[0][1].headers['Idempotency-Key']).toBe(
      fetchImpl.mock.calls[1][1].headers['Idempotency-Key'],
    );
  });

  it('mints a new idempotency key once the payload changes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/api name/i), {
      target: { value: 'A Different API' },
    });
    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    expect(fetchImpl.mock.calls[1][1].headers['Idempotency-Key']).not.toBe(
      fetchImpl.mock.calls[0][1].headers['Idempotency-Key'],
    );
  });
});

describe('PublishApi success screen', () => {
  it('does not render the success screen before the server responds', async () => {
    const { fetchImpl, resolveWith } = deferredResponse();
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    expect(screen.queryByText(/submitted for review/i)).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: /publish api form/i })).toBeInTheDocument();

    await act(async () => {
      resolveWith(jsonResponse(201, { id: 'api_1' }));
    });
  });

  it('renders the success screen only after a 2xx response', async () => {
    const { fetchImpl, resolveWith } = deferredResponse();
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
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
    await fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText('api_xyz')).toBeInTheDocument();
  });

  it('does not show the success screen on a 4xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(screen.queryByText(/submitted for review/i)).not.toBeInTheDocument();
  });

  it('does not show the success screen on a 5xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(screen.queryByText(/submitted for review/i)).not.toBeInTheDocument();
  });

  it('does not show the success screen on a network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
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
    await fillValidForm();
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
    await fillValidForm();
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
    await fillValidForm();
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
    await fillValidForm();
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
    await fillValidForm();
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
    await fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText(/You are not verified to publish\./)).toBeInTheDocument();
  });

  it('shows a form-level error when a 4xx carries no field detail', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(403, { message: 'Publishing is restricted.' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText('Publishing is restricted.')).toBeInTheDocument();
  });

  it('lets the user retry after fixing a server-reported field error', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(422, { errors: { apiName: 'Taken.' } }))
      .mockResolvedValueOnce(jsonResponse(201, { id: 'api_2' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());
    await waitFor(() => expect(errorNodeFor('pa-api-name')).toHaveTextContent('Taken.'));

    fireEvent.change(screen.getByLabelText(/api name/i), {
      target: { value: 'Weather Forecast API v2' },
    });
    await userEvent.click(submitButton());

    expect(await screen.findByText(/submitted for review/i)).toBeInTheDocument();
  });
});

describe('PublishApi session expiry', () => {
  it('shows the session expiry banner on a 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Token expired' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
  });

  it('does not show the success screen after a 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
    expect(screen.queryByText(/submitted for review/i)).not.toBeInTheDocument();
  });

  it('can dismiss the banner', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    await userEvent.click(await screen.findByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument();
  });

  it('keeps the draft after a 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    await screen.findByText(/session has expired/i);
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY) as string).apiName).toBe(
      'Weather Forecast API',
    );
  });
});

describe('PublishApi in-flight state', () => {
  it('disables the submit button while the request is in flight', async () => {
    const { fetchImpl, resolveWith } = deferredResponse();
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    const button = screen.getByRole('button', { name: /submitting/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await act(async () => {
      resolveWith(jsonResponse(201, { id: 'api_1' }));
    });
  });

  it('re-enables the submit button after a failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /publish api/i })).toBeEnabled(),
    );
  });

  it('does not issue a second POST when the button is clicked again in flight', async () => {
    const { fetchImpl, resolveWith } = deferredResponse();
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    const button = screen.getByRole('button', { name: /submitting/i });
    await userEvent.click(button);
    fireEvent.submit(screen.getByRole('form', { name: /publish api form/i }));

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveWith(jsonResponse(201, { id: 'api_1' }));
    });
  });

  it('ignores a duplicate submit dispatched in the same tick', async () => {
    // The button is not disabled until React re-renders, so a double click can
    // deliver two submit events before the first render commits. The in-flight
    // guard must hold even then.
    const { fetchImpl, resolveWith } = deferredResponse();
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();

    const form = screen.getByRole('form', { name: /publish api form/i });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveWith(jsonResponse(201, { id: 'api_1' }));
    });
  });

  it('recovers the form when the request times out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      // Never settles on its own; only the timeout budget ends it.
      const fetchImpl = vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      vi.stubGlobal('fetch', fetchImpl);

      render(<PublishApi />);
      await fillValidForm();
      await user.click(submitButton());

      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });

      expect(screen.getByText(/timed out/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /publish api/i })).toBeEnabled();
      expect(screen.queryByText(/submitted for review/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('PublishApi draft persistence', () => {
  it('persists the draft as the provider types', () => {
    render(<PublishApi />);
    fireEvent.change(screen.getByLabelText(/api name/i), {
      target: { value: 'Weather Forecast API' },
    });

    expect(JSON.parse(localStorage.getItem(DRAFT_KEY) as string).apiName).toBe(
      'Weather Forecast API',
    );
  });

  it('restores a stored draft on mount', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        apiName: 'Restored API',
        baseUrl: 'https://restored.example.com',
        category: 'Security',
        description: 'From a previous session.',
        pricePerCall: '0.5',
        endpoints: [{ id: 'ep-1', path: '/ping', method: 'GET' }],
      }),
    );

    render(<PublishApi />);

    expect(screen.getByLabelText(/api name/i)).toHaveValue('Restored API');
    expect(screen.getByLabelText(/base url/i)).toHaveValue('https://restored.example.com');
    expect(screen.getByLabelText(/category/i)).toHaveValue('Security');
  });

  it('keeps the draft restorable after a failed submission', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchImpl);

    const first = render(<PublishApi />);
    await fillValidForm();
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Half-written listing.' },
    });

    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(await screen.findByText(/unavailable right now/i)).toBeInTheDocument();

    first.unmount();
    render(<PublishApi />);

    expect(screen.getByLabelText(/api name/i)).toHaveValue('Weather Forecast API');
    expect(screen.getByLabelText(/base url/i)).toHaveValue('https://api.example.com');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Half-written listing.');
  });

  it('keeps the draft restorable after a rejected submission', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422, { errors: { apiName: 'Taken.' } }));
    vi.stubGlobal('fetch', fetchImpl);

    const first = render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    first.unmount();
    render(<PublishApi />);

    expect(screen.getByLabelText(/api name/i)).toHaveValue('Weather Forecast API');
  });

  it('ignores a draft written with an unrecognised shape', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ legacy: 'shape' }));

    render(<PublishApi />);

    expect(screen.getByLabelText(/api name/i)).toHaveValue('');
  });

  it('ignores a corrupt draft', () => {
    localStorage.setItem(DRAFT_KEY, '{ broken json');

    render(<PublishApi />);

    expect(screen.getByLabelText(/api name/i)).toHaveValue('');
  });

  it('clears the draft once the server confirms', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());

    await screen.findByText(/submitted for review/i);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('starts a clean form after publishing another API', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    await fillValidForm();
    await userEvent.click(submitButton());
    await screen.findByText(/submitted for review/i);

    await userEvent.click(screen.getByRole('button', { name: /publish another api/i }));

    expect(screen.getByLabelText(/api name/i)).toHaveValue('');
    expect(screen.getByLabelText(/base url/i)).toHaveValue('');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe('PublishApi endpoint validation (#1076)', () => {
  const ENDPOINTS_ERROR_ID = 'pa-endpoints-error';

  function endpointsGroup() {
    return screen.getByRole('group', { name: /endpoints/i });
  }

  function endpointsErrorNode() {
    return document.getElementById(ENDPOINTS_ERROR_ID);
  }

  /** Rows of the endpoint list, as the text each one reads out. */
  function endpointRows() {
    return screen.queryAllByRole('listitem').filter((li) => li.closest('.pa-endpoint-list'));
  }

  function flaggedRows() {
    return endpointRows().filter((li) => li.textContent?.includes('Duplicate'));
  }

  function seedDraftWithEndpoints(endpoints: { id: string; method: string; path: string }[]) {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        apiName: 'Weather Forecast API',
        baseUrl: 'https://api.example.com',
        category: 'Weather & Environment',
        description: '',
        pricePerCall: '',
        endpoints,
      }),
    );
  }

  it('rejects a submission with zero endpoints and never POSTs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidDetails();
    await userEvent.click(submitButton());

    expect(endpointsErrorNode()).toHaveTextContent(/add at least one endpoint/i);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByText(/submitted for review/i)).not.toBeInTheDocument();
  });

  it('does not show the endpoint error before a submit', () => {
    render(<PublishApi />);
    fillValidDetails();

    expect(endpointsErrorNode()).toHaveTextContent('');
  });

  it('associates the endpoint error with the endpoint list', async () => {
    render(<PublishApi />);
    fillValidDetails();
    await userEvent.click(submitButton());

    const group = endpointsGroup();
    expect(group).toHaveAttribute('aria-describedby', ENDPOINTS_ERROR_ID);
    expect(group).toHaveAccessibleDescription(/add at least one endpoint/i);
  });

  it('moves focus to the endpoint list when it is the only problem', async () => {
    render(<PublishApi />);
    fillValidDetails();
    await userEvent.click(submitButton());

    await waitFor(() => expect(endpointsGroup()).toHaveFocus());
  });

  it('leaves focus alone when an earlier field is also invalid', async () => {
    render(<PublishApi />);
    // API name left blank: that error comes first on the page.
    fireEvent.change(screen.getByLabelText(/base url/i), {
      target: { value: 'https://api.example.com' },
    });
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: 'Weather & Environment' },
    });
    await userEvent.click(submitButton());

    expect(endpointsErrorNode()).toHaveTextContent(/add at least one endpoint/i);
    expect(endpointsGroup()).not.toHaveFocus();
  });

  it('clears the empty-list error once an endpoint is added', async () => {
    render(<PublishApi />);
    fillValidDetails();
    await userEvent.click(submitButton());
    expect(endpointsErrorNode()).toHaveTextContent(/add at least one endpoint/i);

    await importEndpoints({ '/forecast': ['get'] });

    await waitFor(() => expect(endpointsErrorNode()).toHaveTextContent(''));
  });

  it('flags every row of a duplicated METHOD + path and blocks the POST', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidDetails();
    // Importing twice is how a provider ends up with a repeated operation.
    await importEndpoints({ '/users': ['get', 'post'] });
    await importEndpoints({ '/users': ['get'] });
    await userEvent.click(submitButton());

    const flagged = flaggedRows();
    expect(flagged).toHaveLength(2);
    flagged.forEach((row) => {
      expect(row).toHaveTextContent('GET');
      expect(row).toHaveTextContent('/users');
    });
    const postRow = endpointRows().find((row) => row.textContent?.includes('POST'));
    expect(postRow).not.toHaveTextContent('Duplicate');

    expect(endpointsErrorNode()).toHaveTextContent('GET /users (2×)');
    expect(fetchImpl).not.toHaveBeenCalled();
    await waitFor(() => expect(endpointsGroup()).toHaveFocus());
  });

  it('allows the same path under different methods, and distinct paths', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);

    render(<PublishApi />);
    fillValidDetails();
    await importEndpoints({ '/users': ['get', 'post'], '/users/{id}': ['get'] });
    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.endpoints.map((ep: { method: string; path: string }) => `${ep.method} ${ep.path}`)).toEqual([
      'GET /users',
      'POST /users',
      'GET /users/{id}',
    ]);
  });

  it('treats a lowercase method from an older draft as the same endpoint', async () => {
    seedDraftWithEndpoints([
      { id: 'ep-a', method: 'get', path: '/users' },
      { id: 'ep-b', method: 'GET', path: '/users' },
    ]);

    render(<PublishApi />);
    await userEvent.click(submitButton());

    expect(flaggedRows()).toHaveLength(2);
  });

  it('clears the duplicate flags as the duplicates are removed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'api_1' }));
    vi.stubGlobal('fetch', fetchImpl);
    seedDraftWithEndpoints([
      { id: 'ep-a', method: 'GET', path: '/users' },
      { id: 'ep-b', method: 'GET', path: '/users' },
      { id: 'ep-c', method: 'GET', path: '/users' },
      { id: 'ep-d', method: 'POST', path: '/users' },
    ]);

    render(<PublishApi />);
    await userEvent.click(submitButton());
    // All three copies are flagged, not just the later ones.
    expect(flaggedRows()).toHaveLength(3);
    expect(endpointsErrorNode()).toHaveTextContent('GET /users (3×)');

    const removeGet = () =>
      screen.getAllByRole('button', { name: 'Remove endpoint GET /users' })[0];

    await userEvent.click(removeGet());
    expect(flaggedRows()).toHaveLength(2);

    await userEvent.click(removeGet());
    expect(flaggedRows()).toHaveLength(0);
    expect(endpointsErrorNode()).toHaveTextContent('');

    await userEvent.click(submitButton());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
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

    expect(counterNode()?.textContent).toMatch(/0 \/ 500/);

    fireEvent.change(descriptionInput(), {
      target: { value: 'Hello' },
    });

    expect(counterNode()?.textContent).toMatch(/5 \/ 500/);
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
    await fillValidForm();
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
    await fillValidForm();
    fireEvent.change(descriptionInput(), {
      target: { value: 'x'.repeat(MAX_DESCRIPTION_LENGTH) },
    });

    await userEvent.click(submitButton());

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(errorNodeFor('pa-description')).toHaveTextContent('');
  });

  it('announces the remaining count only when under 50 characters remain', () => {
    render(<PublishApi />);

    fireEvent.change(descriptionInput(), {
      target: { value: 'x'.repeat(451) },
    });

    const liveRegion = document.getElementById('pa-description-counter-live');
    expect(liveRegion).toBeDefined();
    expect(liveRegion!.textContent).toMatch(/49/);
  });

  it('does not announce while more than 50 characters remain', () => {
    render(<PublishApi />);

    fireEvent.change(descriptionInput(), {
      target: { value: 'x'.repeat(100) },
    });

    const liveRegion = document.getElementById('pa-description-counter-live');
    expect(liveRegion).toBeDefined();
    expect(liveRegion!.textContent).toBe('');
  });
});
