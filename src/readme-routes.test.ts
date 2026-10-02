import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const readme = read("README.md");
const app = read("src/App.tsx");
const main = read("src/main.tsx");

const routesSection = readme.split(/^## Routes\s*$/m)[1]?.split(/^## /m)[0] ?? "";
const tableRows = [...routesSection.matchAll(/^\|\s*`([^`]+)`\s*\|(.*)$/gm)].map((m) => ({
  path: m[1],
  cells: m[2],
}));
const readmePaths = tableRows.map((row) => row.path);

const appRoutesBody = app.match(/const APP_ROUTES = \{([\s\S]*?)\} as const;/)?.[1] ?? "";
const appRoutePaths = [...appRoutesBody.matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]);
const routeTags = app
  .split(/<Route\b/)
  .slice(1)
  .map((tag) => tag.split("</Routes>")[0]);
const routePathProps = routeTags.map((tag) =>
  tag.match(/\bpath=(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\}|\{([^}]*)\})/),
);
const literalRoutePaths = routePathProps.flatMap((m) => (m && (m[1] ?? m[2] ?? m[3]) !== undefined ? [m[1] ?? m[2] ?? m[3]] : []));
const expressionRoutePaths = routePathProps.flatMap((m) => (m?.[4] !== undefined ? [m[4].trim()] : []));
const routeTagsWithoutPath = routeTags.filter((_, i) => routePathProps[i] === null).map((tag) => `<Route${tag.slice(0, 60)}`);
const mainPathPrefixes = [...main.matchAll(/pathname\.startsWith\("([^"]+)"\)/g)].map((m) => m[1]);

const registered = new Set([...appRoutePaths, ...literalRoutePaths]);
const coveredByMain = (path: string) =>
  mainPathPrefixes.some((prefix) => path === prefix || (prefix.endsWith("/") && path.startsWith(prefix)));

describe("README routes table", () => {
  it("reads the routes from README.md, src/App.tsx and src/main.tsx", () => {
    expect(readmePaths).toContain("/dashboard");
    expect(appRoutePaths).toContain("/dashboard");
    expect(literalRoutePaths).toContain("/a11y-audit");
    expect(expressionRoutePaths).toContain("APP_ROUTES.dashboard");
    expect(mainPathPrefixes).toContain("/details/");
  });

  it("only sees <Route> paths it can check", () => {
    expect(routeTags.length).toBe(literalRoutePaths.length + expressionRoutePaths.length);
    expect(routeTagsWithoutPath, "every <Route> needs a path prop this test can read").toEqual([]);
    const unchecked = expressionRoutePaths.filter((expr) => !/^APP_ROUTES\.\w+$/.test(expr));
    expect(unchecked, "use APP_ROUTES or a string literal for <Route path> so this table can be checked").toEqual([]);
  });

  it("lists every path in APP_ROUTES", () => {
    expect(appRoutePaths.filter((path) => !readmePaths.includes(path))).toEqual([]);
  });

  it("lists every <Route> with a literal path, including the 404 catch-all", () => {
    expect(literalRoutePaths.filter((path) => !readmePaths.includes(path))).toEqual([]);
  });

  it("documents every path that src/main.tsx renders itself", () => {
    const missing = mainPathPrefixes.filter(
      (prefix) => !readmePaths.some((path) => path === prefix || (prefix.endsWith("/") && path.startsWith(prefix))),
    );
    expect(missing).toEqual([]);
  });

  it("has no rows for paths the code does not register", () => {
    expect(readmePaths.filter((path) => !registered.has(path) && !coveredByMain(path))).toEqual([]);
  });

  it("has one row per path", () => {
    expect(readmePaths.filter((path, i) => readmePaths.indexOf(path) !== i)).toEqual([]);
  });

  it("labels the demo-only routes", () => {
    for (const path of ["/500", "/rate-limit"]) {
      expect(tableRows.find((row) => row.path === path)?.cells).toMatch(/Demo only/);
    }
  });
});
