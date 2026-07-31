/**
 * LoginPage aria-live status announcements — issue #530 (GrantFox FWC26).
 *
 * Screen-reader-friendly announcement of LoginPage status changes via a
 * polite aria-live region (`role="status"`, `aria-live="polite"`).
 */

## Summary

`LoginPage` announces submitting, success, and error status changes through
the shared `LiveRegion` component so assistive technology users hear feedback
without depending on the visible status banner alone.

## Files changed

| File | Change |
|---|---|
| `src/pages/LoginPage.tsx` | New mock sign-in page with polite `aria-live` status announcements |
| `src/pages/LoginPage.test.tsx` | Focused tests for live-region announcements and form status flow |
| `src/App.tsx` | Registers `/login` route and document title/description |
| `README.md` | Documents the `/login` route |

## API / visible changes

- **New route:** `/login` — mock email/password sign-in (no backend auth)
- No network/API contract changes
- Visible status banner mirrors live-region messages for sighted users
- On success, navigates to `/dashboard` after a short delay

## Accessibility

- Uses `LiveRegion` with `aria-live="polite"`, `role="status"`, `aria-atomic="true"`
- Announces: validation prompts, submitting, success, and failure (with detail)
- Submit control exposes `aria-busy` while in flight
- Focus moves to the status banner after submit for keyboard users
- Labels, `aria-invalid`, and `aria-describedby` on form fields
