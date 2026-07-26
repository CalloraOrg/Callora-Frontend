/**
 * ApiDetailStickyTOC.tsx
 *
 * Sticky right-rail Table of Contents for the ApiDetailPage documentation tab.
 * Highlights the active section as the user scrolls using IntersectionObserver.
 *
 * Accessibility: keyboard-navigable anchor links, aria-current="location" on
 * the active item. Under `prefers-reduced-motion: reduce`, color transitions
 * are disabled so active/hover states update instantly (issue #528).
 */

import { useEffect, useRef, useState } from "react";

export interface TocSection {
  id: string;
  label: string;
}

interface ApiDetailStickyTOCProps {
  sections: TocSection[];
}

export function ApiDetailStickyTOC({ sections }: ApiDetailStickyTOCProps) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

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
      { rootMargin: "0px 0px -60% 0px", threshold: 0.1 },
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  // Belt-and-suspenders with the CSS @media rule: inline style wins for
  // environments where the stylesheet media query is not applied in tests.
  const linkTransition = prefersReducedMotion
    ? "none"
    : "color var(--transition-speed) ease";

  return (
    <nav aria-label="On this page" className="api-detail-toc no-print">
      <p className="api-detail-toc__heading">On this page</p>
      <ol className="api-detail-toc__list">
        {sections.map(({ id, label }) => (
          <li key={id} className="api-detail-toc__item">
            <a
              href={`#${id}`}
              aria-current={activeId === id ? "location" : undefined}
              className={
                activeId === id
                  ? "api-detail-toc__link api-detail-toc__link--active"
                  : "api-detail-toc__link"
              }
              style={{ transition: linkTransition }}
            >
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * StickyToc — alias export matching the campaign issue path naming
 * (`src/pages/StickyToc.tsx` re-exports this component).
 */
export { ApiDetailStickyTOC as StickyToc };
