import { describe, expect, it } from 'vitest';
import type { GrainMaps } from '../wood/grain';
import { scuff } from './scuffs';

const len = 400, wid = 120, ppc = 10; // 40 × 12 cm
const blank = (l = len): GrainMaps => ({ albedo: new Float32Array(l * wid * 3).fill(230), gloss: new Float32Array(l * wid).fill(1), relief: new Float32Array(l * wid) });
const marked = (m: GrainMaps, v0: number, v1: number, l = len) => {
  let n = 0;
  for (let v = v0; v < v1; v++) for (let u = 0; u < l; u++) if (m.albedo[(v * l + u) * 3] < 228) n++;
  return n;
};
const all = (low: number) => scuff(blank(), len, wid, { amount: 1, low, faceTop: 20 }, 0, ppc, 1);

describe('scuff', () => {
  it('leaves the board alone at zero', () => {
    expect(scuff(blank(), len, wid, { amount: 0, low: 1, faceTop: 20 }, 0, ppc, 1)).toEqual(blank());
  });

  it('marks only the flat face', () => {
    expect(marked(all(0), 0, 20)).toBe(0);
  });

  it('clusters at the floor when low is high, and spreads up the face when it is low', () => {
    const upper = (low: number) => marked(all(low), 20, 70), lower = (low: number) => marked(all(low), 70, wid);
    expect(lower(1)).toBeGreaterThan(upper(1) * 3);
    expect(upper(0)).toBeGreaterThan(upper(1));
  });

  it('is keyed to wall position, so adjacent lengths join', () => {
    const whole = all(0.5);
    const right = scuff(blank(200), 200, wid, { amount: 1, low: 0.5, faceTop: 20 }, 200, ppc, 1);
    for (let v = 30; v < wid; v += 7) expect(right.albedo[(v * 200 + 10) * 3]).toBeCloseTo(whole.albedo[(v * len + 210) * 3]);
  });
});
