# ServerError Component Screenshots

## How to Capture Screenshots

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to the demo page**:
   - Add a route in `App.tsx` for `/server-error-demo` that renders `<ServerErrorDemo />`
   - Or temporarily replace any route with `<ServerErrorDemo />`

3. **Capture the following screenshots**:

### Desktop Screenshots (1280px viewport)

- **before-desktop.png**: Original ServerError component (if you have a backup)
- **after-desktop-no-props.png**: Click "No Props" button, capture the component
- **after-desktop-with-retry.png**: Click "With Retry" button, capture the component
- **after-desktop-with-requestid.png**: Click "With Request ID" button, capture the component
- **after-desktop-retrying.png**: Click "Full" button, then click "Try again" button, quickly capture during loading state

### Mobile Screenshots (390px viewport)

Use browser DevTools to set viewport to 390px width:

- **before-mobile.png**: Original ServerError component (if you have a backup)
- **after-mobile-full.png**: "Full" scenario showing retry button + request ID
- **after-mobile-retrying.png**: Click "Try again" and capture during loading state

### Additional Captures

- **after-desktop-copied.png**: Click the "Copy" button next to request ID and capture the "Copied!" state

## Browser DevTools Tips

### Chrome/Edge
1. Press F12 to open DevTools
2. Click the device toolbar icon (or Ctrl+Shift+M)
3. Select "Responsive" and set width to 390px or 1280px
4. Take screenshot: Ctrl+Shift+P → "Capture screenshot"

### Firefox
1. Press F12 to open DevTools
2. Click the responsive design mode icon (or Ctrl+Shift+M)
3. Set dimensions to 390px or 1280px
4. Take screenshot: Right-click → "Take Screenshot"

## File Naming Convention

All screenshots should be saved in this directory with the exact names listed above:

- `before-desktop.png`
- `before-mobile.png`
- `after-desktop-no-props.png`
- `after-desktop-with-retry.png`
- `after-desktop-with-requestid.png`
- `after-desktop-retrying.png`
- `after-mobile-full.png`
- `after-mobile-retrying.png`
- `after-desktop-copied.png` (optional)

## Notes

- Ensure the theme (light/dark) is consistent across all screenshots
- Capture the full component including padding/margins
- For "retrying" states, you may need to be quick or increase the timeout in the demo component
