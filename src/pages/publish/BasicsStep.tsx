import type { ChangeEvent, ReactNode } from 'react';
import FormField from '../../components/FormField';
import { CATEGORIES, DESCRIPTION_MAX_LENGTH, fieldStatus } from './model';
import type { PublishFormState, TouchedState, ValidatedFields, ValidationErrors } from './model';

export interface BasicsStepProps {
  form: Pick<PublishFormState, 'apiName' | 'baseUrl' | 'category' | 'description'>;
  errors: ValidationErrors;
  touched: TouchedState;
  submitAttempted: boolean;
  descriptionLength: number;
  descriptionAnnouncement: string;
  onFieldChange: (
    field: keyof Omit<PublishFormState, 'endpoints'>,
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onFieldBlur: (field: ValidatedFields) => () => void;
  pricingSlot?: ReactNode;
}

export function BasicsStep({
  form,
  errors,
  touched,
  submitAttempted,
  descriptionLength,
  descriptionAnnouncement,
  onFieldChange,
  onFieldBlur,
  pricingSlot,
}: BasicsStepProps) {
  return (
    <fieldset className="pa-fieldset">
      <legend className="pa-legend">API details</legend>

      <FormField
        id="pa-api-name"
        label="API name"
        required
        error={errors.apiName}
        status={fieldStatus('apiName', errors, touched, submitAttempted)}
      >
        <input
          id="pa-api-name"
          type="text"
          className="pa-input"
          value={form.apiName}
          onChange={onFieldChange('apiName')}
          onBlur={onFieldBlur('apiName')}
          placeholder="e.g. Weather Forecast API"
          required
          aria-required="true"
        />
      </FormField>

      <FormField
        id="pa-base-url"
        label="Base URL"
        required
        error={errors.baseUrl}
        status={fieldStatus('baseUrl', errors, touched, submitAttempted)}
      >
        <input
          id="pa-base-url"
          type="url"
          className="pa-input"
          value={form.baseUrl}
          onChange={onFieldChange('baseUrl')}
          onBlur={onFieldBlur('baseUrl')}
          placeholder="https://api.example.com"
          required
          aria-required="true"
        />
      </FormField>

      <FormField
        id="pa-category"
        label="Category"
        required
        error={errors.category}
        status={fieldStatus('category', errors, touched, submitAttempted)}
      >
        <select
          id="pa-category"
          className="pa-input pa-select"
          value={form.category}
          onChange={onFieldChange('category')}
          onBlur={onFieldBlur('category')}
          required
          aria-required="true"
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </FormField>

      {pricingSlot}

      <FormField
        id="pa-description"
        label="Description"
        error={errors.description}
        status={fieldStatus('description', errors, touched, submitAttempted)}
        counter={{ current: descriptionLength, max: DESCRIPTION_MAX_LENGTH }}
      >
        <textarea
          id="pa-description"
          className="pa-textarea"
          value={form.description}
          onChange={onFieldChange('description')}
          onBlur={onFieldBlur('description')}
          placeholder="Describe what your API does, its use cases, and any notable constraints."
          rows={4}
        />
      </FormField>
      {/* Throttled announcement: only speaks once fewer than 50 characters remain. */}
      <p id="pa-description-counter-live" className="sr-only" aria-live="polite" aria-atomic="true">
        {descriptionAnnouncement}
      </p>
    </fieldset>
  );
}
