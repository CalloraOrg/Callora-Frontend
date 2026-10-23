# Secure Error Handling Guidelines

This document outlines the usage of `SecureErrorHandler` to prevent leaking sensitive data (API keys, tokens, user IDs, etc.) into logs, error telemetry, network responses, and the UI.

## Golden Rule

**NEVER use raw `console.error` for API errors or unhandled exceptions.**
Always use `logError` or another `SecureErrorHandler` utility to automatically redact sensitive information before logging.

## SENSITIVE_PATTERNS Categories & Known False Positives

Our redaction system automatically masks data matching the following categories:

| Category | Description | Known False Positives |
|---|---|---|
| **API Keys** | Prefixes like `ck_live_`, `sk_`, `pk_` | Harmless IDs starting with these strings |
| **Bearer Tokens** | `Bearer ...` strings | N/A |
| **Session/JWT Tokens** | Dot-separated strings matching JWT format | Some filenames, dot-separated identifiers |
| **Email Addresses** | Standard email formats | None typically |
| **Credentials in URLs** | `https://user:pass@host` format | N/A |
| **Passwords** | `password: ...`, `pwd=...` | Contextual usage of the word "password" |
| **Database Credentials** | `username=...`, `user: ...` | Contextual usage of the word "username" |
| **API Keys in URLs** | Query parameters like `?api_key=...` | N/A |
| **Credit Card Numbers** | 16-digit sequences | Long IDs or formatting of non-sensitive IDs |
| **Phone Numbers** | Standard phone number formats | Serial numbers or non-sensitive numeric IDs |

## Exported Helpers

### `logError(context, error, metadata)`
Use this instead of `console.error` for sensitive operations. It automatically redacts the error and metadata.
```ts
import { logError } from '../services/SecureErrorHandler';

// DO
logError('AuthService', error, { userId: user.id, email: user.email });

// DON'T
// console.error('AuthService failed for email: ' + user.email, error);
```

### `redactSensitiveData(textOrError)`
Redacts sensitive data from a string or error object.
```ts
import { redactSensitiveData } from '../services/SecureErrorHandler';

// DO
const safeString = redactSensitiveData(rawErrorMessage);
```

### `getSafeErrorMessage(error, errorCode, fallback)`
Gets a generic error message safe to display in the UI without leaking implementation details.
```ts
import { getSafeErrorMessage } from '../services/SecureErrorHandler';

// DO
const message = getSafeErrorMessage(error, 'UNAUTHORIZED');
```

### `formatErrorForUI(error, errorCode)`
Returns a structured error containing a safe message, code, and retryability status for the UI.
```ts
import { formatErrorForUI } from '../services/SecureErrorHandler';

// DO
const formattedError = formatErrorForUI(apiError, response.status);
if (formattedError.isRetryable) {
  // Show retry button
}
```

### `createTelemetryError(error, context, metadata)`
Creates an error object ready to be sent to external tracking services (like Sentry), with all data scrubbed.
```ts
import { createTelemetryError } from '../services/SecureErrorHandler';

// DO
const telemetryData = createTelemetryError(error, 'CheckoutSubmit', { cartId });
// captureException(telemetryData);
```

### `classifyHttpError(status)`
Determines if an HTTP error code is a client error, server error, or rate limit, and if it's retryable.
```ts
import { classifyHttpError } from '../services/SecureErrorHandler';

// DO
const classification = classifyHttpError(503);
if (classification.retryable) {
  // Execute retry logic
}
```

## Do's and Don'ts

### UI
* **DO**: Map backend errors to safe messages using `formatErrorForUI` or `getSafeErrorMessage`.
* **DON'T**: Expose raw API responses or error strings directly to `<div>{error.message}</div>`.

### Logs
* **DO**: Use `logError` for any error logging, especially where user input or authentication is involved.
* **DON'T**: Write raw errors using `console.error(error)` which can leak session tokens or API keys to local or cloud logs.

### Telemetry
* **DO**: Strip sensitive data using `createTelemetryError` before pushing to an observability platform.
* **DON'T**: Send un-redacted request bodies or full error stacks into Sentry or Datadog without sanitization.
