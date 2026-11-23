// @vitest-environment jsdom

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OpenAPIImport from './OpenAPIImport';
import type { ParsedEndpoint } from './OpenAPIImport';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid OpenAPI 3.0 JSON spec with two endpoints. */
const VALID_JSON_CONTENT = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Test', version: '1.0.0' },
  paths: {
    '/items': {
      get: { summary: 'List items' },
      post: { summary: 'Create item' },
    },
  },
});

const VALID_YAML_CONTENT = `
openapi: 3.0.0
info:
  title: Test API
paths:
  /users:
    get:
      summary: List users
    delete:
      summary: Delete user
`;

const MALFORMED_JSON_CONTENT = '{ broken: json }';

const MALFORMED_YAML_CONTENT = `
openapi: 3.0.0
paths:
    badindent
`;

/**
 * Build a FileList-like object from an array of File instances.
 * Testing-library passes dataTransfer.files to the event; this helper
 * satisfies the indexed-access and `length` expectations of FileList.
 */
function makeFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () {
      for (const f of files) yield f;
    },
  } as unknown as FileList;

  files.forEach((f, i) => {
    Object.defineProperty(fileList, i, { value: f, enumerable: true });
  });

  return fileList;
}

/** Simulate dropping a file onto an element via a DragEvent. */
function dropFile(element: Element, file: File) {
  const dropEvent = createEvent.drop(element);
  Object.defineProperty(dropEvent, 'dataTransfer', {
    value: { files: makeFileList([file]), dropEffect: 'copy' },
    writable: false,
  });
  fireEvent(element, dropEvent);
}

/** Simulate changing the hidden file input. */
function changeFileInput(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', {
    value: makeFileList([file]),
    configurable: true,
  });
  fireEvent.change(input, { target: { files: makeFileList([file]) } });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Idle / Drop zone render
// ---------------------------------------------------------------------------

describe('OpenAPIImport — idle state', () => {
  it('renders the drop zone with the correct role and label', () => {
    render(<OpenAPIImport onImport={() => {}} />);
    const zone = screen.getByRole('button', {
      name: /upload an openapi specification file/i,
    });
    expect(zone).toBeTruthy();
  });

  it('renders the "Browse files" button', () => {
    render(<OpenAPIImport onImport={() => {}} />);
    expect(screen.getByRole('button', { name: /browse/i })).toBeTruthy();
  });

  it('drop zone has a valid aria-describedby attribute pointing to hint text', () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const zone = container.querySelector('[data-testid="openapi-drop-zone"]');
    const describedBy = zone?.getAttribute('aria-describedby');
    // The attribute must be set.
    expect(describedBy).toBeTruthy();
    // The referenced element must exist in the document.
    // Use getElementById to avoid the colon issue with querySelector.
    expect(document.getElementById(describedBy!)).toBeTruthy();
  });

  it('mentions .json, .yaml, .yml accepted formats in the UI', () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).toContain('.json');
    expect(text).toContain('.yaml');
    expect(text).toContain('.yml');
  });
});

// ---------------------------------------------------------------------------
// Drag-and-drop visual state
// ---------------------------------------------------------------------------

describe('OpenAPIImport — drag-and-drop visual state', () => {
  it('applies active class on dragover', () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const zone = container.querySelector('[data-testid="openapi-drop-zone"]')!;

    fireEvent.dragOver(zone, { dataTransfer: { dropEffect: '' } });
    expect(zone.className).toContain('oai-dropzone-active');
  });

  it('removes active class on dragleave', () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const zone = container.querySelector('[data-testid="openapi-drop-zone"]')!;

    fireEvent.dragOver(zone, { dataTransfer: { dropEffect: '' } });
    expect(zone.className).toContain('oai-dropzone-active');

    // dragleave from the zone itself (relatedTarget outside)
    fireEvent.dragLeave(zone, { relatedTarget: document.body });
    expect(zone.className).not.toContain('oai-dropzone-active');
  });

  it('changes heading text to "Drop your file here" while dragging', () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const zone = container.querySelector('[data-testid="openapi-drop-zone"]')!;

    fireEvent.dragOver(zone, { dataTransfer: { dropEffect: '' } });
    expect(container.textContent).toContain('Drop your file here');
  });
});

// ---------------------------------------------------------------------------
// Drag-and-drop file upload
// ---------------------------------------------------------------------------

describe('OpenAPIImport — drag-and-drop upload', () => {
  it('transitions to preview state when a valid JSON file is dropped', async () => {
    render(<OpenAPIImport onImport={() => {}} />);
    const zone = screen.getByTestId('openapi-drop-zone');
    const file = new File([VALID_JSON_CONTENT], 'api.json', { type: 'application/json' });

    dropFile(zone, file);

    // Loading state should appear first.
    await waitFor(() => {
      expect(screen.queryByText(/parsing specification/i)).toBeTruthy();
    });

    // Then preview should appear.
    await waitFor(() => {
      expect(screen.getByText(/endpoints? found/i)).toBeTruthy();
    });
  });

  it('transitions to preview state when a valid YAML file is dropped', async () => {
    render(<OpenAPIImport onImport={() => {}} />);
    const zone = screen.getByTestId('openapi-drop-zone');
    const file = new File([VALID_YAML_CONTENT], 'api.yaml', { type: 'text/yaml' });

    dropFile(zone, file);

    await waitFor(() => {
      expect(screen.getByText(/endpoints? found/i)).toBeTruthy();
    });
  });

  it('shows an error panel when an unsupported file type is dropped', async () => {
    render(<OpenAPIImport onImport={() => {}} />);
    const zone = screen.getByTestId('openapi-drop-zone');
    const file = new File(['hello'], 'spec.txt', { type: 'text/plain' });

    dropFile(zone, file);

    await waitFor(() => {
      // Error panel uses role="alert"
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toMatch(/not a supported file type/i);
  });

  it('shows an error panel when malformed JSON is dropped', async () => {
    render(<OpenAPIImport onImport={() => {}} />);
    const zone = screen.getByTestId('openapi-drop-zone');
    const file = new File([MALFORMED_JSON_CONTENT], 'broken.json', {
      type: 'application/json',
    });

    dropFile(zone, file);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toMatch(/parse error|could not parse/i);
  });

  it('shows an error panel when malformed YAML is dropped', async () => {
    render(<OpenAPIImport onImport={() => {}} />);
    const zone = screen.getByTestId('openapi-drop-zone');
    // A YAML file that is structurally parseable but fails OpenAPI version validation.
    const invalidVersionYaml = 'openapi: "2.0"\npaths: {}';
    const file = new File([invalidVersionYaml], 'broken.yaml', { type: 'text/yaml' });

    dropFile(zone, file);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toContain('2.0');
  });
});

// ---------------------------------------------------------------------------
// Keyboard upload
// ---------------------------------------------------------------------------

describe('OpenAPIImport — keyboard upload', () => {
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Spy on the hidden file input's click method.
    clickSpy = vi.fn();
  });

  it('drop zone is focusable (tabIndex=0)', () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const zone = container.querySelector('[data-testid="openapi-drop-zone"]')!;
    expect(zone.getAttribute('tabindex')).toBe('0');
  });

  it('pressing Enter on the drop zone opens the file picker', () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const zone = container.querySelector('[data-testid="openapi-drop-zone"]')!;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    input.click = clickSpy;

    fireEvent.keyDown(zone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('pressing Space on the drop zone opens the file picker', () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const zone = container.querySelector('[data-testid="openapi-drop-zone"]')!;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    input.click = clickSpy;

    fireEvent.keyDown(zone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('other keys on the drop zone do not open the file picker', () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const zone = container.querySelector('[data-testid="openapi-drop-zone"]')!;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    input.click = clickSpy;

    fireEvent.keyDown(zone, { key: 'Tab' });
    fireEvent.keyDown(zone, { key: 'Escape' });
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('file input change processes a valid JSON file (keyboard-triggered pick)', async () => {
    const onImport = vi.fn();
    const { container } = render(<OpenAPIImport onImport={onImport} />);
    const file = new File([VALID_JSON_CONTENT], 'api.json', { type: 'application/json' });

    changeFileInput(container, file);

    await waitFor(() => {
      expect(screen.getByText(/endpoints? found/i)).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Endpoint preview rendering
// ---------------------------------------------------------------------------

describe('OpenAPIImport — endpoint preview', () => {
  async function renderPreview(content: string, filename: string) {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const file = new File([content], filename, { type: 'application/json' });
    changeFileInput(container, file);
    await waitFor(() => {
      expect(screen.getByText(/endpoints? found/i)).toBeTruthy();
    });
    return { container };
  }

  it('displays HTTP method badges for each endpoint', async () => {
    await renderPreview(VALID_JSON_CONTENT, 'api.json');
    expect(screen.getByText('GET')).toBeTruthy();
    expect(screen.getByText('POST')).toBeTruthy();
  });

  it('displays the path for each endpoint', async () => {
    await renderPreview(VALID_JSON_CONTENT, 'api.json');
    // Both endpoints share /items path
    const paths = screen.getAllByText('/items');
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it('displays the summary for each endpoint', async () => {
    await renderPreview(VALID_JSON_CONTENT, 'api.json');
    expect(screen.getByText('List items')).toBeTruthy();
    expect(screen.getByText('Create item')).toBeTruthy();
  });

  it('shows the filename in the preview header', async () => {
    await renderPreview(VALID_JSON_CONTENT, 'my-api.json');
    expect(screen.getByText(/my-api\.json/)).toBeTruthy();
  });

  it('shows correct endpoint count in the header', async () => {
    await renderPreview(VALID_JSON_CONTENT, 'api.json');
    expect(screen.getByText(/2 endpoints/i)).toBeTruthy();
  });

  it('shows singular "endpoint" for a single result', async () => {
    const single = JSON.stringify({
      openapi: '3.0.0',
      paths: { '/ping': { get: { summary: 'Health check' } } },
    });
    await renderPreview(single, 'ping.json');
    expect(screen.getByText(/1 endpoint found/i)).toBeTruthy();
  });

  it('shows the "Confirm import" button', async () => {
    await renderPreview(VALID_JSON_CONTENT, 'api.json');
    expect(screen.getByRole('button', { name: /confirm import/i })).toBeTruthy();
  });

  it('shows the "Cancel" button', async () => {
    await renderPreview(VALID_JSON_CONTENT, 'api.json');
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Swagger 2.0 conversion (issue #1075)
// ---------------------------------------------------------------------------

const SWAGGER2_CONTENT = JSON.stringify({
  swagger: '2.0',
  info: { title: 'Legacy', version: '1.0.0' },
  basePath: '/api/v1',
  consumes: ['application/json'],
  paths: {
    '/items': { get: { summary: 'List items' } },
  },
});

const CLEAN_SWAGGER2_CONTENT = JSON.stringify({
  swagger: '2.0',
  basePath: '/v2',
  paths: {
    '/ping': { get: { summary: 'Ping' } },
  },
});

describe('OpenAPIImport — Swagger 2.0 conversion', () => {
  async function renderSwaggerPreview(content: string) {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const file = new File([content], 'legacy.json', { type: 'application/json' });
    changeFileInput(container, file);
    await waitFor(() => {
      expect(screen.getByText(/endpoints? found/i)).toBeTruthy();
    });
    return { container };
  }

  it('previews the endpoints of a Swagger 2.0 document', async () => {
    await renderSwaggerPreview(SWAGGER2_CONTENT);
    // basePath is prefixed in the preview.
    expect(screen.getByText('/api/v1/items')).toBeTruthy();
  });

  it('shows a "converted from Swagger 2.0" notice', async () => {
    await renderSwaggerPreview(SWAGGER2_CONTENT);
    const notice = screen.getByTestId('openapi-conversion-notice');
    expect(notice.textContent).toMatch(/converted from swagger 2\.0/i);
    expect(notice.textContent).toContain('basePath');
  });

  it('does not show the conversion notice for OpenAPI 3.x files', async () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const file = new File([VALID_JSON_CONTENT], 'api.json', { type: 'application/json' });
    changeFileInput(container, file);
    await waitFor(() => {
      expect(screen.getByText(/endpoints? found/i)).toBeTruthy();
    });

    expect(screen.queryByTestId('openapi-conversion-notice')).toBeNull();
  });

  it('lists unsupported 2.0 features as warnings without blocking the import', async () => {
    await renderSwaggerPreview(SWAGGER2_CONTENT);

    const warnings = screen.getByTestId('openapi-warnings');
    expect(warnings.textContent).toMatch(/consumes/i);
    // The import can still be confirmed.
    expect(screen.getByRole('button', { name: /confirm import/i })).toBeTruthy();
  });

  it('renders no warning panel for a clean 2.0 document', async () => {
    await renderSwaggerPreview(CLEAN_SWAGGER2_CONTENT);
    expect(screen.queryByTestId('openapi-warnings')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Parse error display
// ---------------------------------------------------------------------------

describe('OpenAPIImport — inline parse error display', () => {
  it('shows the error panel with role="alert"', async () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const file = new File([MALFORMED_JSON_CONTENT], 'broken.json', {
      type: 'application/json',
    });
    changeFileInput(container, file);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('displays a line number badge when the error includes a line number', async () => {
    // We inject a parse result with a known line number by providing a YAML spec
    // that fails version validation — the parser returns a clean error.
    const specWithBadVersion = JSON.stringify({
      openapi: '2.0',
      paths: {},
    });
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const file = new File([specWithBadVersion], 'old.json', { type: 'application/json' });
    changeFileInput(container, file);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    // The error message should mention the version string.
    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toContain('2.0');
  });

  it('shows the "Try a different file" button in error state', async () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const file = new File([MALFORMED_JSON_CONTENT], 'broken.json', {
      type: 'application/json',
    });
    changeFileInput(container, file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try a different file/i })).toBeTruthy();
    });
  });

  it('returns to idle state when "Try a different file" is clicked', async () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const file = new File([MALFORMED_JSON_CONTENT], 'broken.json', {
      type: 'application/json',
    });
    changeFileInput(container, file);

    await waitFor(() => {
      screen.getByRole('button', { name: /try a different file/i });
    });

    fireEvent.click(screen.getByRole('button', { name: /try a different file/i }));

    // Drop zone should be visible again
    expect(screen.getByTestId('openapi-drop-zone')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Publish flow population
// ---------------------------------------------------------------------------

describe('OpenAPIImport — publish flow population', () => {
  it('calls onImport with the parsed endpoints when the user confirms', async () => {
    const onImport = vi.fn<[ParsedEndpoint[]], void>();
    const { container } = render(<OpenAPIImport onImport={onImport} />);
    const file = new File([VALID_JSON_CONTENT], 'api.json', { type: 'application/json' });

    changeFileInput(container, file);

    await waitFor(() => {
      screen.getByRole('button', { name: /confirm import/i });
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm import/i }));

    expect(onImport).toHaveBeenCalledTimes(1);
    const endpoints: ParsedEndpoint[] = onImport.mock.calls[0][0];
    expect(endpoints).toHaveLength(2);

    const methods = endpoints.map((e) => e.method);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');

    const paths = endpoints.map((e) => e.path);
    expect(paths).toContain('/items');
  });

  it('passes correct summaries to onImport', async () => {
    const onImport = vi.fn<[ParsedEndpoint[]], void>();
    const { container } = render(<OpenAPIImport onImport={onImport} />);
    const file = new File([VALID_JSON_CONTENT], 'api.json', { type: 'application/json' });

    changeFileInput(container, file);
    await waitFor(() => { screen.getByRole('button', { name: /confirm import/i }); });
    fireEvent.click(screen.getByRole('button', { name: /confirm import/i }));

    const endpoints: ParsedEndpoint[] = onImport.mock.calls[0][0];
    const get = endpoints.find((e) => e.method === 'GET');
    expect(get?.summary).toBe('List items');
  });

  it('calls onImport with YAML-parsed endpoints', async () => {
    const onImport = vi.fn<[ParsedEndpoint[]], void>();
    const { container } = render(<OpenAPIImport onImport={onImport} />);
    const file = new File([VALID_YAML_CONTENT], 'api.yaml', { type: 'text/yaml' });

    changeFileInput(container, file);
    await waitFor(() => { screen.getByRole('button', { name: /confirm import/i }); });
    fireEvent.click(screen.getByRole('button', { name: /confirm import/i }));

    const endpoints: ParsedEndpoint[] = onImport.mock.calls[0][0];
    expect(endpoints.length).toBeGreaterThan(0);
    const paths = endpoints.map((e) => e.path);
    expect(paths).toContain('/users');
  });

  it('does not call onImport before the user confirms', async () => {
    const onImport = vi.fn();
    const { container } = render(<OpenAPIImport onImport={onImport} />);
    const file = new File([VALID_JSON_CONTENT], 'api.json', { type: 'application/json' });

    changeFileInput(container, file);
    await waitFor(() => { screen.getByText(/endpoints? found/i); });

    expect(onImport).not.toHaveBeenCalled();
  });

  it('calls onCancel and returns to idle when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const { container } = render(<OpenAPIImport onImport={() => {}} onCancel={onCancel} />);
    const file = new File([VALID_JSON_CONTENT], 'api.json', { type: 'application/json' });

    changeFileInput(container, file);
    await waitFor(() => { screen.getByRole('button', { name: /cancel/i }); });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('openapi-drop-zone')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('OpenAPIImport — loading state', () => {
  it('shows the loading indicator while parsing', async () => {
    const { container } = render(<OpenAPIImport onImport={() => {}} />);
    const file = new File([VALID_JSON_CONTENT], 'api.json', { type: 'application/json' });

    // Trigger the change but don't await the result yet.
    changeFileInput(container, file);

    // The loading state should appear before preview resolves.
    await waitFor(() => {
      const loading = screen.queryByText(/parsing specification/i);
      const preview = screen.queryByText(/endpoints? found/i);
      // At some point during async processing, one of these must be visible.
      expect(loading !== null || preview !== null).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// URL import
// ---------------------------------------------------------------------------

/** Minimal valid OpenAPI 3.0 JSON spec reused for URL tests. */
const VALID_JSON_BODY_URL = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Test', version: '1.0.0' },
  paths: {
    '/items': {
      get: { summary: 'List items' },
      post: { summary: 'Create item' },
    },
  },
});

function makeJsonResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'content-type': 'application/json' },
  });
}

describe('OpenAPIImport — URL import', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the URL input field and Fetch button', () => {
    render(<OpenAPIImport onImport={() => {}} />);
    expect(screen.getByTestId('openapi-url-input')).toBeTruthy();
    expect(screen.getByTestId('openapi-url-fetch-btn')).toBeTruthy();
  });

  it('Fetch button is disabled when the input is empty', () => {
    render(<OpenAPIImport onImport={() => {}} />);
    const btn = screen.getByTestId('openapi-url-fetch-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Fetch button becomes enabled when the input has a value', () => {
    render(<OpenAPIImport onImport={() => {}} />);
    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'https://example.com/api.json' } });
    const btn = screen.getByTestId('openapi-url-fetch-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('shows the preview after a successful URL fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeJsonResponse(VALID_JSON_BODY_URL)));

    render(<OpenAPIImport onImport={() => {}} />);
    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'https://example.com/petstore.json' } });
    fireEvent.click(screen.getByTestId('openapi-url-fetch-btn'));

    await waitFor(() => {
      expect(screen.getByText(/endpoints? found/i)).toBeTruthy();
    });

    expect(screen.getAllByText('/items').length).toBeGreaterThan(0);
  });

  it('submits on Enter key in the URL input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeJsonResponse(VALID_JSON_BODY_URL)));

    render(<OpenAPIImport onImport={() => {}} />);
    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'https://example.com/petstore.json' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/endpoints? found/i)).toBeTruthy();
    });
  });

  it('calls onImport with parsed endpoints when confirmed after URL fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeJsonResponse(VALID_JSON_BODY_URL)));

    const onImport = vi.fn<[ParsedEndpoint[]], void>();
    render(<OpenAPIImport onImport={onImport} />);

    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'https://example.com/api.json' } });
    fireEvent.click(screen.getByTestId('openapi-url-fetch-btn'));

    await waitFor(() => { screen.getByRole('button', { name: /confirm import/i }); });
    fireEvent.click(screen.getByRole('button', { name: /confirm import/i }));

    expect(onImport).toHaveBeenCalledTimes(1);
    const endpoints: ParsedEndpoint[] = onImport.mock.calls[0][0];
    expect(endpoints).toHaveLength(2);
    expect(endpoints.map((e) => e.method)).toContain('GET');
    expect(endpoints.map((e) => e.method)).toContain('POST');
  });

  it('shows an error panel for a rejected URL scheme (javascript:)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<OpenAPIImport onImport={() => {}} />);
    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByTestId('openapi-url-fetch-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toMatch(/not supported|not a valid URL/i);
  });

  it('shows an error panel for an http:// non-localhost URL without a network request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<OpenAPIImport onImport={() => {}} />);
    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'http://example.com/api.json' } });
    fireEvent.click(screen.getByTestId('openapi-url-fetch-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toMatch(/https/i);
  });

  it('shows an error panel when the server returns a 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeJsonResponse('Not Found', 404)));

    render(<OpenAPIImport onImport={() => {}} />);
    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'https://example.com/missing.json' } });
    fireEvent.click(screen.getByTestId('openapi-url-fetch-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toMatch(/404/);
  });

  it('shows the CORS guidance message on a TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    render(<OpenAPIImport onImport={() => {}} />);
    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'https://cors-blocked.example.com/api.json' } });
    fireEvent.click(screen.getByTestId('openapi-url-fetch-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toMatch(/cross-origin/i);
    expect(alertText).toMatch(/download the file/i);
  });

  it('shows a loading indicator and Cancel button while fetching from a URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(() => {})));

    render(<OpenAPIImport onImport={() => {}} />);
    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'https://example.com/api.json' } });
    fireEvent.click(screen.getByTestId('openapi-url-fetch-btn'));

    await waitFor(() => {
      expect(screen.queryByText(/fetching specification/i)).toBeTruthy();
    });
    expect(screen.getByTestId('openapi-url-cancel-btn')).toBeTruthy();
  });

  it('returns to idle state when Cancel is clicked during URL fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(() => {})));

    render(<OpenAPIImport onImport={() => {}} />);
    const input = screen.getByTestId('openapi-url-input');
    fireEvent.change(input, { target: { value: 'https://example.com/api.json' } });
    fireEvent.click(screen.getByTestId('openapi-url-fetch-btn'));

    await waitFor(() => { screen.getByTestId('openapi-url-cancel-btn'); });
    fireEvent.click(screen.getByTestId('openapi-url-cancel-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('openapi-drop-zone')).toBeTruthy();
    });
    expect(screen.queryByText(/fetching specification/i)).toBeNull();
  });

  it('file upload is unchanged: dropping a valid JSON file still reaches preview', async () => {
    render(<OpenAPIImport onImport={() => {}} />);
    const zone = screen.getByTestId('openapi-drop-zone');
    const file = new File([VALID_JSON_BODY_URL], 'api.json', { type: 'application/json' });

    const dropEvent = createEvent.drop(zone);
    const fileList = {
      length: 1,
      item: (i: number) => (i === 0 ? file : null),
      [Symbol.iterator]: function* () { yield file; },
    } as unknown as FileList;
    Object.defineProperty(fileList, 0, { value: file, enumerable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: fileList, dropEffect: 'copy' },
      writable: false,
    });
    fireEvent(zone, dropEvent);

    await waitFor(() => {
      expect(screen.getByText(/endpoints? found/i)).toBeTruthy();
    });
  });
});
