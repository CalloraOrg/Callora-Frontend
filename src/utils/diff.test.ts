import { describe, expect, it } from 'vitest';
import { diffValues } from './diff';

describe('diffValues', () => {
  it('reports changed primitive values by path', () => {
    expect(diffValues({ name: 'Alice' }, { name: 'Bob' })).toEqual([
      { path: 'name', kind: 'changed', before: 'Alice', after: 'Bob' },
    ]);
  });

  it('reports nested added and removed values', () => {
    expect(
      diffValues(
        { user: { name: 'Alice', age: 30 } },
        { user: { name: 'Alice', plan: 'pro' } },
      ),
    ).toEqual([
      { path: 'user.age', kind: 'removed', before: 30 },
      { path: 'user.plan', kind: 'added', after: 'pro' },
    ]);
  });

  it('formats changed array items with indexed paths', () => {
    expect(diffValues({ items: ['starter', 'basic'] }, { items: ['starter', 'pro'] })).toEqual([
      { path: 'items[1]', kind: 'changed', before: 'basic', after: 'pro' },
    ]);
  });

  it('returns no entries for equivalent values', () => {
    expect(diffValues({ ok: true, data: [1, 2] }, { ok: true, data: [1, 2] })).toEqual([]);
  });
});
