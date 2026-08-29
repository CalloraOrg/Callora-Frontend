/**
 * WCAG 2.1 contrast utilities.
 *
 * Used by automated accessibility tests to guarantee that token-driven
 * foreground / background pairs clear the minimum contrast ratios required by
 * WCAG 2.1 (AA: 4.5:1 for normal text, 3:1 for large text and UI components)
 * in *both* light and dark themes. Keeping the math in one place means the
 * theme stylesheets and the tests share a single source of truth.
 */

/** Parse a hex colour (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) into 0-255 channels. */
export function parseHexColor(input: string): [number, number, number, number] | null {
  let hex = input.trim().replace(/^#/, '');
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (hex.length !== 6 && hex.length !== 8) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}

/** Parse an `rgba()` / `rgb()` colour string into 0-255 channels + alpha. */
export function parseRgbaColor(input: string): [number, number, number, number] | null {
  const match = input
    .trim()
    .match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (!match) return null;
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const a = match[4] === undefined ? 1 : Number(match[4]);
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
  return [r, g, b, a];
}

/** Resolve a CSS colour string into 0-255 channels + alpha. Returns null if unsupported. */
export function parseColor(input: string): [number, number, number, number] | null {
  const trimmed = input.trim();
  if (trimmed.startsWith('#')) return parseHexColor(trimmed);
  if (/^rgba?\(/i.test(trimmed)) return parseRgbaColor(trimmed);
  return null;
}

/** Relative luminance (WCAG 2.1 §1.4.3) for an sRGB channel value (0-255). */
function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance (0-1) of a fully opaque colour. */
export function getLuminance([r, g, b]: [number, number, number]): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** Alpha-composite a foreground colour over an opaque background. */
export function composite(
  fg: [number, number, number, number],
  bg: [number, number, number],
): [number, number, number] {
  const alpha = fg[3];
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ];
}

/** Contrast ratio between two colours (1.0 - 21.0). */
export function getContrastRatio(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  // Composite both colours over white so translucent/alpha colours compare
  // against a consistent, opaque backdrop (the worst-case page surface).
  const WHITE: [number, number, number] = [255, 255, 255];
  const aOpaque = composite(a, WHITE);
  const bOpaque = composite(b, WHITE);
  const la = getLuminance(aOpaque);
  const lb = getLuminance(bOpaque);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA normal-text threshold (4.5:1). */
export const WCAG_AA_NORMAL = 4.5;
/** WCAG AA large-text / non-text threshold (3:1). */
export const WCAG_AA_LARGE = 3;

/** True when the pair meets WCAG AA for normal-size text. */
export function meetsWCAG_AA(a: string, b: string): boolean {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return false;
  return getContrastRatio(ca, cb) >= WCAG_AA_NORMAL;
}
