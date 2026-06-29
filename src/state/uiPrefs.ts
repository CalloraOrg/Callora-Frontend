// src/state/uiPrefs.ts

export type DensityPreference = "comfortable" | "compact";

const DENSITY_STORAGE_KEY = "callora.density";

export function getDensityPreference(): DensityPreference {
  if (typeof window === "undefined") {
    return "comfortable";
  }

  const value = window.localStorage.getItem(DENSITY_STORAGE_KEY);

  return value === "compact" ? "compact" : "comfortable";
}

export function setDensityPreference(
  density: DensityPreference,
): DensityPreference {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  }

  return density;
}

// Collapsed sections persistence for FiltersSidebar
const COLLAPSED_SECTIONS_KEY = "callora.filters.collapsed";
const FILTER_SECTIONS = ["categories", "price", "popularity"] as const;
type FilterSection = (typeof FILTER_SECTIONS)[number];

function areCollapsible(filterSection: string): filterSection is FilterSection {
  return FILTER_SECTIONS.includes(filterSection as FilterSection);
}

function getStoredCollapsedSections(): Set<FilterSection> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const stored = window.localStorage.getItem(COLLAPSED_SECTIONS_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter(areCollapsible));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function storeCollapsedSections(sections: Set<FilterSection>): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        COLLAPSED_SECTIONS_KEY,
        JSON.stringify(Array.from(sections)),
      );
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }
}

export function isSectionCollapsed(section: FilterSection): boolean {
  return getStoredCollapsedSections().has(section);
}

export function toggleSectionCollapsed(section: FilterSection): boolean {
  const collapsed = getStoredCollapsedSections();
  if (collapsed.has(section)) {
    collapsed.delete(section);
  } else {
    collapsed.add(section);
  }
  storeCollapsedSections(collapsed);
  return collapsed.has(section);
}

export function setSectionCollapsed(section: FilterSection, collapsed: boolean): void {
  const sections = getStoredCollapsedSections();
  if (collapsed) {
    sections.add(section);
  } else {
    sections.delete(section);
  }
  storeCollapsedSections(sections);
}