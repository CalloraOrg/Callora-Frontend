// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  classifyAsset,
  evaluateBudget,
  extractEntryFiles,
} from '../scripts/bundleBudget.mjs';
import { runCheck } from '../scripts/check-bundle-size.mjs';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createDist(
  files: Record<string, string>,
  budget: Record<string, number>,
): { distDir: string; budgetPath: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'bundle-budget-'));
  tempDirs.push(root);

  const assetsDir = path.join(root, 'dist', 'assets');
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(
    path.join(root, 'dist', 'index.html'),
    [
      '<script type="module" src="/assets/index-abc123.js"></script>',
      '<link rel="stylesheet" href="/assets/index-def456.css">',
    ].join('\n'),
  );

  for (const [file, contents] of Object.entries(files)) {
    writeFileSync(path.join(assetsDir, file), contents);
  }

  const budgetPath = path.join(root, 'bundle-budget.json');
  writeFileSync(budgetPath, JSON.stringify(budget));

  return { distDir: path.join(root, 'dist'), budgetPath };
}

describe('bundle budget classification', () => {
  it('recognises hashed entry chunks and treats other JavaScript as lazy', () => {
    const entryFiles = new Set(['index-abc123.js']);

    expect(classifyAsset('index-abc123.js', entryFiles)).toBe('entry');
    expect(classifyAsset('MarketplacePage-def456.js', entryFiles)).toBe('chunk');
    expect(classifyAsset('index-def456.css', entryFiles)).toBe('css');
  });

  it('extracts only local hashed assets from index.html', () => {
    const html = [
      '<script src="/assets/index-abc123.js?v=2"></script>',
      '<link href="/assets/index-def456.css" rel="stylesheet">',
      '<script src="https://cdn.example.com/vendor.js"></script>',
      '<a href="/docs">Docs</a>',
    ].join('\n');

    expect([...extractEntryFiles(html)]).toEqual([
      'index-abc123.js',
      'index-def456.css',
    ]);
  });
});

describe('bundle budget evaluation', () => {
  const assets = [
    { file: 'index-abc123.js', kind: 'entry' as const, rawBytes: 200_000, gzipBytes: 100 * 1024 },
    { file: 'lazy-def456.js', kind: 'chunk' as const, rawBytes: 50_000, gzipBytes: 20 * 1024 },
    { file: 'index-def456.css', kind: 'css' as const, rawBytes: 10_000, gzipBytes: 5 * 1024 },
  ];

  it('passes when every asset is within its budget', () => {
    const result = evaluateBudget(assets, { entry: 101, chunk: 21, css: 6 });

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('fails and names every asset over its budget', () => {
    const result = evaluateBudget(assets, { entry: 99, chunk: 19, css: 4 });

    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.file)).toEqual([
      'index-abc123.js',
      'lazy-def456.js',
      'index-def456.css',
    ]);
  });
});

describe('runCheck', () => {
  it('passes against a real dist directory and classifies CSS separately', () => {
    const { distDir, budgetPath } = createDist(
      {
        'index-abc123.js': 'console.log("entry");',
        'lazy-def456.js': 'console.log("lazy");',
        'index-def456.css': '.card { color: red; }',
      },
      { entry: 1, chunk: 1, css: 1 },
    );

    const report = runCheck({ distDir, budgetPath });

    expect(report.ok).toBe(true);
    expect(report.error).toBeNull();
    expect(report.failures).toEqual([]);
    expect(report.results.map((result) => [result.file, result.kind])).toEqual([
      ['index-abc123.js', 'entry'],
      ['index-def456.css', 'css'],
      ['lazy-def456.js', 'chunk'],
    ]);
  });

  it('fails when an asset exceeds its budget', () => {
    const { distDir, budgetPath } = createDist(
      {
        'index-abc123.js': 'console.log("entry");',
        'lazy-def456.js': 'console.log("lazy");',
        'index-def456.css': '.card { color: red; }',
      },
      { entry: 0.001, chunk: 0.001, css: 0.001 },
    );

    const report = runCheck({ distDir, budgetPath });

    expect(report.ok).toBe(false);
    expect(report.failures).toHaveLength(3);
    expect(report.failures[0].gzipBytes).toBeGreaterThan(
      (report.failures[0].limitKb ?? 0) * 1024,
    );
  });

  it('returns a helpful error when dist/ is missing', () => {
    const missingDir = path.join(tmpdir(), `missing-dist-${Date.now()}`);
    const report = runCheck({
      distDir: missingDir,
      budgetPath: path.join(missingDir, 'bundle-budget.json'),
    });

    expect(report.ok).toBe(false);
    expect(report.error).toMatch(/npm run build/i);
    expect(report.results).toEqual([]);
  });
});
