# StatusIndicator high-contrast support

The API usage status badge now exposes explicit high-contrast overrides when the user prefers more contrast (`prefers-contrast: more`).

## What changed
- Added a reusable StatusIndicator component for the active API status badge.
- Added contrast-specific border, background, and text overrides in the shared contrast stylesheet.
- Added focused tests covering the component markup and the contrast-style class contract.

## Accessibility impact
- The badge remains readable under forced high-contrast settings without relying on low-opacity color cues alone.
- The component keeps its role as a status region for assistive technology.
