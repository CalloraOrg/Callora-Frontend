import React from 'react';
import FormField from '../components/FormField';

export default function QuotaBanner() {
  return (
    <div className="quota-banner">
      <h2>Quota Details</h2>
      <FormField id="quota-input" label="Quota" hint="Enter quota amount" status="idle">
        <input type="text" id="quota-input" aria-describedby="quota-extra-info" />
      </FormField>
      <p id="quota-extra-info">Some extra info about quota.</p>
    </div>
  );
}
