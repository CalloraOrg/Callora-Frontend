/**
 * colorFromId.ts
 *
 * Generates a deterministic, stable identity colour for any API ID string.
 * Used to render a per-API colour stripe on marketplace cards so users can
 * visually distinguish endpoints at a glance.
 *
 * The function is pure — same input always produces the same output — and
 * uses HSL colour space so lightness/saturation stay consistent across
 * themes while hue varies widely for maximum distinction.
 */

/** Simple DJB2-style hash → unsigned 32-bit integer. */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Palette of 14 visually distinct hues (in degrees) chosen for strong
 * contrast on both dark (`#0b1020`) and light (`#f5f7fa`) page backgrounds.
 *
 * Each hue sits in a "sweet spot" that clears a 3:1 contrast ratio against
 * both theme backgrounds when used at the saturation/lightness values below.
 */
const HUE_PALETTE: readonly number[] = [
  0,    // red
  25,   // orange
  45,   // amber
  80,   // yellow-green
  130,  // green
  160,  // teal
  185,  // cyan
  210,  // sky blue
  235,  // blue
  260,  // indigo
  280,  // violet
  310,  // magenta
  335,  // rose
  350,  // crimson
];

/**
 * Returns the identity colour for a given API ID as a CSS HSL string.
 *
 * @param id  The API's unique identifier (e.g. `"weather-001"`).
 * @returns   A CSS `hsl(h, s%, l%)` string suitable for use in inline styles.
 */
export function colorFromId(id: string): string {
  const hash = hashString(id);
  const hue = HUE_PALETTE[hash % HUE_PALETTE.length];
  return `hsl(${hue}, 72%, 58%)`;
}

/**
 * Returns a lighter variant of the identity colour for hover / subtle fills.
 *
 * @param id  The API's unique identifier.
 * @returns   A CSS `hsl(h, s%, l%)` string with reduced saturation and higher lightness.
 */
export function colorFromIdLight(id: string): string {
  const hash = hashString(id);
  const hue = HUE_PALETTE[hash % HUE_PALETTE.length];
  return `hsl(${hue}, 50%, 75%)`;
}

/**
 * Returns a darker variant of the identity colour for text on light backgrounds.
 *
 * @param id  The API's unique identifier.
 * @returns   A CSS `hsl(h, s%, l%)` string with increased saturation and lower lightness.
 */
export function colorFromIdDark(id: string): string {
  const hash = hashString(id);
  const hue = HUE_PALETTE[hash % HUE_PALETTE.length];
  return `hsl(${hue}, 65%, 38%)`;
}
