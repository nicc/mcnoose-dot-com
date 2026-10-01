import { describe, expect, it } from 'vitest';
import { computeLayout, computeStrip, rowCount } from './layout';

const base = { height: 2000, tileMax: 400, grout: 0, minPeek: 0.25 };

describe('computeLayout', () => {
  it('caps tile size at tileMax', () => {
    expect(computeLayout({ ...base, width: 3000 }).tile).toBe(400);
  });

  it('shrinks so one tile plus minPeek each side fits the width', () => {
    const l = computeLayout({ ...base, width: 390 });
    expect(l.tile).toBeCloseTo(260);
    expect(l.columns).toBe(1);
    expect(l.peek).toBeCloseTo(65);
  });

  it('shrinks to fit the height too, staying square', () => {
    const l = computeLayout({ ...base, width: 844, height: 330 });
    expect(l.tile).toBeCloseTo(220);
  });

  it('adds columns at 2.5T, 3.5T, 4.5T with no grout', () => {
    const cols = (width: number) => computeLayout({ ...base, width }).columns;
    expect([999, 1000, 1399, 1400, 1799, 1800].map(cols)).toEqual([1, 2, 2, 3, 3, 4]);
  });

  it('counts each grout joint once', () => {
    const g = 10;
    // 1 column: tile + 2 joints + 2·peek. 2 columns adds exactly one tile + one joint.
    const threshold = 400 + 2 * g + 2 * 100 + (400 + g);
    const cols = (width: number) => computeLayout({ ...base, grout: g, width }).columns;
    expect(cols(threshold - 1)).toBe(1);
    expect(cols(threshold)).toBe(2);
    const l = computeLayout({ ...base, grout: g, width: threshold });
    expect(l.peek).toBeCloseTo(100);
    expect(l.gridWidth).toBeCloseTo(4 * 400 + 3 * g);
  });

  it('always shows a full tile and between minPeek and 3·minPeek of each edge tile', () => {
    for (const grout of [0, 4, 12]) {
      for (let width = 320; width <= 3000; width += 7) {
        for (const height of [330, 640, 900]) {
          const l = computeLayout({ ...base, grout, width, height });
          expect(l.peek).toBeGreaterThanOrEqual(0.25 * l.tile - 1e-6);
          expect(l.peek).toBeLessThan(0.75 * l.tile + grout / 2 + 1e-6);
          expect(l.tile + 2 * grout + 2 * l.peek).toBeLessThanOrEqual(width + 1e-6);
          expect(l.columns * l.tile + (l.columns + 1) * grout + 2 * l.peek).toBeCloseTo(width);
        }
      }
    }
  });
});

describe('computeStrip', () => {
  it('covers the viewport from a start at or left of 0', () => {
    for (const offset of [0, 0.37, 0.99]) {
      const s = computeStrip({ width: 1440, tile: 400, grout: 4, widthRatio: 1.6, offset });
      expect(s.start).toBeLessThanOrEqual(0);
      expect(s.start).toBeGreaterThan(-s.pitch);
      expect(s.start + s.count * s.pitch).toBeGreaterThanOrEqual(1440);
    }
  });

  it('puts a joint at page centre + offset·pitch', () => {
    const s = computeStrip({ width: 1000, tile: 400, grout: 0, widthRatio: 1.6, offset: 0.25 });
    const joint = 500 + 0.25 * 640;
    expect(((joint - s.start) % s.pitch + s.pitch) % s.pitch).toBeCloseTo(0);
  });
});

describe('rowCount', () => {
  it('fills the last row and adds trailing rows', () => {
    expect(rowCount(5, 3, 6)).toBe(8);
    expect(rowCount(6, 3, 6)).toBe(8);
    expect(rowCount(5, 1, 6)).toBe(11);
  });
});
