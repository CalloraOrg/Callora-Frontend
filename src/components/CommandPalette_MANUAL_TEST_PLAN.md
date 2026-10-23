# Command Palette Manual Test Plan

## Setup
- [ ] Ensure the application is running locally (`npm run dev`)
- [ ] Open the browser console to verify there are no exceptions or errors

## 1. Visual Verification & Layout
- [ ] Press `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) to trigger the palette.
- [ ] Verify the overlay backdrop displays a dark semi-transparent color with a blur effect (`backdrop-filter`).
- [ ] Verify the palette dialog is horizontally and vertically centered at the top of the viewport.
- [ ] Toggle themes using the palette commands and verify that styles resolve instantly under both **Light** and **Dark** themes.
- [ ] Verify font faces and colors match the Callora design token system.

## 2. Keyboard Control & Navigation
- [ ] Open the palette. The search input should be automatically focused.
- [ ] Use `ArrowDown` and `ArrowUp` keys:
  - [ ] Verify that selection indicators move down and up the list items.
  - [ ] Verify selection cycles back to the top when reaching the end, and vice-versa.
  - [ ] Verify that the selected item scrolls into view if the item list overflows the container height.
- [ ] Press `Escape`:
  - [ ] Verify that the Command Palette immediately closes.
- [ ] Press `Tab`:
  - [ ] Verify focus moves sequentially between the input field, the Clear search button (if text exists), and the Close button.
  - [ ] Verify focus is trapped inside the palette (cannot focus elements in the page backdrop).
- [ ] Verify that focus is restored to the element that was focused before the palette was opened.

## 3. Dynamic Search & Filters
- [ ] Search for standard routes (e.g., "Marketplace", "Dashboard", "Billing").
  - [ ] Verify that standard navigation items are filtered and displayed properly.
- [ ] Search for mock APIs (e.g., "weather", "QuickPay", "ChatStream").
  - [ ] Verify the matching APIs appear under the **APIs** section as "Jump to [API Name]".
- [ ] Search for an query with no matches:
  - [ ] Verify a clean empty state "No results found" is rendered.

## 4. Navigation & Modals Integration
- [ ] Navigate from the Dashboard to the Marketplace page using the palette:
  - [ ] Verify that the URL changes to `/marketplace` and the Marketplace page mounts and transitions correctly.
- [ ] Select the **Open Deposit modal** command:
  - [ ] Verify the application navigates to the Billing view (`/billing?deposit=true`).
  - [ ] Verify the Deposit modal dialog automatically opens.
  - [ ] Close the deposit modal. Verify that the `?deposit=true` query parameter is successfully stripped from the address bar.

## 5. Reduced Motion
- [ ] Enable "Reduce Motion" in your operating system settings.
- [ ] Open the Command Palette:
  - [ ] Verify that transition slide-down animations are disabled, displaying the palette instantly.
