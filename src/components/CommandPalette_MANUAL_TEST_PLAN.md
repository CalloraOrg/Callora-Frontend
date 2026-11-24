# Command Palette Manual Test Plan

## Setup
- [ ] Ensure the application is running locally (`npm run dev`)
- [ ] Open the browser console to verify there are no exceptions or errors

## 1. Mounting & Global Shortcut
- [ ] On any page in the app shell (Dashboard, Marketplace, Billing, etc.), press `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) to open the palette.
- [ ] Press `Cmd+K` / `Ctrl+K` again and verify the palette closes.
- [ ] Focus the Marketplace search input (or any form field), press `Cmd+K` / `Ctrl+K`, and verify the palette opens without triggering the browser's default shortcut.
- [ ] Press `?` to open the Shortcuts modal and verify `Cmd/Ctrl + K` ("Open command palette") is listed under **Global**.

## 2. Visual Verification & Layout
- [ ] Verify the overlay backdrop displays a dark semi-transparent color with a blur effect (`backdrop-filter`).
- [ ] Verify the palette dialog is horizontally and vertically centered at the top of the viewport.
- [ ] Toggle themes using the palette commands and verify that styles resolve instantly under both **Light** and **Dark** themes.
- [ ] Verify font faces and colors match the Callora design token system.

## 3. Keyboard Control & Navigation
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

## 4. Live Catalogue Loading & Dynamic Search
- [ ] Open the palette for the first time and verify a loading row appears while the catalogue request is in flight, while static navigation commands remain usable.
- [ ] Verify APIs from the live catalogue (or bundled sample when `API_BASE` is empty) appear under the **APIs** section as "Jump to [API Name]".
- [ ] Close and reopen the palette and verify the catalogue is not refetched (cached in component state).
- [ ] Simulate a failed catalogue request and verify an error row ("Could not load APIs") is shown while static navigation commands remain usable.
- [ ] Search for standard routes (e.g., "Marketplace", "Dashboard", "Billing") and verify filtering works.
- [ ] Search for a query with no matches and verify "No results found" is rendered.

## 5. Navigation & Modals Integration
- [ ] Select an API command and verify the app navigates to `/details/:id`, closes the palette, and restores focus to the previously focused element.
- [ ] Navigate from the Dashboard to the Marketplace page using the palette:
  - [ ] Verify that the URL changes to `/marketplace` and the Marketplace page mounts and transitions correctly.
- [ ] Select the **Open Deposit modal** command:
  - [ ] Verify the application navigates to the Billing view (`/billing?deposit=true`).
  - [ ] Verify the Deposit modal dialog automatically opens.
  - [ ] Close the deposit modal. Verify that the `?deposit=true` query parameter is successfully stripped from the address bar.

## 6. Reduced Motion
- [ ] Enable "Reduce Motion" in your operating system settings.
- [ ] Open the Command Palette:
  - [ ] Verify that transition slide-down animations are disabled, displaying the palette instantly.
