import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';
import {
  RotationContext,
  type RotationRequest,
} from '../services/KeyRotationService';
import { rotateKeyWithToken, getRotationToken } from '../services/KeyRotationApi';
import { logError, formatErrorForUI } from '../services/SecureErrorHandler';

/**
 * KeyRotationModal
 *
 * A WCAG 2.1 AA accessible modal for rotating API keys with optimistic UI
 * update, automatic revert on failure, and server-issued confirmation tokens.
 *
 * Security features:
 *   - Server-issued confirmation token requested on user confirm (getRotationToken)
 *   - Server-minted token prevents replay and cross-tenant attacks
 *   - Secure error handling (no API key or token leakage in UI, logs or telemetry)
 *   - Automatic rollback to previous key on failure
 *
 * Part of issue #991 & #1369: Make API-key rotation confirmation lossless
 */

export interface KeyRotationModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user closes the modal (Escape, backdrop click, Close button). */
  onClose: () => void;
  /** The current API key displayed in the modal. */
  currentKey?: string;
  /** Unique identifier for this key (used in rotation context). */
  keyId: string;
  /** Called with the new key after a successful rotation. */
  onKeyChanged?: (newKey: string) => void;
  /** Current user ID (used in authorization context). */
  userId?: string;
  /** Current tenant ID (used in authorization context). */
  tenantId?: string;
  /** Current session ID (used in authorization context). */
  sessionId?: string;
  /** Session bearer token for API authentication. */
  sessionToken: string;
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
  currentKey = 'ck_live_••••••••••••••••••••••••',
  keyId,
  onKeyChanged,
  userId = 'user_default',
  tenantId = 'tenant_default',
  sessionId = 'session_default',
  sessionToken,
}: KeyRotationModalProps) {
  const { showToast } = useToast();

  // Core state
  const [displayedKey, setDisplayedKey] = useState(currentKey);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

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
   * Lossless key rotation with security boundaries:
   * 1. Request server-issued confirmation token (getRotationToken).
   * 2. If token request fails: Show safe error with retry, do not mutate state.
   * 3. Show optimistic key while mutation is in-flight.
   * 4. Call rotateKeyWithToken with server token and session bearer token.
   * 5. On success: display new key, notify parent via onKeyChanged, show success toast.
   * 6. On failure: revert to fallback key, show safe error, offer retry if retryable.
   */
  const handleRotate = useCallback(async () => {
    if (isRotating) return;

    setRotationError(null);
    setLastErrorCode(null);
    setCanRetry(false);
    setIsRotating(true);

    const fallbackKey = displayedKey;
    previousKeyRef.current = fallbackKey;

    try {
      // Step 1: Request confirmation token from the server
      const tokenResult = await getRotationToken(keyId, sessionToken);

      if (tokenResult.error || !tokenResult.token) {
        const errorCode = tokenResult.error?.code || 'TOKEN_REQUEST_FAILED';
        const formatted = formatErrorForUI(
          new Error(tokenResult.error?.message || 'Failed to request rotation token.'),
          errorCode,
        );

        logError('[KeyRotationModal] Token request failed', tokenResult.error, {
          code: errorCode,
          retryable: true,
        });

        setRotationError(formatted.message);
        setLastErrorCode(formatted.code ?? errorCode);
        setCanRetry(true);
        showToast(formatted.message, 'error');
        return;
      }

      const confirmationToken = tokenResult.token;

      // Build rotation context
      const context: RotationContext = {
        userId,
        tenantId,
        sessionId,
        timestamp: Date.now(),
      };

      // Optimistic update: show temporary key
      const optimisticKey = generateOptimisticKey();
      setDisplayedKey(optimisticKey);

      // Step 2: Attempt actual rotation with server-issued token
      const response = await rotateKeyWithToken(
        {
          keyId,
          confirmationToken,
          context,
        },
        sessionToken,
      );

      if (!response.success || !response.newKey) {
        const formattedError = formatErrorForUI(
          new Error(response.error?.message),
          response.error?.code,
        );

        logError('[KeyRotationModal] Rotation failed', response.error, {
          code: response.error?.code,
          retryable: formattedError.isRetryable,
        });

        throw new Error(formattedError.message);
      }

      // Success: keep the new key from the server
      setDisplayedKey(response.newKey);
      previousKeyRef.current = response.newKey;
      onKeyChanged?.(response.newKey);
      showToast('API key rotated successfully.', 'success');
    } catch (error) {
      // Failure: revert to the previous key
      setDisplayedKey(fallbackKey);
      previousKeyRef.current = fallbackKey;

      const formattedError = formatErrorForUI(error);
      logError('[KeyRotationModal] Rotation failed', error);

      setRotationError(formattedError.message);
      setLastErrorCode(formattedError.code ?? null);
      setCanRetry(formattedError.isRetryable);
      showToast(formattedError.message, 'error');
    } finally {
      setIsRotating(false);
    }
  }, [isRotating, displayedKey, keyId, userId, tenantId, sessionId, sessionToken, onKeyChanged, showToast]);

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
          {canRetry && rotationError && (
            <button
              type="button"
              className="secondary-button"
              onClick={handleRotate}
              disabled={isRotating}
              aria-label="Retry API key rotation"
              title="Retry the rotation"
            >
              {isRotating ? 'Rotating…' : 'Retry'}
            </button>
          )}
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
