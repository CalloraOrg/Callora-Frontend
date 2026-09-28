import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PublishApi from './PublishApi';
import { vi } from 'vitetest';

let stateIndex = 0;
const stateValues: any[] = [];

const useStateMock = vi.fn((initial) => {
  if (stateIndex < stateValues.length) {
    const setter = vi.fn((value) => {
      stateValues[stateIndex] = value;
    });
    return [stateValues[stateIndex++], setter];
  }
  const setter = vi.fn();
  stateValues.push(initial);
  return [initial, setter];
});

vi.mock("react", () => {
  const actual = vi.importActual('react');
  const mocked = {
    ...actual,
    useState: useStateMock,
    useId: vi.fn(() => "mock-id"),
    useCallback: vi.fn((callback, deps) => callback),
    useMemo: vi.fn((factory, deps) => factory()),
    useRef: vi.fn(() => ({ current: undefined })),
    useEffect: vi.fn()
  };
  mocked.default = mocked;
  return mocked;
});

// Constants from component
const INITIAL_FORM = {
  apiName: '',
  baseUrl: '',
  category: '',
  description: '',
  pricePerCall: '',
  endpoints: [],
};
const INITIAL_TOUCHED = {
  apiName: false,
  baseUrl: false,
  category: false,
  pricePerCall: false,
};

// Mock OpenAPIImport
vi.mock('../components/OpenAPIImport', () => ({
  default: vi.fn(() => <div data-testid='mock-openapi-import' />),
}));

// Mock hooks with factory that returns new objects each call (as before)
vi.mock('../hooks/useFormPersistence', () => ({
  useFormPersistence: vi.fn(() => ({
    clearDraft: vi.fn(),
    wasRestored: false,
    hasDraft: false,
  })),
}));
vi.mock('../hooks/useSessionExpiry', () => ({
  useSessionExpiry: vi.fn(() => ({
    isExpired: false,
    dismiss: vi.fn(),
    countdown: null,
    signalExpiry: vi.fn(),
  })),
}));
vi.mock('../hooks/useDocumentTitle', () => ({
  default: vi.fn(),
}));
vi.mock('../hooks/useBeforeUnload', () => ({
  useBeforeUnload: vi.fn(),
}));

beforeEach(() => {
  stateIndex = 0;
  stateValues.length = 0;
  stateValues.push(INITIAL_FORM); // index 0: form
  stateValues.push(INITIAL_TOUCHED); // index 1: touched
  stateValues.push(false); // index 2: submitAttempted
  stateValues.push(false); // index 3: importOpen
  stateValues.push(false); // index 4: submitted
  stateValues.push(false); // index 5: showBanner (from SessionExpiryBanner)
  vi.clearAllMocks();
});

describe('PublishApi - basic tests', () => {
  test('renders the form with initial values', () => {
    render(<PublishApi />);
    expect(screen.getByLabelText(/api name/i)).toHaveValue('');
    expect(screen.getByLabelText(/base url/i)).toHaveValue('');
    expect(screen.getByLabelText(/category/i)).toHaveValue('');
    expect(screen.getByLabelText(/price per call/i)).toHaveValue('');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
  });

  test('shows https error for http:// base URL on blur', async () => {
    render(<PublishApi />);
    const baseUrlInput = screen.getByLabelText(/base url/i);
    fireEvent.change(baseUrlInput, { target: { value: 'http://example.com' } });
    fireEvent.blur(baseUrlInput);
    expect(screen.getByText(/base url must use the https scheme/i)).toBeInTheDocument();
  });

  test('shows valid URL error for malformed URL on blur', async () => {
    render(<PublishApi />);
    const baseUrlInput = screen.getByLabelText(/base url/i);
    fireEvent.change(baseUrlInput, { target: { value: 'not a url' } });
    fireEvent.blur(baseUrlInput);
    expect(screen.getByText(/enter a valid url/i)).toBeInTheDocument();
  });

  test('shows price error for negative number on blur', async () => {
    render(<PublishApi />);
    const priceInput = screen.getByLabelText(/price per call/i);
    fireEvent.change(priceInput, { target: { value: '-1' } });
    fireEvent.blur(priceInput);
    expect(screen.getByText(/price per call must be 0 or greater/i)).toBeInTheDocument();
  });

  test('shows price error for non-numeric value on blur', async () => {
    render(<PublishApi />);
    const priceInput = screen.getByLabelText(/price per call/i);
    fireEvent.change(priceInput, { target: { value: 'abc' } });
    fireEvent.blur(priceInput);
    expect(screen.getByText(/price per call must be 0 or greater/i)).toBeInTheDocument();
  });

  test('shows category error when no category selected on blur', async () => {
    render(<PublishApi />);
    const categorySelect = screen.getByLabelText(/category/i);
    fireEvent.change(categorySelect, { target: { value: '' } });
    fireEvent.blur(categorySelect);
    expect(screen.getByText(/please select a category/i)).toBeInTheDocument();
  });

  test('errors are hidden before blur', async () => {
    render(<PublishApi />);
    const baseUrlInput = screen.getByLabelText(/base url/i);
    fireEvent.change(baseUrlInput, { target: { value: 'http://example.com' } });
    // Do not blur
    expect(screen.queryByText(/base url must use the https scheme/i)).not.toBeInTheDocument();
  });

  test('submitting reveals all field errors', async () => {
    render(<PublishApi />);
    const submitButton = screen.getByRole('button', { name: /publish api/i });
    fireEvent.click(submitButton);
    expect(screen.getByText(/api name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/base url is required/i)).toBeInTheDocument();
    expect(screen.getByText(/please select a category/i)).toBeInTheDocument();
    expect(screen.queryByText(/price per call must be 0 or greater/i)).not.toBeInTheDocument();
  });
});

test('valid submission renders success screen', async () => {
  render(<PublishApi />);
  // fill form with valid data
  fireEvent.change(screen.getByLabelText(/api name/i), { target: { value: 'Test API' } });
  fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'https://example.com' } });
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'AI & Machine Learning' } });
  fireEvent.change(screen.getByLabelText(/price per call/i), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test description' } });
  fireEvent.click(screen.getByRole('button', { name: /publish api/i }));
  await waitFor(() => {
    expect(screen.getByText(/api submitted for review/i)).toBeInTheDocument();
  });
  expect(screen.getByText(/test api/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /publish another api/i })).toBeInTheDocument();
});
