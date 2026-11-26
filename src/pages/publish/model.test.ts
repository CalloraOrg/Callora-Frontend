import { describe, expect, it } from 'vitest';
import {
  DESCRIPTION_MAX_LENGTH,
  DRAFT_STORAGE_KEY,
  INITIAL_FORM,
  INITIAL_TOUCHED,
  endpointKey,
  fieldStatus,
  findDuplicateEndpointIds,
  isPublishFormDraft,
  methodBadgeClass,
  normalizeFieldKey,
  toPublishPayload,
  toValidationErrors,
  validateEndpoints,
  validateForm,
} from './model';
import type { EndpointEntry, PublishFormState } from './model';

function validForm(overrides: Partial<PublishFormState> = {}): PublishFormState {
  return {
    apiName: 'Weather API',
    baseUrl: 'https://api.weather.example.com',
    category: 'Weather & Environment',
    description: 'Forecasts and historical observations.',
    pricePerCall: '0.002',
    endpoints: [{ id: 'ep-1', method: 'GET', path: '/forecast', summary: 'Get forecast' }],
    ...overrides,
  };
}

describe('publish model', () => {
  it('preserves the localStorage draft key', () => {
    expect(DRAFT_STORAGE_KEY).toBe('callora:publish-api:draft');
  });

  describe('methodBadgeClass', () => {
    it('maps known HTTP methods and falls back to default', () => {
      expect(methodBadgeClass('GET')).toBe('pa-badge pa-badge-get');
      expect(methodBadgeClass('post')).toBe('pa-badge pa-badge-post');
      expect(methodBadgeClass('PUT')).toBe('pa-badge pa-badge-put');
      expect(methodBadgeClass('DELETE')).toBe('pa-badge pa-badge-delete');
      expect(methodBadgeClass('PATCH')).toBe('pa-badge pa-badge-patch');
      expect(methodBadgeClass('OPTIONS')).toBe('pa-badge pa-badge-default');
    });
  });

  describe('endpointKey & findDuplicateEndpointIds', () => {
    it('normalizes method casing while keeping path exact', () => {
      expect(endpointKey({ method: 'get', path: '/users' })).toBe('GET /users');
      expect(endpointKey({ method: 'GET', path: '/users/:id' })).toBe('GET /users/:id');
    });

    it('flags every member of a duplicate group', () => {
      const endpoints: EndpointEntry[] = [
        { id: 'ep-1', method: 'GET', path: '/users' },
        { id: 'ep-2', method: 'POST', path: '/users' },
        { id: 'ep-3', method: 'get', path: '/users' },
      ];
      expect(findDuplicateEndpointIds(endpoints)).toEqual(new Set(['ep-1', 'ep-3']));
    });

    it('returns an empty set when all endpoints are unique', () => {
      const endpoints: EndpointEntry[] = [
        { id: 'ep-1', method: 'GET', path: '/users' },
        { id: 'ep-2', method: 'GET', path: '/users/:id' },
      ];
      expect(findDuplicateEndpointIds(endpoints)).toEqual(new Set());
    });
  });

  describe('validateEndpoints', () => {
    it('requires at least one endpoint', () => {
      expect(validateEndpoints([])).toBe(
        'Add at least one endpoint before publishing. Use "Import spec" above to add them.',
      );
    });

    it('reports duplicate endpoints with counts', () => {
      const endpoints: EndpointEntry[] = [
        { id: 'ep-1', method: 'GET', path: '/items' },
        { id: 'ep-2', method: 'get', path: '/items' },
      ];
      expect(validateEndpoints(endpoints)).toBe(
        'Each endpoint must have a unique method and path. Remove the duplicates: GET /items (2×).',
      );
    });

    it('returns undefined for valid unique endpoints', () => {
      expect(validateEndpoints([{ id: 'ep-1', method: 'GET', path: '/items' }])).toBeUndefined();
    });
  });

  describe('validateForm', () => {
    it('returns no errors for a valid form', () => {
      expect(validateForm(validForm())).toEqual({});
    });

    it('validates required fields on initial empty form', () => {
      const errors = validateForm(INITIAL_FORM);
      expect(errors.apiName).toBe('API name is required.');
      expect(errors.baseUrl).toBe('Base URL is required.');
      expect(errors.category).toBe('Please select a category.');
      expect(errors.endpoints).toBe(
        'Add at least one endpoint before publishing. Use "Import spec" above to add them.',
      );
      expect(errors.description).toBeUndefined();
      expect(errors.pricePerCall).toBeUndefined();
    });

    it('rejects non-https and malformed base URLs', () => {
      expect(validateForm(validForm({ baseUrl: 'http://api.example.com' })).baseUrl).toBe(
        'Base URL must use the https scheme.',
      );
      expect(validateForm(validForm({ baseUrl: 'not-a-url' })).baseUrl).toBe(
        'Enter a valid URL (e.g. https://api.example.com).',
      );
    });

    it('rejects descriptions exceeding the max length', () => {
      const tooLong = 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1);
      expect(validateForm(validForm({ description: tooLong })).description).toBe(
        `Description is over the maximum of ${DESCRIPTION_MAX_LENGTH} characters.`,
      );
    });

    it('validates pricePerCall when provided and allows blank or zero', () => {
      expect(validateForm(validForm({ pricePerCall: '' })).pricePerCall).toBeUndefined();
      expect(validateForm(validForm({ pricePerCall: '0' })).pricePerCall).toBeUndefined();
      expect(validateForm(validForm({ pricePerCall: '-1' })).pricePerCall).toBe(
        'Price per call must be 0 or greater.',
      );
      expect(validateForm(validForm({ pricePerCall: 'abc' })).pricePerCall).toBe(
        'Price per call must be 0 or greater.',
      );
    });
  });

  describe('fieldStatus', () => {
    it('stays idle until touched or submitAttempted', () => {
      const errors = { apiName: 'API name is required.' };
      expect(fieldStatus('apiName', errors, INITIAL_TOUCHED, false)).toBe('idle');
      expect(fieldStatus('apiName', errors, { ...INITIAL_TOUCHED, apiName: true }, false)).toBe(
        'error',
      );
      expect(fieldStatus('apiName', errors, INITIAL_TOUCHED, true)).toBe('error');
      expect(fieldStatus('apiName', {}, INITIAL_TOUCHED, true)).toBe('success');
    });
  });

  describe('isPublishFormDraft', () => {
    it('accepts a valid draft object', () => {
      expect(isPublishFormDraft(validForm())).toBe(true);
      expect(isPublishFormDraft(INITIAL_FORM)).toBe(true);
    });

    it('rejects malformed or legacy shapes', () => {
      expect(isPublishFormDraft(null)).toBe(false);
      expect(isPublishFormDraft('draft')).toBe(false);
      expect(isPublishFormDraft({ ...INITIAL_FORM, apiName: 123 })).toBe(false);
      expect(isPublishFormDraft({ ...INITIAL_FORM, endpoints: 'none' })).toBe(false);
      expect(
        isPublishFormDraft({
          ...INITIAL_FORM,
          endpoints: [{ id: 'ep-1', path: '/a' }],
        }),
      ).toBe(false);
    });
  });

  describe('normalizeFieldKey & toValidationErrors', () => {
    it('normalizes snake_case and punctuation', () => {
      expect(normalizeFieldKey('base_url')).toBe('baseurl');
      expect(normalizeFieldKey('Price-Per-Call')).toBe('pricepercall');
    });

    it('maps aliased server fields and preserves unmapped errors', () => {
      const { mapped, unmapped } = toValidationErrors({
        base_url: 'URL is unreachable',
        url: 'Duplicate alias should not overwrite',
        price: 'Too high',
        quota_tier: 'Unsupported tier',
      });
      expect(mapped).toEqual({
        baseUrl: 'URL is unreachable',
        pricePerCall: 'Too high',
      });
      expect(unmapped).toEqual(['Unsupported tier']);
    });
  });

  describe('toPublishPayload', () => {
    it('trims strings, strips endpoint ids, and maps blank price to null', () => {
      const payload = toPublishPayload(
        validForm({
          apiName: '  Weather API  ',
          baseUrl: '  https://api.weather.example.com  ',
          pricePerCall: '   ',
          endpoints: [
            { id: 'ep-1', method: 'GET', path: '/forecast', summary: 'Get forecast' },
            { id: 'ep-2', method: 'POST', path: '/alerts' },
          ],
        }),
      );

      expect(payload).toEqual({
        apiName: 'Weather API',
        baseUrl: 'https://api.weather.example.com',
        category: 'Weather & Environment',
        description: 'Forecasts and historical observations.',
        pricePerCall: null,
        endpoints: [
          { path: '/forecast', method: 'GET', summary: 'Get forecast' },
          { path: '/alerts', method: 'POST' },
        ],
      });
    });

    it('preserves 0 as a numeric price rather than null', () => {
      expect(toPublishPayload(validForm({ pricePerCall: '0' })).pricePerCall).toBe(0);
      expect(toPublishPayload(validForm({ pricePerCall: '0.005' })).pricePerCall).toBe(0.005);
    });
  });
});
