// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  getContrastRatio,
  parseColor,
  composite,
  WCAG_AA_NORMAL,
  WCAG_AA_LARGE,
} from './contrast';

// Lodaded directly from disk via an absolute path. (vitest's node-environment
// wraps `node:fs`, so we avoid path composition that could be mis-resolved.)
const CSS = readFileSync('/workspaces/Callora-Frontend/src/index.css', 'utf8');

/** Extract the declaration body of a `[data-theme="..."]` block. */
function themeBlock(theme: 'dark' | 'light'): string {
  const match = CSS.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Could not find [data-theme="${theme}"] block`);
  return match[1];
}

/** Build a `{ '--token': 'value' }` map for a theme block. */
function themeTokens(theme: 'dark' | 'light'): Record<string, string> {
  const block = themeBlock(theme);
  const tokens: Record<string, string> = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

/** Resolve a `var(--x)` reference (ignoring fallbacks) to its token value. */
function resolve(value: string, tokens: Record<string, string>): string {
  const m = value.match(/var\((--[\w-]+)(?:,\s*[^)]*)?\)/);
  return m ? tokens[m[1]] ?? value : value;
}

/** Composite a token colour (possibly translucent) over the theme page background. */
function effective(value: string, tokens: Record<string, string>): [number, number, number] | null {
  const resolved = resolve(value, tokens);
  const rgba = parseColor(resolved);
  if (!rgba) return null;
  const pageRgba = parseColor(resolve(tokens['--page-bg'], tokens));
  if (!pageRgba) return null;
  return composite(rgba, [pageRgba[0], pageRgba[1], pageRgba[2]]);
}

/** WCAG contrast ratio of two token names within one theme. */
function ratioFor(fgToken: string, bgToken: string, tokens: Record<string, string>): number {
  const fg = effective(tokens[fgToken], tokens);
  const bg = effective(tokens[bgToken], tokens);
  if (!fg || !bg) throw new Error(`Could not resolve ${fgToken} / ${bgToken}`);
  return getContrastRatio([fg[0], fg[1], fg[2], 1], [bg[0], bg[1], bg[2], 1]);
}

const THEMES = ['dark', 'light'] as const;

describe('theme tokens preserve WCAG AA contrast when switching themes', () => {
  const textPairs: Array<[string, string]> = [
    ['--text', '--page-bg'],
    ['--muted', '--surface'],
    ['--display-404', '--page-bg'],
    ['--glyph-error', '--page-bg'],
    ['--status-pending-fg', '--surface'],
    ['--status-approving-fg', '--surface'],
    ['--method-get-color', '--surface'],
    ['--method-post-color', '--surface'],
    ['--method-put-color', '--surface'],
    ['--method-delete-color', '--surface'],
    ['--method-patch-color', '--surface'],
  ];

  for (const theme of THEMES) {
    const tokens = themeTokens(theme);

    for (const [fg, bg] of textPairs) {
      it(`${theme}: ${fg} on ${bg} meets WCAG AA (>=4.5:1)`, () => {
        const ratio = ratioFor(fg, bg, tokens);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }

    it(`${theme}: white text on --accent (primary buttons) meets >=3:1`, () => {
      const fg = effective('#ffffff', tokens);
      const bg = effective(tokens['--accent'], tokens);
      expect(fg).not.toBeNull();
      expect(bg).not.toBeNull();
      const ratio = getContrastRatio(
        [fg![0], fg![1], fg![2], 1],
        [bg![0], bg![1], bg![2], 1],
      );
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });
  }
});

describe('contrast regressions are not reintroduced (no hardcoded colours)', () => {
  // Strip comments so we only inspect real rules, never the explanatory
  // example snippets that also appear in the stylesheet.
  const CSS_NOCOMMENTS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

  /** Find the `color:` declaration inside a given selector rule and assert it uses a token. */
  function colorDeclarationUsesToken(selector: string): boolean {
    const escaped = selector.replace(/[.[>\s]/g, (c) => '\\' + c);
    const re = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`);
    const match = CSS_NOCOMMENTS.match(re);
    if (!match) throw new Error(`Could not find rule for ${selector}`);
    const colorDecl = match[1].match(/(?:^|[\s;{])color:\s*([^;]+);/);
    if (!colorDecl) throw new Error(`No color declaration in ${selector}`);
    return /var\(/.test(colorDecl[1]);
  }

  const selectors = [
    '.not-found-code',
    '.error-illustration span',
    '.status-chip.pending',
    '.status-chip.approving',
  ];

  for (const selector of selectors) {
    it(`${selector} uses a theme token (not a hardcoded colour)`, () => {
      expect(colorDeclarationUsesToken(selector)).toBe(true);
    });
  }
});

describe('contrast utility math', () => {
  it('computes known WCAG ratios', () => {
    // Black on white = 21:1, white on black = 21:1.
    expect(getContrastRatio([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21, 1);
    expect(getContrastRatio([255, 255, 255, 1], [0, 0, 0, 1])).toBeCloseTo(21, 1);
  });

  it('alpha-composites translucent surfaces over an opaque backdrop', () => {
    // 50% black over white => mid grey (128) per channel.
    expect(composite([0, 0, 0, 0.5], [255, 255, 255])).toEqual([128, 128, 128]);
  });
});
