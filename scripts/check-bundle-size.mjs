#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  classifyAsset,
  evaluateBudget,
  extractEntryFiles,
  formatKb,
} from './bundleBudget.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const DEFAULT_DIST_DIR = path.join(projectRoot, 'dist');
const DEFAULT_BUDGET_PATH = path.join(projectRoot, 'bundle-budget.json');

/**
 * Reads the build output and evaluates it against the budget.
 *
 * Exported so the missing-dist and pass/fail paths can be tested directly.
 *
 * @param {{ distDir?: string, budgetPath?: string }} [options]
 */
export function runCheck({
  distDir = DEFAULT_DIST_DIR,
  budgetPath = DEFAULT_BUDGET_PATH,
} = {}) {
  if (!existsSync(distDir)) {
    return {
      ok: false,
      error: 'No build output found at dist/. Run `npm run build` first.',
      budget: null,
      results: [],
      failures: [],
    };
  }

  const indexPath = path.join(distDir, 'index.html');
  if (!existsSync(indexPath)) {
    return {
      ok: false,
      error: 'dist/index.html is missing. Run `npm run build` again.',
      budget: null,
      results: [],
      failures: [],
    };
  }

  const assetsDir = path.join(distDir, 'assets');
  if (!existsSync(assetsDir)) {
    return {
      ok: false,
      error: 'dist/assets/ is missing. Run `npm run build` again.',
      budget: null,
      results: [],
      failures: [],
    };
  }

  let budget;
  try {
    budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
  } catch (error) {
    return {
      ok: false,
      error: `Could not read bundle budget at ${path.relative(projectRoot, budgetPath)}: ${error instanceof Error ? error.message : String(error)}`,
      budget: null,
      results: [],
      failures: [],
    };
  }

  const entryFiles = extractEntryFiles(readFileSync(indexPath, 'utf8'));
  const files = readdirSync(assetsDir)
    .filter((file) => /\.(js|css)$/i.test(file))
    .sort();

  const assets = files.map((file) => {
    const contents = readFileSync(path.join(assetsDir, file));
    return {
      file,
      kind: classifyAsset(file, entryFiles),
      rawBytes: contents.length,
      gzipBytes: gzipSync(contents, { level: 9 }).length,
    };
  });

  const evaluation = evaluateBudget(assets, budget);
  return {
    ok: evaluation.passed,
    error: null,
    budget,
    results: evaluation.results,
    failures: evaluation.failures,
  };
}

function printTable(report) {
  const rows = report.results.map((result) => [
    result.file,
    result.kind,
    formatKb(result.rawBytes),
    formatKb(result.gzipBytes),
    result.limitKb === null ? '-' : `${result.limitKb} kB`,
    result.exceeded ? 'OVER' : 'ok',
  ]);

  const headers = ['Asset', 'Kind', 'Raw', 'Gzip', 'Limit', 'Status'];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length)),
  );
  const formatRow = (row) =>
    row.map((cell, index) => cell.padEnd(widths[index])).join('  ');

  console.log(formatRow(headers));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) console.log(formatRow(row));
  console.log('');
  console.log(
    `${report.results.length} asset(s) checked; entry chunk is marked "entry".`,
  );
}

/**
 * @param {string[]} argv
 */
function main(argv) {
  const json = argv.includes('--json');
  let report;

  try {
    report = runCheck();
  } catch (error) {
    report = {
      ok: false,
      error: `Bundle size check failed: ${error instanceof Error ? error.message : String(error)}`,
      budget: null,
      results: [],
      failures: [],
    };
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.error) {
    console.error(report.error);
  } else {
    printTable(report);
    for (const failure of report.failures) {
      console.error(
        `Bundle budget exceeded: ${failure.file} (${failure.kind}) is ${formatKb(failure.gzipBytes)} gzip, limit ${failure.limitKb} kB.`,
      );
    }
  }

  process.exitCode = report.ok ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main(process.argv.slice(2));
