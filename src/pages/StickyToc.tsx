/**
 * StickyToc.tsx
 *
 * Re-export of the sticky documentation TOC used on ApiDetailPage.
 * Campaign issue #528 references this path; the implementation lives in
 * `src/components/ApiDetailStickyTOC.tsx`.
 */

export {
  ApiDetailStickyTOC as StickyToc,
  ApiDetailStickyTOC,
  type TocSection,
} from "../components/ApiDetailStickyTOC";

export { ApiDetailStickyTOC as default } from "../components/ApiDetailStickyTOC";

export { StickyTocErrorBoundary } from "../components/StickyTocErrorBoundary";
