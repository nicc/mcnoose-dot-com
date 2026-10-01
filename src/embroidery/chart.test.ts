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
  const chart = layoutSampler(['Snickers', 'McNoose']);
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

  it('is landscape and roughly frame-shaped', () => {
    expect(chart.w / chart.h).toBeGreaterThan(1.1);
    expect(chart.w / chart.h).toBeLessThan(2);
  });
});
