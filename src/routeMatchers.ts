/**
 * Pure routing predicates shared by the custom router (`renderRoute.tsx`).
 */

const MARKETPLACE_SUBPAGE = /^\/marketplace\/[^/]+\/(sla|rate-limits)\/?$/;

/**
 * True when `pathname` is a per-API marketplace subpage that is rendered by
 * `App` (e.g. `/marketplace/:apiId/sla`, `/marketplace/:apiId/rate-limits`)
 * rather than by the Marketplace listing page. Query strings and hashes are
 * ignored.
 */
export function isMarketplaceSubpage(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0];
  return MARKETPLACE_SUBPAGE.test(path);
}
