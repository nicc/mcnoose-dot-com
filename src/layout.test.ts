import { describe, expect, it } from 'vitest';
import { anchorFits, compensateTop, computeLayout, computeStrip, initialAnchor, rowCount, shiftAnchor, visibleColumns } from './layout';

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
      const s = computeStrip({ width: 1440, origin: 720, tile: 400, grout: 4, widthRatio: 1.6, offset });
      expect(s.start).toBeLessThanOrEqual(0);
      expect(s.start).toBeGreaterThan(-s.pitch);
      expect(s.start + s.count * s.pitch).toBeGreaterThanOrEqual(1440);
    }
  });

  it('puts a joint at page centre + offset·pitch', () => {
    const s = computeStrip({ width: 1000, origin: 500, tile: 400, grout: 0, widthRatio: 1.6, offset: 0.25 });
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

describe('anchor', () => {
  const input = { ...base, grout: 4, width: 1440 };
  const a = initialAnchor(input);

  it('starts centred with the same full columns as computeLayout', () => {
    const l = computeLayout(input);
    const c = visibleColumns(a, 1440);
    expect(c.full.length).toBe(l.columns);
    expect(c.full).toEqual([1, 2, 3]);
    expect(c.first).toBe(0);
    expect(c.count).toBe(l.columns + 2);
  });

  it('keeps tile positions fixed while the width changes', () => {
    for (const w of [1100, 1440, 1900]) {
      const c = visibleColumns(a, w);
      for (const k of c.full) expect(a.originX + k * a.pitch).toBeGreaterThanOrEqual(0);
    }
    expect(visibleColumns(a, 1100).full).toEqual([1, 2]);
    expect(visibleColumns(a, 1900).full).toEqual([1, 2, 3, 4]);
  });

  it('holds until one full tile with minPeek either side no longer fits', () => {
    const leftEdge = a.originX + a.pitch; // first full tile
    const minWidth = leftEdge + a.tile + a.grout + 0.25 * a.tile;
    expect(anchorFits(a, minWidth + 0.5, 900, 0.25)).toBe(true);
    expect(anchorFits(a, minWidth - 0.5, 900, 0.25)).toBe(false);
    expect(anchorFits(a, 1440, 500, 0.25)).toBe(false); // too short for the tile
  });

  it('covers columns left of the origin when the viewport is wider than first render', () => {
    const narrow = initialAnchor({ ...input, width: 700 });
    const c = visibleColumns(narrow, 1600);
    expect(narrow.originX + c.first * narrow.pitch).toBeLessThanOrEqual(0);
    expect(narrow.originX + (c.first + c.count) * narrow.pitch).toBeGreaterThanOrEqual(1600);
  });
});

describe('screen pinning', () => {
  it('shifts the wall opposite to the viewport moving on screen, keeping the same columns in world terms', () => {
    const a = initialAnchor({ ...base, grout: 4, width: 1440 });
    const moved = shiftAnchor(a, -300); // left edge dragged 300px left
    expect(moved.originX).toBe(a.originX + 300);
    expect(moved.centreX).toBe(a.centreX + 300);
    const c = visibleColumns(moved, 1740);
    expect(c.first).toBeLessThan(0); // new columns revealed on the left
  });

  it('scrolls to compensate a top-edge move, growing wallpaper only past the top', () => {
    expect(compensateTop(500, 120, 0)).toEqual({ scrollY: 620, topExtra: 0 });
    expect(compensateTop(500, -120, 0)).toEqual({ scrollY: 380, topExtra: 0 });
    expect(compensateTop(50, -120, 10)).toEqual({ scrollY: 0, topExtra: 80 });
  });
});
