import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = resolve(__dirname, '..');
const INDEX_HTML_PATH = resolve(ROOT_DIR, 'index.html');
const PUBLIC_DIR = resolve(ROOT_DIR, 'public');

function parseIndexHtml(): Document {
  const html = readFileSync(INDEX_HTML_PATH, 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('index.html metadata and noscript fallback', () => {
  const doc = parseIndexHtml();
  const description = doc
    .querySelector('meta[name="description"]')
    ?.getAttribute('content');

  it('declares required Open Graph meta tags', () => {
    const ogType = doc
      .querySelector('meta[property="og:type"]')
      ?.getAttribute('content');
    const ogSiteName = doc
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute('content');
    const ogTitle = doc
      .querySelector('meta[property="og:title"]')
      ?.getAttribute('content');
    const ogDescription = doc
      .querySelector('meta[property="og:description"]')
      ?.getAttribute('content');
    const ogUrl = doc
      .querySelector('meta[property="og:url"]')
      ?.getAttribute('content');
    const ogImage = doc
      .querySelector('meta[property="og:image"]')
      ?.getAttribute('content');

    expect(ogType).toBe('website');
    expect(ogSiteName).toBe('Callora');
    expect(ogTitle).toBe(doc.title);
    expect(ogDescription).toBe(description);
    expect(ogUrl).toMatch(/^https:\/\/callora-frontend-six\.vercel\.app\/?$/);
    expect(ogImage).toMatch(/^https:\/\/callora-frontend-six\.vercel\.app\/.+/);
  });

  it('points og:image to an existing small asset under public/', () => {
    const ogImage = doc
      .querySelector('meta[property="og:image"]')
      ?.getAttribute('content');
    expect(ogImage).toBeTruthy();

    const { pathname } = new URL(ogImage!);
    const assetPath = resolve(PUBLIC_DIR, pathname.replace(/^\/+/, ''));
    expect(existsSync(assetPath)).toBe(true);
    expect(statSync(assetPath).size).toBeLessThan(100 * 1024);
  });

  it('declares Twitter card meta tags', () => {
    const twitterCard = doc
      .querySelector('meta[name="twitter:card"]')
      ?.getAttribute('content');
    const twitterTitle = doc
      .querySelector('meta[name="twitter:title"]')
      ?.getAttribute('content');
    const twitterDescription = doc
      .querySelector('meta[name="twitter:description"]')
      ?.getAttribute('content');

    expect(twitterCard).toBe('summary_large_image');
    expect(twitterTitle).toBe(doc.title);
    expect(twitterDescription).toBe(description);
  });

  it('declares dark and light theme-color meta tags matching background tokens', () => {
    const darkThemeColor = doc
      .querySelector('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')
      ?.getAttribute('content');
    const lightThemeColor = doc
      .querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')
      ?.getAttribute('content');

    expect(darkThemeColor).toBe('#0b1020');
    expect(lightThemeColor).toBe('#f5f7fa');
  });

  it('includes a noscript fallback inside body with a docs link', () => {
    const noscript = doc.body.querySelector('noscript');
    expect(noscript).not.toBeNull();
    expect(noscript?.textContent).toMatch(/JavaScript/i);
    expect(noscript?.innerHTML).toMatch(/href="https?:\/\/[^"]*docs/i);
  });

  it('preserves the root mount element', () => {
    expect(doc.getElementById('root')).not.toBeNull();
  });
});
