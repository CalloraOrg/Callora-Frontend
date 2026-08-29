import { useEffect, useState, type MouseEvent } from "react";
import "./ApiDetailStickyTOC.css";

export interface TocSection { id: string; label: string; }
interface ApiDetailStickyTOCProps { sections: TocSection[]; }
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const compactTocQuery = "(max-width: 1023px)";

/** Accessible, responsive in-page navigation for API detail sections. */
export function ApiDetailStickyTOC({ sections }: ApiDetailStickyTOCProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia(reducedMotionQuery);
    const compactToc = window.matchMedia(compactTocQuery);
    const syncPreferences = () => { setPrefersReducedMotion(reducedMotion.matches); setIsCompact(compactToc.matches); };
    syncPreferences();
    reducedMotion.addEventListener("change", syncPreferences);
    compactToc.addEventListener("change", syncPreferences);
    return () => { reducedMotion.removeEventListener("change", syncPreferences); compactToc.removeEventListener("change", syncPreferences); };
  }, []);

  useEffect(() => {
    if (!sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visibleEntries = entries.filter((entry) => entry.isIntersecting);
      if (!visibleEntries.length) return;
      const closestToTop = visibleEntries.reduce((closest, entry) => entry.boundingClientRect.top < closest.boundingClientRect.top ? entry : closest);
      setActiveId(closestToTop.target.id);
    }, { rootMargin: "-12% 0px -65% 0px", threshold: [0, 0.1, 0.5] });
    sections.forEach(({ id }) => { const section = document.getElementById(id); if (section) observer.observe(section); });
    return () => observer.disconnect();
  }, [sections]);

  if (!sections.length) return null;
  const jumpToSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const section = document.getElementById(id);
    if (!section) return;
    window.history.replaceState(null, "", `#${id}`);
    if (typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    }
    setActiveId(id);
    // Move focus to the target heading so keyboard and screen-reader users
    // land on the referenced section (deterministic in-page navigation).
    section.setAttribute("tabindex", "-1");
    section.focus();
  };
  const links = <ol className="api-detail-toc__list">{sections.map(({ id, label }) => {
    const isActive = activeId === id;
    return <li key={id} className="api-detail-toc__item"><a href={`#${id}`} aria-current={isActive ? "location" : undefined} className={isActive ? "api-detail-toc__link api-detail-toc__link--active" : "api-detail-toc__link"} style={{ transition: prefersReducedMotion ? "none" : "color 200ms ease" }} onClick={(event) => jumpToSection(event, id)}>{label}</a></li>;
  })}</ol>;
  if (isCompact) return <details className="api-detail-toc api-detail-toc--compact no-print"><summary className="api-detail-toc__heading">On this page</summary>{links}</details>;
  return <nav aria-label="On this page" className="api-detail-toc no-print"><p className="api-detail-toc__heading">On this page</p>{links}</nav>;
}

export { ApiDetailStickyTOC as StickyToc };
