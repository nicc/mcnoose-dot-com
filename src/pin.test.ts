import { describe, expect, it } from 'vitest';
import { PinFilter } from './pin';

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
