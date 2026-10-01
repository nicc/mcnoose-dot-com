import { describe, expect, it } from 'vitest';
import { GLYPH_ROWS, layoutSampler, textBlock } from './chart';

describe('textBlock', () => {
  it('sets two centred lines of 9-row glyphs with a 3-row gap', () => {
    const b = textBlock(['Snickers', 'McNoose']);
    expect(b.h).toBe(GLYPH_ROWS * 2 + 3);
    expect(b.w).toBe(48); // McNoose: 9+5+8+5+5+5+5 + 6 gaps
  });

  it('rejects letters without a glyph', () => {
    expect(() => textBlock(['Zed'])).toThrow('no glyph: Z');
  });
});

describe('layoutSampler', () => {
  const chart = layoutSampler(['Snickers', 'McNoose'], { w: 62, h: 49 });
  const at = (x: number, y: number) => chart.cells[y * chart.w + x];

  it('keeps every stitch inside the cloth with a margin', () => {
    for (let y = 0; y < chart.h; y++)
      for (let x = 0; x < chart.w; x++)
        if (at(x, y)) {
          expect(x).toBeGreaterThanOrEqual(1);
          expect(y).toBeGreaterThanOrEqual(1);
          expect(x).toBeLessThan(chart.w - 1);
          expect(y).toBeLessThan(chart.h - 1);
        }
  });

  it('uses thread for text and petal/leaf only in the corners', () => {
    const inks = new Set(chart.cells.filter(Boolean));
    expect(inks).toEqual(new Set(['T', 'P', 'L']));
    for (let y = 0; y < chart.h; y++)
      for (let x = 0; x < chart.w; x++) {
        const c = at(x, y);
        if (c === 'P' || c === 'L') expect(x < chart.w / 3 || x > (2 * chart.w) / 3).toBe(true);
      }
  });

  it('uses the requested cloth size when the design fits', () => {
    expect([chart.w, chart.h]).toEqual([62, 49]);
    const big = layoutSampler(['Snickers', 'McNoose'], { w: 90, h: 70 });
    expect([big.w, big.h]).toEqual([90, 70]);
  });

  it('keeps florals in the corners as the cloth grows', () => {
    const big = layoutSampler(['Snickers', 'McNoose'], { w: 90, h: 70 });
    const first = big.cells.findIndex(Boolean), last = big.cells.length - 1 - [...big.cells].reverse().findIndex(Boolean);
    expect([first % big.w, Math.floor(first / big.w)].every((v) => v < 6)).toBe(true); // near top-left
    expect(big.w - (last % big.w)).toBeLessThan(6);
    expect(big.h - Math.floor(last / big.w)).toBeLessThan(6);
  });

  it('grows a too-small cloth just enough to clear the lettering', () => {
    const tiny = layoutSampler(['Snickers', 'McNoose'], { w: 10, h: 10 });
    expect(tiny.w).toBeGreaterThanOrEqual(48 + 6);
    const smallest = layoutSampler(['Snickers', 'McNoose']);
    expect([tiny.w, tiny.h]).toEqual([smallest.w, smallest.h]);
  });
});
