import { describe, expect, it } from 'vitest';
import { PinFilter, zoomScale } from './pin';

const run = (f: PinFilter, frames: number, at: (i: number) => number, smooth: number, t0 = 0) => {
  let out = f.step({ x: at(0), y: 0 }, t0, smooth);
  for (let i = 1; i <= frames; i++) out = f.step({ x: at(i), y: 0 }, t0 + i * 16, smooth);
  return out;
};

describe('PinFilter', () => {
  it('passes through exactly with no smoothing', () => {
    const f = new PinFilter({ x: 0, y: 0 }, 0);
    expect(f.step({ x: 37, y: -5 }, 16, 0).pos).toEqual({ x: 37, y: -5 });
  });

  it('settles exactly on a stationary position after a jump', () => {
    const f = new PinFilter({ x: 0, y: 0 }, 0);
    const out = run(f, 200, () => 300, 60);
    expect(out.settled).toBe(true);
    expect(out.pos.x).toBe(300);
  });

  it('keeps pace with a steady drag regardless of smoothing', () => {
    const v = 0.5; // px per ms
    for (const smooth of [0, 40, 120]) {
      const f = new PinFilter({ x: 0, y: 0 }, 0);
      const out = run(f, 300, (i) => i * 16 * v, smooth);
      expect(out.pos.x - 300 * 16 * v).toBeCloseTo(0, 0);
      expect(out.settled).toBe(false);
    }
  });

  it('caps the lead after sudden jumps', () => {
    const f = new PinFilter({ x: 0, y: 0 }, 0);
    const out = f.step({ x: 5000, y: 0 }, 16, 300);
    expect(out.pos.x).toBeLessThanOrEqual(5200);
  });
});

describe('zoomScale', () => {
  it('is 1 unzoomed, even with window borders in outerWidth', () => {
    expect(zoomScale(1200, 1200, 2)).toBe(1);
    expect(zoomScale(1200, 1216, 1)).toBe(1);
  });

  it('is page px per screen unit when the page is zoomed but the window size is not (Chrome, Safari)', () => {
    expect(zoomScale(800, 1200, 1.5)).toBeCloseTo(1 / 1.5); // 1× screen at 150%
    expect(zoomScale(800, 1200, 3)).toBeCloseTo(1 / 1.5); // 2× screen at 150%
    expect(zoomScale(1333, 1200, 1.8)).toBeCloseTo(1 / 0.9);
  });

  it('ignores a page narrowed by docked devtools or a side panel', () => {
    expect(zoomScale(840, 1200, 2)).toBe(1); // 1.43: no zoom step
    expect(zoomScale(960, 1200, 2)).toBe(1); // 1.25 is a step, but 2 / 1.25 is no screen density
  });

  it('falls back to 1 without sizes', () => {
    expect(zoomScale(0, 0, 1)).toBe(1);
  });
});
