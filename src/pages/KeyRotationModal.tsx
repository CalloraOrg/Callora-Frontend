import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';

/**
 * KeyRotationModal
 *
 * A WCAG 2.1 AA accessible modal for rotating API keys with optimistic UI
 * update and automatic revert on failure.
 *
 * Flow:
 *   1. User opens the modal → sees the current (masked) API key.
 *   2. User clicks "Rotate Key" → the new key is **immediately** displayed
 *      (optimistic update) while the rotation request is sent.
 *   3. If the request *succeeds* → a success toast is shown and the new key
 *      is kept.
 *   4. If the request *fails* → the old key is **reverted** and an error
 *      toast is displayed so the user can retry.
 *
 * Focus management (WCAG 2.1 AA):
 *   - When the modal opens, focus is moved to the "Close" button.
 *   - When the optimistic update begins, focus is trapped in the modal.
 *   - Escape key closes the modal from any keyboard state.
 *
 * Design tokens are used for all colors, shadows, and spacing so the modal
 * works correctly in both light and dark themes.
 *
 * Part of GrantFox FWC26 campaign UI/UX requirements.
 */

interface KeyRotationModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user closes the modal (Escape, backdrop click, Close button). */
  onClose: () => void;
  /** The current API key displayed in the modal. */
  currentKey: string;
  /**
   * Async callback that performs the actual key rotation.
   * Must resolve with the new key string on success, or throw on failure.
   */
  onRotateKey: () => Promise<string>;
  /** Called with the new key after a successful rotation. */
  onKeyChanged?: (newKey: string) => void;
}

/**
 * Generates a client-side key for optimistic display.
 * Mirrors the pattern used in ApiUsage.handleRegenerateApiKey.
 */
function generateOptimisticKey(): string {
  return (
    'ck_live_' +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export default function KeyRotationModal({
  isOpen,
  onClose,
  currentKey,
  onRotateKey,
  onKeyChanged,
}: KeyRotationModalProps) {
  const { showToast } = useToast();

  // Core state
  const [displayedKey, setDisplayedKey] = useState(currentKey);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationError, setRotationError] = useState<string | null>(null);

  // Track the key that was showing before the optimistic update started,
  // so we can revert to it on failure.
  const previousKeyRef = useRef(currentKey);

  // Refs for focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Sync displayedKey when currentKey prop changes externally
  useEffect(() => {
    setDisplayedKey(currentKey);
    previousKeyRef.current = currentKey;
    setRotationError(null);
  }, [currentKey]);

  // Focus trap and Escape handling
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    // Save current focus to restore on close
    previousFocusRef.current = document.activeElement as HTMLElement;
    // Move focus to the Close button when modal opens
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Basic focus trap: keep Tab/Shift+Tab within the modal
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  /**
   * Optimistic key rotation:
   * 1. Save the current key as fallback.
   * 2. Generate an optimistic new key and display it immediately.
   * 3. Call the async rotation handler.
   * 4. On success: keep the new key, notify parent, show success toast.
   * 5. On failure: revert to the saved key, show error toast.
   */
  const handleRotate = useCallback(async () => {
    if (isRotating) return;

    setRotationError(null);
    setIsRotating(true);

    // Save the current key as fallback before optimistic update
    const fallbackKey = displayedKey;
    previousKeyRef.current = fallbackKey;

    // Optimistic update: show the new key immediately
    const optimisticKey = generateOptimisticKey();
    setDisplayedKey(optimisticKey);

    try {
      // Attempt actual rotation
      const newKey = await onRotateKey();

      // Success: keep the new key from the server
      setDisplayedKey(newKey);
      previousKeyRef.current = newKey;
      onKeyChanged?.(newKey);
      showToast('API key rotated successfully.', 'success');
    } catch {
      // Failure: revert to the previous key
      setDisplayedKey(fallbackKey);
      previousKeyRef.current = fallbackKey;
      setRotationError('Failed to rotate API key. Please try again.');
      showToast('Key rotation failed. Your previous key has been restored.', 'error');
    } finally {
      setIsRotating(false);
    }
  }, [isRotating, displayedKey, onRotateKey, onKeyChanged, showToast]);

  const handleClose = useCallback(() => {
    if (isRotating) return; // Prevent closing while rotation is in progress
    onClose();
  }, [isRotating, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'var(--backdrop)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-rotation-title"
        aria-describedby="key-rotation-description"
        className="deposit-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)',
          maxHeight: 'min(85vh, 900px)',
          overflow: 'auto',
          padding: '28px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--line-strong)',
          background: 'var(--modal-bg)',
          boxShadow: 'var(--shadow)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
          }}
        >
          <div>
            <p
              className="eyebrow"
              style={{ margin: 0 }}
            >
              API Key Management
            </p>
            <h2
              id="key-rotation-title"
              style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 600 }}
            >
              Rotate API Key
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="ghost-button"
            onClick={handleClose}
            disabled={isRotating}
            aria-label="Close key rotation modal"
          >
            Close
          </button>
        </div>

        {/* Description */}
        <p
          id="key-rotation-description"
          style={{
            margin: '0 0 20px 0',
            color: 'var(--muted)',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
          }}
        >
          Rotating your API key generates a new key and immediately invalidates
          the previous one. Any services using the old key will stop working.
        </p>

        {/* Current / New Key Display */}
        <div
          style={{
            marginBottom: '24px',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-soft)',
            border: '1px solid var(--line)',
          }}
        >
          <label
            htmlFor="key-rotation-input"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {isRotating ? 'New API Key (pending)' : 'API Key'}
          </label>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <input
              id="key-rotation-input"
              type={isKeyVisible ? 'text' : 'password'}
              value={displayedKey}
              readOnly
              aria-invalid={rotationError ? true : undefined}
              aria-describedby={rotationError ? 'key-rotation-error' : undefined}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: rotationError
                  ? '1px solid var(--danger)'
                  : '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <button
              type="button"
              className="ghost-button"
              onClick={() => setIsKeyVisible((v) => !v)}
              aria-label={isKeyVisible ? 'Hide API key' : 'Show API key'}
            >
              {isKeyVisible ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Error message */}
          {rotationError && (
            <p
              id="key-rotation-error"
              role="alert"
              style={{
                margin: '10px 0 0 0',
                fontSize: '0.8125rem',
                color: 'var(--danger)',
              }}
            >
              {rotationError}
            </p>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            className="ghost-button"
            onClick={handleClose}
            disabled={isRotating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleRotate}
            disabled={isRotating}
            aria-busy={isRotating}
            style={{
              minWidth: '140px',
              minHeight: '44px',
            }}
          >
            {isRotating && <span className="button-spinner" aria-hidden="true" />}
            {isRotating ? 'Rotating…' : 'Rotate Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
