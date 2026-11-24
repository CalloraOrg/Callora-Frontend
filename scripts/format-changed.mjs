#!/usr/bin/env node
// Checks Prettier formatting for files this branch changes, so contributors can
// format only what they touch without reformatting the whole repository.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** Prefer the upstream main branch, falling back to any local main ref. */
function resolveBase() {
  for (const ref of ["origin/main", "upstream/main", "main"]) {
    try {
      git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
      return ref;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

const base = resolveBase();
const diffCommands = [
  ...(base ? [["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]] : []),
  ["diff", "--name-only", "--diff-filter=ACMR", "--cached"],
  ["diff", "--name-only", "--diff-filter=ACMR"],
  ["ls-files", "--others", "--exclude-standard"],
];

const changed = new Set();
for (const args of diffCommands) {
  try {
    for (const file of git(args).split("\n")) {
      if (file) changed.add(file);
    }
  } catch {
    // A missing base or empty diff is not an error.
  }
}

const targets = [...changed].filter((file) => existsSync(file));

if (targets.length === 0) {
  console.log("format:check — no changed files to check.");
  process.exit(0);
}

const result = spawnSync("prettier", ["--check", "--ignore-unknown", ...targets], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
