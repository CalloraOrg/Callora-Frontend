# Callora Documentation Index

Welcome to the Callora Frontend documentation directory. This index groups all architecture notes, component specifications, accessibility write-ups, error handling guides, and theming documentation across the codebase.

---

## Table of Contents

- [Core Design System & Theming](#core-design-system--theming)
- [Components & UI Features](#components--ui-features)
- [Accessibility & Motion](#accessibility--motion)
- [Error Handling](#error-handling)
- [State, Data & Performance](#state-data--performance)

---

## Core Design System & Theming

Architecture notes, design token definitions, contrast specifications, and typography styling for the Callora UI.

- [Callora UI Design System](./UI-Design-System.md) — Comprehensive guide to design tokens, color palette, typography scale, spacing, iconography, and core UI component specifications.
- [Code Sample Dark Theme](./code-dark-theme-description.md) — Dark mode CSS token styling and syntax block variants for code snippet displays.
- [High-Contrast Status Indicators](./StatusIndicator-high-contrast.md) — High-contrast theme overrides (`prefers-contrast: more`) and distinct textural indicators for status badges.
- [Tabular Numerals in Marketplace](./tabular-nums-marketplace.md) — Monospace tabular numeral alignment (`font-variant-numeric: tabular-nums`) across marketplace pricing and stats.
- [Tabular Numerals in SearchInput](./tabular-nums-search-input.md) — Tabular numeral formatting applied to count badges and currency values in search inputs to prevent layout shifts.
- [ReviewsTab Print Styles](./ReviewsTab-print.md) — Print stylesheet rules and media queries for cleanly printing review tabs without UI chrome.

---

## Components & UI Features

Documentation, usage guidelines, and visual specifications for individual Callora UI components.

- [BillingHistory Preview Card](./BillingHistoryPreview.md) — Hover and focus preview cards for billing transactions and stellar settlement history.
- [BottomSheet Component](./BottomSheet-drag-handle.md) — Reusable bottom-sheet dialog featuring a visible pill drag handle, multi-point snap behavior, and focus trapping.
- [CodeExample Mobile Responsive Layout](./CodeExample-mobile-responsive.md) — Mobile responsive adaptations and horizontal scroll management for multi-language code snippets.
- [DashboardOverview Preview Card](./DashboardOverview-PreviewCard.md) — Interactive hover and keyboard-focus preview cards for developer dashboard overview metrics.
- [DateRangePicker](./DateRangePicker.md) — Accessible date range selection component with preset ranges, keyboard navigation, and input validation.
- [Dropdown](./Dropdown.md) — Custom accessible dropdown select primitive supporting keyboard navigation and custom option rendering.
- [FiltersSidebar Collapse Persistence](./filters-collapse-description.md) — Collapsible filter categories in `FiltersSidebar` with automatic `localStorage` persistence.
- [FiltersSidebar Mobile Bottom Sheet](./FiltersSidebar-mobile-bottom-sheet.md) — Mobile drawer and bottom-sheet integration for marketplace filtering controls.
- [Header Middle-Ellipsis Breadcrumb](./Header-Breadcrumb.md) — Middle-truncation ellipsis support and accessible popup menu for deep breadcrumb hierarchies.
- [MethodChip Responsive Badges](./MethodChip-responsive-fwc26.md) — Responsive HTTP method badge styling (GET, POST, etc.) with contrast compliance.
- [PricingTable Keyboard Shortcut Hint](./PricingTable-KbdHint.md) — Subtle keyboard shortcut hint chip displayed on pricing table plan selection cards.
- [QuotaBanner Empty State](./QuotaBanner-EmptyState.md) — Themed empty-state illustration and action CTA for `QuotaBanner` when no quota is configured.
- [QuotaBanner & KbdHint Enhancement](./QuotaBanner-KbdHint.md) — Accessible keyboard shortcut chips, interactive states, and usage gauge integration for `QuotaBanner`.
- [RatingHistogram](./RatingHistogram.md) — Five-star rating distribution breakdown tooltip triggered by hover, focus, or long-press.
- [RecentlyActiveRail](./RecentlyActiveRail.md) — Horizontally scrollable rail highlighting recently active and trending marketplace APIs.
- [RequestBodyEditor](./RequestBodyEditor.md) — Controlled JSON request body editor with real-time schema validation and inline error diagnostics.
- [Response Diff Highlighting](./ResponseDiff.md) — Side-by-side and raw line-level diff highlighting for comparing API responses in call history.
- [SLA Card Copy to Clipboard](./SlaCard-CopyToClipboard.md) — Per-metric copy-to-clipboard functionality with live feedback for the GrantFox Wave Compute SLA page.
- [SubscribeCTA Icon Buttons with Tooltip](./SubscribeCTA-icon-buttons-tooltip.md) — Accessible tooltip wiring and long-press support for icon-only action buttons (share, bookmark).
- [Tabs Component](./Tabs.md) — Accessible tab strip component featuring a smooth geometry-measured sliding ink-bar indicator.
- [UsageChart Responsive Srcset](./UsageChart-responsive-srcset.md) — Responsive image `srcset` and `sizes` implementation for bandwidth-optimized charts on mobile screens.

---

## Accessibility & Motion

Screen reader announcements, `aria-live` region design, and `prefers-reduced-motion` compliance across interactive features.

- [ApiTagFilter Reduced-Motion Fallback](./api-tag-filter-reduced-motion.md) — Graceful reduced-motion fallbacks for `ApiTagFilter` chip animations when `prefers-reduced-motion` is active.
- [ApiUsage aria-live Status Announcements](./api-usage-aria-live-description.md) — Centralized `aria-live` polite announcement region on `ApiUsage` for endpoint selection, filter changes, and copy events.
- [ApiUsage Reduced-Motion Fallback](./api-usage-reduced-motion-fallback.md) — Reduced-motion CSS transition fallbacks for `ApiUsage` views and interactive controls.
- [CallHistoryRow aria-live Status Announcements](./call-history-row-aria-live.md) — Politeness settings and screen reader announcements for call history row expansions and status changes.
- [Reduced-Motion Data Transitions](./data-transitions-reduced-motion.md) — Global reduced-motion support across data transitions, loading skeletons, spinners, and route progress bars.

---

## Error Handling

Architecture notes, implementation summaries, migration guides, and verification checklists for application error states.

- [ServerError Implementation Summary](./ServerError-Implementation-Summary.md) — Architectural overview, mobile-first redesign, and accessibility specifications for the 500 error page component.
- [ServerError Migration Guide](./ServerError-Migration-Guide.md) — Migration instructions, prop deprecations, and breaking change guide for updating to the new `ServerError` component.
- [ServerError Review Checklist](./ServerError-Review-Checklist.md) — Comprehensive verification checklist covering error handling, retry states, contrast, and assistive technology requirements.
- [ServerError Screenshots](./screenshots/server-error/README.md) — Guide and reference captures for light, dark, and mobile viewport states of the `ServerError` component.

---

## State, Data & Performance

State management, query parameter snapshotting, user preferences, and performance optimizations.

- [Default Code Language Preference](./default-code-language-description.md) — User preference storage module for persisting and defaulting code snippet languages across views.
- [Optimistic UI PlanBadge](./optimistic-ui-planbadge.md) — Optimistic UI state transitions and immediate user feedback when upgrading or selecting plan badges.
- [Snapshot URL Export](./snapshot-url-description.md) — Shareable URL generation capturing active endpoint selection and encoded query parameters.
- [Virtualized Call History Table](./VirtualizedCallHistory.md) — Windowed virtualization implementation for the API call history table to maintain 60fps performance with large datasets.
