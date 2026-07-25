import React from 'react';
import FormField from '../components/FormField';
import KbdHint from '../components/KbdHint';
import type { Shortcut } from '../hooks/useGlobalShortcuts';

/**
 * QuotaBanner displays quota details and provides an input field.
 * It now includes a subtle keyboard shortcut hint for the primary action (Enter).
 */
export default function QuotaBanner() {
  const primaryShortcut: Shortcut = {
    key: 'Enter',
    description: 'Submit quota',
    category: 'Primary',
  };

  return (
    <div className="quota-banner">
      <h2>Quota Details</h2>
      <FormField id="quota-input" label="Quota" hint="Enter quota amount" status="idle">
        <input type="text" id="quota-input" aria-describedby="quota-extra-info" />
      </FormField>
      {/* Subtle hint chip for the primary action */}
      <KbdHint shortcuts={[primaryShortcut]} label="Primary action" />
      <p id="quota-extra-info">Some extra info about quota.</p>
    </div>
  );
}
