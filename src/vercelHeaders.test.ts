import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = resolve(__dirname, '..');
const VERCEL_JSON_PATH = resolve(ROOT_DIR, 'vercel.json');
const CONSTANTS_PATH = resolve(ROOT_DIR, 'src/config/constants.ts');
const PUBLIC_THEME_INIT_PATH = resolve(ROOT_DIR, 'public/theme-init.js');

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelHeaderRule {
  source: string;
  headers: VercelHeader[];
}

interface VercelConfig {
  headers?: VercelHeaderRule[];
}

function loadVercelConfig(): VercelConfig {
  return JSON.parse(readFileSync(VERCEL_JSON_PATH, 'utf8')) as VercelConfig;
}

function parseCspDirectives(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...values] = trimmed.split(/\s+/);
    directives.set(name, values);
  }
  return directives;
}

function extractStellarApiOriginsFromConstants(): string[] {
  const source = readFileSync(CONSTANTS_PATH, 'utf8');
  const matches = source.match(/https:\/\/[a-z0-9.-]+\.stellar\.org/gi) ?? [];
  return Array.from(new Set(matches.map((url) => new URL(url).origin)));
}

describe('vercel.json security headers', () => {
  const config = loadVercelConfig();
  const globalRule = config.headers?.find((rule) => rule.source === '/(.*)');
  const assetsRule = config.headers?.find((rule) => rule.source === '/assets/(.*)');

  it('preserves the immutable Cache-Control rule for /assets/(.*)', () => {
    expect(assetsRule).toBeDefined();
    const cacheControl = assetsRule?.headers.find((h) => h.key === 'Cache-Control');
    expect(cacheControl?.value).toBe('public, max-age=31536000, immutable');
  });

  it('sets required security headers on /(.*)', () => {
    expect(globalRule).toBeDefined();
    const headerMap = new Map(globalRule!.headers.map((h) => [h.key, h.value]));

    expect(headerMap.has('Content-Security-Policy')).toBe(true);
    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headerMap.get('Permissions-Policy')).toContain('camera=()');
    expect(headerMap.get('Permissions-Policy')).toContain('microphone=()');
    expect(headerMap.get('Permissions-Policy')).toContain('geolocation=()');
    expect(headerMap.get('Permissions-Policy')).toContain('payment=()');
  });

  it('configures CSP with frame-ancestors none and required directives', () => {
    const csp = globalRule?.headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    const directives = parseCspDirectives(csp);

    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('script-src')).toEqual(["'self'"]);
    expect(directives.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directives.get('img-src')).toEqual(["'self'", 'data:']);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
  });

  it('allows every Stellar Horizon and Soroban host referenced in src/config/constants.ts in connect-src', () => {
    const csp = globalRule?.headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    const connectSrc = parseCspDirectives(csp).get('connect-src') ?? [];

    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain('https://api.callora.com');
    expect(connectSrc).toContain('https://friendbot.stellar.org');

    const stellarOrigins = extractStellarApiOriginsFromConstants();
    expect(stellarOrigins.length).toBeGreaterThanOrEqual(5);
    for (const origin of stellarOrigins) {
      expect(connectSrc).toContain(origin);
    }
  });

  it('serves the pre-paint theme script as a static file under public/', () => {
    expect(existsSync(PUBLIC_THEME_INIT_PATH)).toBe(true);
  });
});
