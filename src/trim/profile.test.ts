import { describe, expect, it } from 'vitest';
import { RAIL_BOTTOM_CM, railProfile, skirtingProfile } from './profile';

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

describe('skirtingProfile', () => {
  const dims = { depthCm: 2.5, torusCm: 2.4, reliefCm: 1.2, flatCm: 14 };
  const p = skirtingProfile(dims);
  const depthAt = (q: typeof p, cm: number) => q.at(cm / q.heightCm) * q.depthCm;

  it('stacks round, quirk and face into its height; a full half-round at relief = radius', () => {
    expect(p.heightCm).toBeCloseTo(2.4 + 0.3 + 14);
    expect(depthAt(p, 1.2)).toBeCloseTo(2.5, 1); // front of the round: the board's thickness
    expect(p.topDepthCm).toBeCloseTo(1.3);
  });

  it('relief sets how far the round stands proud of the face, and the face comes forward with less', () => {
    const lip = skirtingProfile({ ...dims, reliefCm: 0.4 });
    expect(depthAt(lip, 1.2) - lip.faceDepthCm).toBeCloseTo(0.4, 1);
    expect(lip.faceDepthCm).toBeGreaterThan(p.faceDepthCm);
    expect(lip.heightCm).toBeLessThan(p.heightCm); // the round meets the face partway round
  });

  it('dips at the quirk and rounds back up to the face, with no cliffs', () => {
    const meet = p.heightCm - 14 - 0.3;
    expect(depthAt(p, meet + 0.15)).toBeLessThan(depthAt(p, 10));
    for (let cm = meet; cm < meet + 0.3; cm += 0.01) expect(Math.abs(depthAt(p, cm + 0.01) - depthAt(p, cm))).toBeLessThan(0.03); // a cliff jumps 0.15+ in one step
    expect(depthAt(p, 8)).toBeCloseTo(depthAt(p, 16));
  });
});
