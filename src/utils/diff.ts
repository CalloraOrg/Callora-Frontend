export type DiffLineType = 'same' | 'added' | 'removed';

export type DiffLine = {
  type: DiffLineType;
  text: string;
};

function formatJsonLines(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2).split('\n');
}

export function buildJsonDiff(before: unknown, after: unknown): DiffLine[] {
  const previous = formatJsonLines(before);
  const next = formatJsonLines(after);
  const lengths = Array.from({ length: previous.length + 1 }, () =>
    Array(next.length + 1).fill(0)
  );

  for (let i = previous.length - 1; i >= 0; i -= 1) {
    for (let j = next.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        previous[i] === next[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < previous.length && j < next.length) {
    if (previous[i] === next[j]) {
      diff.push({ type: 'same', text: previous[i] });
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      diff.push({ type: 'removed', text: previous[i] });
      i += 1;
    } else {
      diff.push({ type: 'added', text: next[j] });
      j += 1;
    }
  }

  while (i < previous.length) {
    diff.push({ type: 'removed', text: previous[i] });
    i += 1;
  }

  while (j < next.length) {
    diff.push({ type: 'added', text: next[j] });
    j += 1;
  }

  return diff;
}
