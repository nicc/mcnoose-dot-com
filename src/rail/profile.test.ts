import { describe, expect, it } from 'vitest';
import { RAIL_BOTTOM_CM, railProfile } from './profile';

const dims = { depthCm: 2.2, roundCm: 0.8, beadCm: 0.6, coveCm: 0.7, flatCm: 3 };

describe('railProfile', () => {
  it('stacks its sections into the total height; the flat control extends it', () => {
    expect(railProfile(dims).heightCm).toBeCloseTo(0.8 + 0.6 + 0.7 + 3 + RAIL_BOTTOM_CM);
    expect(railProfile({ ...dims, flatCm: 5 }).heightCm - railProfile(dims).heightCm).toBeCloseTo(2);
  });

  it('rounds from part-way back at the top to full depth, then steps back to a flat face', () => {
    const p = railProfile(dims);
    expect(p.at(0)).toBeLessThan(0.7); // the top curves back towards the wall
    const atCm = (cm: number) => p.at(cm / p.heightCm);
    expect(atCm(0.78)).toBeCloseTo(1, 1); // full depth just before the round meets the bead's groove
    const flat = atCm(0.8 + 0.6 + 0.7 + 1.5);
    expect(flat).toBeLessThan(1);
    expect(atCm(0.8 + 0.6 + 0.7 + 2.5)).toBeCloseTo(flat); // flat really is flat
    expect(p.at(1)).toBeLessThan(flat); // rounded bottom edge
  });
});
