import { describe, expect, it } from 'vitest';
import { frameMark, rollShift, rollsIn, seamsIn } from './age';

const frame = { wCm: 28, hCm: 20, nail: { x: 100, y: 150 } }; // hangs from (100, 150), down to y = 130

describe('the frame’s mark on the paper', () => {
  it('kept the paper behind it clean, and dirtied the paper round it', () => {
    expect(frameMark(100, 140, frame, 0)).toEqual({ clean: 1, halo: 0 });
    const edge = frameMark(100, 151, frame, 0), far = frameMark(100, 180, frame, 0);
    expect(edge.clean).toBe(0);
    expect(edge.halo).toBeGreaterThan(0.5);
    expect(far.halo).toBeLessThan(0.01);
  });

  it('the grime is heavier above it than below', () => {
    expect(frameMark(100, 151, frame, 0).halo).toBeGreaterThan(frameMark(100, 129, frame, 0).halo);
  });

  it('its wandering angle blurs the mark, most far from the nail', () => {
    // Just outside its side, low down: clean in the years it hung turned towards it.
    expect(frameMark(115, 135, frame, 0).clean).toBe(0);
    expect(frameMark(115, 135, frame, 8).clean).toBeGreaterThan(0);
    // Near the nail, the edge stays sharp.
    expect(frameMark(100, 151, frame, 8).clean).toBe(0);
  });
});

describe('seams', () => {
  it('fall a roll’s width apart', () => {
    const xs = seamsIn(0, 300);
    expect(xs.length).toBeGreaterThan(4);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(53);
  });
});

describe('rolls', () => {
  it('run seam to seam with no gaps, each hung a little off the match', () => {
    const rolls = rollsIn(0, 300);
    for (let i = 1; i < rolls.length; i++) expect(rolls[i].x0).toBeCloseTo(rolls[i - 1].x1);
    expect(rolls[0].x0).toBeLessThanOrEqual(0);
    expect(rolls.at(-1)!.x1).toBeGreaterThanOrEqual(300);
    const shifts = rolls.map((r) => rollShift(r.k));
    for (const s of shifts) expect(Math.abs(s)).toBeLessThanOrEqual(1);
    expect(new Set(shifts).size).toBe(shifts.length);
  });
});
