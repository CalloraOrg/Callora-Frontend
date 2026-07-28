/**
 * PreviewCard.tsx — Hover and focus preview card component for dashboard overview elements.
 *
 * GrantFox FWC26 campaign (Issue #689 / b#012) requirement:
 * Provide hover-triggered and keyboard-accessible preview card on DashboardOverview
 * rows/cards so users can preview details (status, metrics, tags, pricing, description)
 * without navigating away.
 *
 * Accessibility (WCAG 2.1 AA):
 * - The trigger receives `aria-describedby` pointing at the preview panel while open.
 * - The preview card has `role="tooltip"` for supplementary info announcement.
 * - Pressing `Escape` closes the preview card cleanly and restores focus position.
 * - Color and styling rely on CSS custom properties (design tokens) for light/dark theme parity.
 */

import { useId, useRef, useState, type ReactNode, type KeyboardEvent, type FocusEvent } from 'react';
import StatusBadge, { type StatusVariant } from './StatusBadge';

export interface PreviewMetric {
  label: string;
  value: string | number;
}

export interface PreviewCardData {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  status?: StatusVariant;
  description?: string;
  metrics?: PreviewMetric[];
  tags?: string[];
  price?: string | number;
  lastActive?: string;
  details?: Record<string, string | number>;
}

export interface PreviewCardProps {
  /** The item details to present in the preview card overlay */
  data: PreviewCardData;
  /** Content acting as trigger for hover/focus */
  children: ReactNode;
  /** Floating overlay placement relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional custom class name */
  className?: string;
}

export function PreviewCard({
  data,
  children,
  position = 'bottom',
  className = '',
}: PreviewCardProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLDivElement>(null);
  const suppressNextFocus = useRef(false);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && open) {
      suppressNextFocus.current = true;
      hide();
      triggerRef.current?.focus();
    }
  };

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case 'top':
        return { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' };
      case 'left':
        return { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' };
      case 'right':
        return { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' };
      case 'bottom':
      default:
        return { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' };
    }
  };

  return (
    <div
      className={['preview-card__wrapper', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <div
        ref={triggerRef}
        className="preview-card__trigger"
        aria-describedby={open ? panelId : undefined}
        onFocus={() => {
          if (suppressNextFocus.current) {
            suppressNextFocus.current = false;
            return;
          }
          show();
        }}
        onBlur={(e: FocusEvent<HTMLDivElement>) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
            hide();
          }
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Preview details for ${data.title}`}
        style={{ cursor: 'pointer', outline: 'none' }}
      >
        {children}
      </div>

      {open && (
        <div
          id={panelId}
          role="tooltip"
          className="preview-card__panel surface"
          aria-label={`${data.title} preview`}
          style={{
            position: 'absolute',
            zIndex: 1000,
            width: '280px',
            maxWidth: '90vw',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--surface, #1e1e2e)',
            border: '1px solid var(--border-color, var(--line, rgba(255, 255, 255, 0.15)))',
            boxShadow: 'var(--shadow, 0 10px 30px rgba(0, 0, 0, 0.3))',
            color: 'var(--text-primary, var(--text, #f9fafb))',
            pointerEvents: 'none',
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            ...getPositionStyles(),
          }}
        >
          {/* Header row: title and status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '6px',
            }}
          >
            <strong
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-primary, var(--text, #ffffff))',
                fontWeight: 600,
              }}
            >
              {data.title}
            </strong>
            {data.status && <StatusBadge status={data.status} />}
          </div>

          {/* Subtitle / Category */}
          {(data.subtitle || data.category) && (
            <p
              style={{
                margin: '0 0 6px 0',
                fontSize: '0.75rem',
                color: 'var(--text-secondary, var(--muted, #9ca3af))',
              }}
            >
              {data.subtitle || data.category}
            </p>
          )}

          {/* Description */}
          {data.description && (
            <p
              style={{
                margin: '0 0 8px 0',
                fontSize: '0.75rem',
                color: 'var(--text-secondary, var(--muted, #cbd5e1))',
              }}
            >
              {data.description}
            </p>
          )}

          {/* Metrics summary */}
          {data.metrics && data.metrics.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
                margin: '8px 0',
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-chip, rgba(255, 255, 255, 0.04))',
              }}
            >
              {data.metrics.map((m) => (
                <div key={m.label} style={{ fontSize: '0.7rem' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)', display: 'block' }}>
                    {m.label}
                  </span>
                  <strong className="tabular-nums numeric-tabular" style={{ color: 'var(--accent, #6366f1)' }}>
                    {m.value}
                  </strong>
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          {data.tags && data.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {data.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-chip, rgba(255, 255, 255, 0.08))',
                    color: 'var(--text-secondary, #cbd5e1)',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer: Price or Last Active */}
          {(data.price !== undefined || data.lastActive) && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px',
                paddingTop: '6px',
                borderTop: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
                fontSize: '0.7rem',
                color: 'var(--text-secondary, #9ca3af)',
              }}
            >
              {data.price !== undefined && (
                <span className="tabular-nums numeric-tabular" style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}>
                  {typeof data.price === 'number' ? `$${data.price} / call` : data.price}
                </span>
              )}
              {data.lastActive && (
                <span>Last active: {data.lastActive}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PreviewCard;
