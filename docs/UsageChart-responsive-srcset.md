# UsageChart Responsive Image Implementation

## Summary
Added responsive image srcset support to the new UsageChart component to optimize mobile device performance by preventing download of desktop-sized assets.

## Changes Made

### New Component: UsageChart
- **File**: `src/components/UsageChart.tsx`
- **Purpose**: Display usage statistics with responsive images using srcset
- **Features**:
  - Responsive image loading with three breakpoints:
    - Small (≤480px): `/images/usage-chart-sm.svg`
    - Medium (≤960px): `/images/usage-chart-md.svg`
    - Large (≥961px): `/images/usage-chart-lg.svg`
  - Lazy loading for performance
  - Accessible with proper ARIA labels
  - Follows the same pattern as existing PlanNudge component

### Integration
- **File**: `src/pages/ApiUsage.tsx`
- Replaced CSS-based bar chart with UsageChart component in the "Calls Over Time" section
- Maintains existing layout and styling

### Tests
- **File**: `src/components/UsageChart.test.tsx`
- **Coverage**:
  - Default and custom props rendering
  - Responsive srcset verification
  - Fallback img attributes
  - CSS class application
  - Accessibility attributes

## API Changes

### New Component Props
```typescript
export interface UsageChartProps {
  label?: string;    // Accessible label for the chart (default: "Usage Chart")
  title?: string;    // Chart title (default: "Usage Statistics")
  alt?: string;      // Alt text for the chart image (default: "Usage statistics chart showing API call trends")
}
```

### Visible Changes
- **ApiUsage Page**: The "Calls Over Time" section now displays the UsageChart component instead of CSS-based bar chart
- **Mobile Performance**: Mobile devices will download smaller image assets instead of desktop-sized versions

## Image Assets Required
The following image files need to be added to `/public/images/`:
- `usage-chart-sm.svg` - Small version for mobile (≤480px)
- `usage-chart-md.svg` - Medium version for tablets (≤960px)
- `usage-chart-lg.svg` - Large version for desktop (≥961px)

## Browser Support
Uses standard HTML5 `<picture>` element with `srcset` and `media` attributes, supported by all modern browsers.

## Performance Impact
- **Mobile**: Reduced bandwidth usage by downloading smaller images
- **Desktop**: No change - downloads appropriate large images
- **Loading**: Lazy loading implemented for deferred image loading

## Testing
Run tests with:
```bash
npm test -- UsageChart.test.tsx
```

## Part of GrantFox FWC26 (Stellar Wave)
This implementation is part of the GrantFox FWC26 campaign focused on responsive image optimization for better mobile performance.
