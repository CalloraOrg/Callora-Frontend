import type { ChangeEvent } from 'react';
import FormField from '../../components/FormField';
import { fieldStatus } from './model';
import type { TouchedState, ValidationErrors } from './model';

export interface PricingStepProps {
  pricePerCall: string;
  errors: ValidationErrors;
  touched: TouchedState;
  submitAttempted: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}

export function PricingStep({
  pricePerCall,
  errors,
  touched,
  submitAttempted,
  onChange,
  onBlur,
}: PricingStepProps) {
  return (
    <FormField
      id="pa-price"
      label="Price per call (USDC)"
      hint="Charged per successful API call. Leave blank to set later."
      error={errors.pricePerCall}
      status={fieldStatus('pricePerCall', errors, touched, submitAttempted)}
    >
      <input
        id="pa-price"
        type="text"
        inputMode="decimal"
        className="pa-input pa-input-narrow"
        value={pricePerCall}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="0.001"
      />
    </FormField>
  );
}
