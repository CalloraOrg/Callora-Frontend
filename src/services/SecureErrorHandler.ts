/**
 * SecureErrorHandler
 *
 * Centralized error handling that ensures sensitive data (API keys, tokens,
 * user IDs, etc.) is never leaked in:
 * - Error messages shown to users
 * - Console logs
 * - Error telemetry/monitoring
 * - Network responses
 * - Local storage or client-side state
 *
 * This module provides:
 * 1. Safe error message generation
 * 2. Sanitization for logging and telemetry
 * 3. Error code classification (retryable vs. permanent)
 * 4. Consistent error formatting across the app
 *
 * Part of issue #991: Make API-key rotation confirmation lossless
 */

import { RotationErrorCode } from './KeyRotationService';

/**
 * Safe error messages that can be shown to end users.
 * Each message is generic enough to not leak implementation details.
 */
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  // Authorization & Authentication
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  AUTHORIZATION_FAILED: 'You are not authorized to rotate this key.',
  AUTHENTICATION_REQUIRED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to access this resource.',

  // Token & Session
  TOKEN_EXPIRED: 'Confirmation token has expired. Please start a new rotation.',
  TOKEN_INVALID: 'Confirmation token is invalid. Please start a new rotation.',
  SESSION_EXPIRED: 'Your session has expired. Please refresh and try again.',
  SESSION_INVALID: 'Your session is invalid. Please refresh and try again.',

  // Resource & Validation
  NOT_FOUND: 'The requested resource was not found.',
  KEY_NOT_FOUND: 'Key not found. Please refresh and try again.',
  INVALID_INPUT: 'Invalid request. Please check your input and try again.',
  INVALID_REQUEST: 'Invalid request format. Please try again.',
  MALFORMED_REQUEST: 'Request is malformed. Please try again.',

  // Cross-tenant & Security
  CROSS_TENANT_VIOLATION: 'You are not authorized to rotate this key.',
  CROSS_ORIGIN_ERROR: 'Cross-origin request blocked.',
  SECURITY_VIOLATION: 'Security validation failed.',

  // Rate Limiting & Quota
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait and try again.',
  QUOTA_EXCEEDED: 'Quota exceeded. Please try again later.',
  TOO_MANY_REQUESTS: 'Too many requests. Please wait a moment.',

  // Network & Timeout
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  TIMEOUT: 'Request timed out. Please try again.',
  CONNECTION_ERROR: 'Connection error. Please try again.',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',

  // Server & General
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An error occurred. Please try again.',
  ROTATION_FAILED: 'Failed to rotate API key. Please try again.',
};

/**
 * Patterns that indicate sensitive data and should be redacted in logs/errors.
 * These patterns are used to sanitize error messages before display or logging.
 */
const SENSITIVE_PATTERNS = [
  // API keys
  { pattern: /\b(ck_live_|sk_|pk_)[a-zA-Z0-9_]{20,}\b/g, replacement: '[REDACTED_KEY]' },
  // Bearer tokens
  { pattern: /Bearer\s+[a-zA-Z0-9\-_.~+/]+=*/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  // Session/JWT tokens
  { pattern: /[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: '[REDACTED_TOKEN]' },
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
  // URLs with credentials
  { pattern: /https?:\/\/[^:]+:[^@]+@[^\s]/gi, replacement: 'https://[REDACTED_CREDENTIALS]' },
  // Passwords
  { pattern: /(?:password|passwd|pwd)[\s:=]+[^\s,;)]+/gi, replacement: '[REDACTED_PASSWORD]' },
  // Database credentials
  { pattern: /(?:user|username)[\s:=]+[^\s,;)]+/gi, replacement: '[REDACTED_USERNAME]' },
  // API keys in URLs
  { pattern: /[?&](?:api_?key|key|token)=[^\s&]*/gi, replacement: '[REDACTED_PARAM]' },
  // Credit card-like patterns
  { pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, replacement: '[REDACTED_CARD]' },
  // Phone numbers
  { pattern: /\b\d{3}[\s\-]?\d{3}[\s\-]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },
];

/**
 * Redacts sensitive data from a string for safe logging/telemetry.
 * Applied before sending errors to monitoring systems or logs.
 */
export function redactSensitiveData(text: string | Error): string {
  if (!text) return '[empty]';

  const str = text instanceof Error ? `${text.message}\n${text.stack}` : String(text);

  let result = str;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Gets a safe error message to show to the user.
 * Maps error codes and patterns to generic, non-leaking messages.
 */
export function getSafeErrorMessage(
  error: unknown,
  errorCode?: string,
  fallback?: string,
): string {
  // If we have a known error code, use the safe message
  if (errorCode && SAFE_ERROR_MESSAGES[errorCode]) {
    return SAFE_ERROR_MESSAGES[errorCode];
  }

  // If error is a known error code enum value
  if (errorCode && Object.values(RotationErrorCode).includes(errorCode as any)) {
    return SAFE_ERROR_MESSAGES[errorCode] || SAFE_ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  // Extract message from error and check if it matches known patterns
  let message = '';
  if (error instanceof Error) {
    message = error.message.toLowerCase();
  } else if (typeof error === 'string') {
    message = error.toLowerCase();
  }

  // Pattern-based detection
  if (message.includes('unauthorized') || message.includes('permission denied')) {
    return SAFE_ERROR_MESSAGES.AUTHORIZATION_FAILED;
  }

  if (message.includes('timeout')) {
    return SAFE_ERROR_MESSAGES.TIMEOUT;
  }

  if (message.includes('network') || message.includes('fetch')) {
    return SAFE_ERROR_MESSAGES.NETWORK_ERROR;
  }

  if (message.includes('not found') || message.includes('404')) {
    return SAFE_ERROR_MESSAGES.NOT_FOUND;
  }

  if (message.includes('server') || message.includes('500')) {
    return SAFE_ERROR_MESSAGES.SERVER_ERROR;
  }

  if (message.includes('unavailable') || message.includes('503')) {
    return SAFE_ERROR_MESSAGES.SERVICE_UNAVAILABLE;
  }

  if (message.includes('invalid') || message.includes('malformed')) {
    return SAFE_ERROR_MESSAGES.INVALID_INPUT;
  }

  // Use provided fallback or default
  return fallback || SAFE_ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Safely logs an error for debugging/monitoring without exposing secrets.
 * Use this instead of console.error for sensitive operations.
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): void {
  const redacted = redactSensitiveData(error as any);
  const safeMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
          key,
          typeof value === 'string' ? redactSensitiveData(value) : value,
        ])
      )
    : undefined;

  // In production, this would be sent to error tracking (Sentry, etc.)
  // For now, log with redacted content only
  console.error(`[${context}]`, redacted, safeMetadata || '');
}

/**
 * Determines if an error is retryable based on the error code or message.
 * Some errors (auth, validation) should NOT be retried.
 * Others (network, timeout) can be retried.
 */
export function isRetryableError(error: unknown, errorCode?: string): boolean {
  // Known non-retryable error codes
  const nonRetryable = [
    RotationErrorCode.AUTHORIZATION_FAILED,
    RotationErrorCode.CROSS_TENANT_VIOLATION,
    RotationErrorCode.KEY_NOT_FOUND,
    RotationErrorCode.TOKEN_INVALID,
    RotationErrorCode.TOKEN_EXPIRED,
    RotationErrorCode.INVALID_INPUT,
    'UNAUTHORIZED',
    'FORBIDDEN',
    'AUTHENTICATION_REQUIRED',
    'INVALID_REQUEST',
    'MALFORMED_REQUEST',
  ];

  if (errorCode && nonRetryable.includes(errorCode)) {
    return false;
  }

  // Check error message patterns
  let message = '';
  if (error instanceof Error) {
    message = error.message.toLowerCase();
  } else if (typeof error === 'string') {
    message = error.toLowerCase();
  }

  const nonRetryableMessages = [
    'unauthorized',
    'forbidden',
    '401',
    '403',
    '404',
    'not found',
    'invalid',
    'malformed',
    'validation',
  ];

  if (nonRetryableMessages.some(m => message.includes(m))) {
    return false;
  }

  // Everything else is retryable (network, timeout, server errors, etc.)
  return true;
}

/**
 * Formats an error for display in the UI.
 * Includes the safe message and optionally a code for user reference.
 */
export interface FormattedError {
  message: string;
  code?: string;
  isRetryable: boolean;
  isDeveloperError: boolean; // True if this is likely a bug, not user error
}

export function formatErrorForUI(
  error: unknown,
  errorCode?: string,
): FormattedError {
  const message = getSafeErrorMessage(error, errorCode);
  const retryable = isRetryableError(error, errorCode);

  // Determine if this is a developer/system error vs. user error
  const isDeveloperError =
    !retryable &&
    errorCode !== RotationErrorCode.AUTHORIZATION_FAILED &&
    errorCode !== RotationErrorCode.CROSS_TENANT_VIOLATION;

  return {
    message,
    code: errorCode,
    isRetryable: retryable,
    isDeveloperError,
  };
}

/**
 * Ensures a value is never logged or exposed if it looks like a secret.
 * Used as a guard in monitoring/telemetry code.
 */
export function isSensitiveValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const str = value.toLowerCase();

  // Check for common patterns that indicate sensitive data
  const sensitiveIndicators = [
    'key',
    'token',
    'secret',
    'password',
    'credential',
    'auth',
    'apikey',
    'api_key',
  ];

  return sensitiveIndicators.some(indicator => str.includes(indicator));
}

/**
 * Creates an error object that's safe for telemetry systems.
 * Strips all sensitive information before sending to error tracking.
 */
export function createTelemetryError(
  error: unknown,
  context: string,
  metadata?: Record<string, unknown>,
): {
  message: string;
  context: string;
  code?: string;
  metadata?: Record<string, unknown>;
} {
  let code: string | undefined;
  let message = '';

  if (error instanceof Error) {
    message = error.message;
    // Try to extract error code if present
    if ('code' in error && typeof error.code === 'string') {
      code = error.code;
    }
  } else if (typeof error === 'string') {
    message = error;
  }

  return {
    message: redactSensitiveData(message),
    context: redactSensitiveData(context),
    code,
    metadata: metadata
      ? Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [
            key,
            typeof value === 'string'
              ? redactSensitiveData(value)
              : value,
          ])
        )
      : undefined,
  };
}

/**
 * HTTP status code to error classification.
 * Used to determine retry strategy based on response status.
 */
export function classifyHttpError(status: number): {
  category: 'client_error' | 'server_error' | 'rate_limit' | 'unknown';
  retryable: boolean;
} {
  if (status >= 400 && status < 500) {
    // Client errors are generally not retryable
    if (status === 429) {
      // Rate limit - retryable with backoff
      return { category: 'rate_limit', retryable: true };
    }
    return { category: 'client_error', retryable: false };
  }

  if (status >= 500 && status < 600) {
    // Server errors are retryable
    return { category: 'server_error', retryable: true };
  }

  return { category: 'unknown', retryable: false };
}
