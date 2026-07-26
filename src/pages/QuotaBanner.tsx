import { useState, useEffect, useCallback } from 'react';
import FormField from '../components/FormField';
import KbdHint from '../components/KbdHint';
import type { Shortcut } from '../hooks/useGlobalShortcuts';

export type QuotaBannerProps = {
  /** Optional callback fired when the primary action (Save/Submit quota) is triggered. */
  onSave?: (quota: string) => void;
  /** Initial value for the quota input field. */
  initialQuota?: string;
  /** Custom label for the primary action button (defaults to "Save Quota"). */
  primaryActionLabel?: string;
  /** Primary action keyboard shortcut key hint (defaults to "Ctrl+Enter"). */
  shortcutKey?: string;
};

/**
 * QuotaBanner
 *
 * GrantFox FWC26 campaign (Stellar Wave) component.
 * Displays quota details with an accessible input field, a primary action button,
 * and a subtle shortcut hint chip (`KbdHint`) for quick keyboard execution.
 */
export default function QuotaBanner({
  onSave,
  initialQuota = '',
  primaryActionLabel = 'Save Quota',
  shortcutKey = 'Ctrl+Enter',
}: QuotaBannerProps) {
  const [quota, setQuota] = useState(initialQuota);

  const handleSave = useCallback(() => {
    onSave?.(quota);
  }, [onSave, quota]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const primaryShortcut: Shortcut = {
    key: shortcutKey,
    description: 'Save',
    category: 'Quota',
  };

  return (
    <div className="quota-banner">
      <h2>Quota Details</h2>
      <FormField id="quota-input" label="Quota" hint="Enter quota amount" status="idle">
        <input
          type="text"
          id="quota-input"
          value={quota}
          onChange={(e) => setQuota(e.target.value)}
          aria-describedby="quota-extra-info"
        />
      </FormField>
      {/* Subtle hint chip for the primary action */}
      <KbdHint shortcuts={[primaryShortcut]} label="Primary action" />
      <p id="quota-extra-info">Some extra info about quota.</p>
      <div className="quota-banner__actions">
        <button
          type="button"
          className="primary-button quota-banner__primary-btn"
          onClick={handleSave}
          aria-label={`${primaryActionLabel} (${shortcutKey})`}
        >
          <span>{primaryActionLabel}</span>
          <KbdHint
            shortcut={primaryShortcut}
            variant="chip"
            label={`Shortcut hint: ${shortcutKey}`}
          />
        </button>
      </div>
    </div>
  );
}

