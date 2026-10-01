import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { groupOf, ORDER } from './config-groups';

describe('config groups', () => {
  it('puts every key in a named group (nothing falls into Other)', () => {
    expect(Object.keys(CONFIG).filter((k) => groupOf(k) === 'Other')).toEqual([]);
  });

  it('config.ts lists keys section by section in display order', () => {
    const groups = Object.keys(CONFIG).map(groupOf);
    const ranks = groups.map((g) => ORDER.indexOf(g));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});
