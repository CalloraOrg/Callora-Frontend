export type DiffKind = "added" | "removed" | "changed";

export type DiffEntry = {
  path: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
};

type FlatValueMap = Map<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatPath(base: string, key: string | number): string {
  if (typeof key === "number") return `${base}[${key}]`;
  return base ? `${base}.${key}` : key;
}

function flatten(value: unknown, basePath = ""): FlatValueMap {
  const result: FlatValueMap = new Map();

  if (Array.isArray(value)) {
    if (value.length === 0) {
      result.set(basePath || "$", value);
      return result;
    }

    value.forEach((item, index) => {
      flatten(item, formatPath(basePath, index)).forEach((nestedValue, path) => {
        result.set(path, nestedValue);
      });
    });
    return result;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      result.set(basePath || "$", value);
      return result;
    }

    entries.forEach(([key, item]) => {
      flatten(item, formatPath(basePath, key)).forEach((nestedValue, path) => {
        result.set(path, nestedValue);
      });
    });
    return result;
  }

  result.set(basePath || "$", value);
  return result;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function diffValues(before: unknown, after: unknown): DiffEntry[] {
  const beforeValues = flatten(before);
  const afterValues = flatten(after);
  const paths = Array.from(new Set([...beforeValues.keys(), ...afterValues.keys()])).sort();

  return paths.reduce<DiffEntry[]>((entries, path) => {
    const hasBefore = beforeValues.has(path);
    const hasAfter = afterValues.has(path);

    if (!hasBefore && hasAfter) {
      entries.push({ path, kind: "added", after: afterValues.get(path) });
      return entries;
    }

    if (hasBefore && !hasAfter) {
      entries.push({ path, kind: "removed", before: beforeValues.get(path) });
      return entries;
    }

    const beforeValue = beforeValues.get(path);
    const afterValue = afterValues.get(path);
    if (!valuesEqual(beforeValue, afterValue)) {
      entries.push({ path, kind: "changed", before: beforeValue, after: afterValue });
    }

    return entries;
  }, []);
}
