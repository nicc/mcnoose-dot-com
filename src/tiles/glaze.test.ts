import { describe, expect, it } from 'vitest';
import { grimeLevel } from './glaze';

describe('grimeLevel', () => {
  it('is worst on the bottom row and fades to nothing a few rows up', () => {
    expect(grimeLevel(0, 5)).toBe(1);
    expect(grimeLevel(2, 5)).toBeGreaterThan(grimeLevel(3, 5));
    expect(grimeLevel(5, 5)).toBe(0);
    expect(grimeLevel(9, 5)).toBe(0);
    expect(grimeLevel(0, 0)).toBe(0);
  });
});
