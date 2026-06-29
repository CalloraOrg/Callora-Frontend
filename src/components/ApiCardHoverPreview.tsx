/**
 * ApiCardHoverPreview.tsx
 *
 * A floating preview card shown on hover over an ApiCard.
 * Displays description, endpoint count, pricing, and tags.
 */

import React from 'react';
import type { APIItem } from '../data/mockApis';
import { formatPrice } from '../utils/format';

interface ApiCardHoverPreviewProps {
  api: APIItem;
  anchorRect: DOMRect;
}

export function ApiCardHoverPreview({ api, anchorRect }: ApiCardHoverPreviewProps) {
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.top,
    left: anchorRect.right + 8,
    zIndex: 9999,
    width: 280,
    background: '#1e1e2e',
    border: '1px solid #333',
    borderRadius: 10,
    padding: '14px 16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
  };

  return (
    <div style={style} role="tooltip" aria-label={`Preview of ${api.name}`}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: '#fff' }}>{api.name}</p>
      {api.description && (
        <p style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>{api.description}</p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {(api.tags ?? []).slice(0, 4).map((tag) => (
          <span key={tag} style={{ fontSize: 11, background: '#2a2a3a', borderRadius: 4, padding: '2px 6px', color: '#ccc' }}>
            {tag}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#7ee8a2', fontWeight: 500 }}>
        {api.pricing ? formatPrice(api.pricing) : 'Free'}
      </div>
    </div>
  );
}

export function useHoverPreview() {
  const [hovered, setHovered] = React.useState<{ api: APIItem; rect: DOMRect } | null>(null);

  const onMouseEnter = React.useCallback((api: APIItem, e: React.MouseEvent<HTMLElement>) => {
    setHovered({ api, rect: e.currentTarget.getBoundingClientRect() });
  }, []);

  const onMouseLeave = React.useCallback(() => {
    setHovered(null);
  }, []);

  return { hovered, onMouseEnter, onMouseLeave };
}
