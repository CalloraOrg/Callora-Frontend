/**
 * ApiDetailStickyTOC.tsx
 *
 * Sticky right-rail Table of Contents for the ApiDetailPage.
 * Highlights the active section as the user scrolls.
 */

import React, { useEffect, useRef, useState } from 'react';

export interface TocSection {
  id: string;
  label: string;
}

interface ApiDetailStickyTOCProps {
  sections: TocSection[];
}

export function ApiDetailStickyTOC({ sections }: ApiDetailStickyTOCProps) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost visible heading.
          const topEntry = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
          );
          setActiveId(topEntry.target.id);
        }
      },
      { rootMargin: '0px 0px -60% 0px', threshold: 0.1 },
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Page sections"
      style={{
        position: 'sticky',
        top: 80,
        alignSelf: 'start',
        width: 200,
        paddingLeft: 16,
        borderLeft: '2px solid #2a2a3a',
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#888', marginBottom: 10, letterSpacing: '0.08em' }}>
        On this page
      </p>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {sections.map(({ id, label }) => (
          <li key={id} style={{ marginBottom: 6 }}>
            <a
              href={`#${id}`}
              aria-current={activeId === id ? 'location' : undefined}
              style={{
                fontSize: 13,
                color: activeId === id ? '#7ee8a2' : '#999',
                fontWeight: activeId === id ? 600 : 400,
                textDecoration: 'none',
                display: 'block',
                padding: '2px 0',
                transition: 'color 0.15s',
              }}
            >
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
