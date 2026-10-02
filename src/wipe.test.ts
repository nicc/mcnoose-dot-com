import { describe, expect, it } from 'vitest';
import { dabAlpha } from './wipe';

describe('dabAlpha', () => {
  it('removes the asked-for share in one pass of overlapping dabs (one width = four dabs)', () => {
    for (const perPass of [0.1, 0.4, 0.9]) expect(1 - (1 - dabAlpha(perPass)) ** 4).toBeCloseTo(perPass);
  });
  it('clears fully at 1 and not at all at 0', () => {
    expect(dabAlpha(1)).toBe(1);
    expect(dabAlpha(0)).toBe(0);
  });
});
