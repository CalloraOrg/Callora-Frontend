# ServerError Component - Migration Guide

## Quick Start

The ServerError component has been redesigned with a simpler, more flexible API. This guide will help you update existing usage.

## Breaking Changes

### 1. `onGoHome` prop removed

**Before:**
```typescript
<ServerError 
  onRetry={handleRetry} 
  onGoHome={handleGoHome}  // ❌ No longer supported
/>
```

**After:**
```typescript
<ServerError 
  onRetry={handleRetry}  // ✅ Only retry is needed
/>
```

**Rationale:** Error recovery should focus on retrying the failed operation. Users can use browser navigation or the main nav if they want to leave the error page.

### 2. Component is now a default export

**Before:**
```typescript
import { ServerError } from './components/ServerError';
```

**After:**
```typescript
import ServerError from './components/ServerError';
```

### 3. No longer wraps `ErrorPage`

The component is now self-contained and doesn't use the `ErrorPage` wrapper. If you were using `ErrorPage` directly, you'll need to update those usages separately.

## New Features

### 1. Request ID Support

Add a request ID for support traceability:

```typescript
<ServerError 
  onRetry={handleRetry}
  requestId="REF-2026-04-29-A7F3B2C1"
/>
```

The request ID will be displayed with a copy-to-clipboard button.

### 2. Custom Copy

Override the default title and description:

```typescript
<ServerError 
  onRetry={handleRetry}
  title="Service temporarily unavailable"
  description="We're performing scheduled maintenance. Please check back in a few minutes."
/>
```

### 3. Async Retry Support

The `onRetry` callback now supports async functions:

```typescript
const handleRetry = async () => {
  await refetchData();
  navigate('/dashboard');
};

<ServerError onRetry={handleRetry} />
```

The component will show a loading state ("Retrying…") while the async operation is in progress.

### 4. All Props Optional

You can now render the component with no props:

```typescript
<ServerError />
```

This will show the default error message without any action buttons.

## Migration Examples

### Example 1: Basic Error Page

**Before:**
```typescript
import { ServerError } from './components/ServerError';

function ErrorRoute() {
  const navigate = useNavigate();
  
  return (
    <ServerError
      onRetry={() => window.location.reload()}
      onGoHome={() => navigate('/')}
    />
  );
}
```

**After:**
```typescript
import ServerError from './components/ServerError';

function ErrorRoute() {
  return (
    <ServerError
      onRetry={() => window.location.reload()}
    />
  );
}
```

### Example 2: API Error with Request ID

**Before:**
```typescript
import { ServerError } from './components/ServerError';

function ApiErrorPage({ error }) {
  const navigate = useNavigate();
  
  return (
    <ServerError
      onRetry={() => refetch()}
      onGoHome={() => navigate('/')}
    />
  );
}
```

**After:**
```typescript
import ServerError from './components/ServerError';

function ApiErrorPage({ error }) {
  return (
    <ServerError
      onRetry={() => refetch()}
      requestId={error.requestId}
    />
  );
}
```

### Example 3: Custom Error Message

**Before:**
```typescript
import { ServerError } from './components/ServerError';

function MaintenancePage() {
  const navigate = useNavigate();
  
  return (
    <ServerError
      onRetry={() => window.location.reload()}
      onGoHome={() => navigate('/')}
    />
  );
}
```

**After:**
```typescript
import ServerError from './components/ServerError';

function MaintenancePage() {
  return (
    <ServerError
      onRetry={() => window.location.reload()}
      title="Scheduled maintenance"
      description="We're upgrading our systems to serve you better. This should only take a few minutes."
    />
  );
}
```

### Example 4: Async Retry with Loading State

**New capability:**
```typescript
import ServerError from './components/ServerError';

function DataErrorPage() {
  const { refetch } = useQuery();
  const navigate = useNavigate();
  
  const handleRetry = async () => {
    const result = await refetch();
    if (result.isSuccess) {
      navigate('/dashboard');
    }
  };
  
  return (
    <ServerError
      onRetry={handleRetry}
      requestId="REF-2026-04-29-A7F3B2C1"
    />
  );
}
```

## Updating App.tsx

If you have a route like this in App.tsx:

**Before:**
```typescript
import { ServerError } from './components/ServerError';

// In your Routes:
<Route
  path="/500"
  element={
    <ServerError
      onRetry={() => window.location.reload()}
      onGoHome={() => navigate('/')}
    />
  }
/>
```

**After:**
```typescript
import ServerError from './components/ServerError';

// In your Routes:
<Route
  path="/500"
  element={
    <ServerError
      onRetry={() => window.location.reload()}
    />
  }
/>
```

## Testing Your Migration

After updating your code:

1. **Visual check**: Navigate to your error page and verify it renders correctly
2. **Retry functionality**: Click the retry button and verify it works
3. **Mobile check**: Test at 390px viewport width
4. **Keyboard navigation**: Tab to the retry button and press Enter
5. **Screen reader**: Verify the error is announced (use browser DevTools)

## Common Issues

### Issue: "onGoHome is not a prop"

**Solution:** Remove the `onGoHome` prop. If you need navigation, handle it in the `onRetry` callback after a successful retry.

### Issue: Import error

**Solution:** Change from named import to default import:
```typescript
// ❌ Wrong
import { ServerError } from './components/ServerError';

// ✅ Correct
import ServerError from './components/ServerError';
```

### Issue: Component doesn't show retry button

**Solution:** Make sure you're passing the `onRetry` prop:
```typescript
<ServerError onRetry={handleRetry} />
```

### Issue: Request ID not showing

**Solution:** Make sure you're passing a non-empty `requestId` prop:
```typescript
<ServerError 
  onRetry={handleRetry}
  requestId="REF-2026-04-29-A7F3B2C1"  // Must be non-empty string
/>
```

## Need Help?

- See `src/components/MANUAL_TEST_PLAN.md` for testing checklist
- See `src/components/ServerErrorDemo.tsx` for usage examples
- See `docs/ServerError-Implementation-Summary.md` for full technical details

## Rollback Plan

If you need to rollback to the old component:

1. Restore the old `ServerError.tsx` from git history:
   ```bash
   git checkout HEAD~1 -- src/components/ServerError.tsx
   ```

2. Update your imports back to named imports:
   ```typescript
   import { ServerError } from './components/ServerError';
   ```

3. Add back the `onGoHome` prop to all usages
