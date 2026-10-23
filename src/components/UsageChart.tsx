import React from 'react';

export interface UsageChartProps {
  /** Accessible label for the chart */
  label?: string;
  /** Chart title */
  title?: string;
  /** Alt text for the chart image */
  alt?: string;
}

/**
 * UsageChart displays usage statistics with responsive images using srcset.
 * Mobile devices download smaller image assets while desktop devices get larger ones.
 *
 * Part of GrantFox FWC26 (Stellar Wave) responsive image optimization.
 */
export default function UsageChart({
  label = 'Usage Chart',
  title = 'Usage Statistics',
  alt = 'Usage statistics chart showing API call trends',
}: UsageChartProps) {
  return (
    <div className="usage-chart" aria-label={label}>
      <h3 className="usage-chart__title">{title}</h3>
      <div className="usage-chart__illustration" aria-hidden="true">
        <picture>
          <source
            srcSet="/images/usage-chart-sm.svg"
            media="(max-width: 480px)"
          />
          <source
            srcSet="/images/usage-chart-md.svg"
            media="(max-width: 960px)"
          />
          <source
            srcSet="/images/usage-chart-lg.svg"
            media="(min-width: 961px)"
          />
          <img
            src="/images/usage-chart-md.svg"
            alt={alt}
            className="usage-chart__img"
            loading="lazy"
            width="400"
            height="250"
          />
        </picture>
      </div>
    </div>
  );
}
