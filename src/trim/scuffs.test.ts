import { describe, expect, it } from 'vitest';
import type { GrainMaps } from '../wood/grain';
import { scuff } from './scuffs';

const len = 200, wid = 80;
const blank = (): GrainMaps => ({ albedo: new Float32Array(len * wid * 3).fill(230), gloss: new Float32Array(len * wid).fill(1), relief: new Float32Array(len * wid) });
const darkened = (m: GrainMaps, v0: number, v1: number) => {
  let n = 0;
  for (let v = v0; v < v1; v++) for (let u = 0; u < len; u++) if (m.albedo[(v * len + u) * 3] < 229) n++;
  return n;
};

describe('scuff', () => {
  it('leaves the board alone at zero', () => {
    expect(scuff(blank(), len, wid, 0, 0, 10, 1)).toEqual(blank());
  });

  it('marks only the lower part of the face, most near the floor', () => {
    const m = scuff(blank(), len, wid, 1, 0, 10, 1);
    expect(darkened(m, 0, 30)).toBe(0);
    expect(darkened(m, 60, 80)).toBeGreaterThan(darkened(m, 36, 56));
  });

  it('is keyed to wall position, so adjacent lengths join', () => {
    const whole = scuff(blank(), len, wid, 1, 0, 10, 1);
    const right = scuff({ albedo: new Float32Array(100 * wid * 3).fill(230), gloss: new Float32Array(100 * wid).fill(1), relief: new Float32Array(100 * wid) }, 100, wid, 1, 100, 10, 1);
    for (let v = 50; v < wid; v += 7) expect(right.albedo[(v * 100 + 10) * 3]).toBeCloseTo(whole.albedo[(v * len + 110) * 3]);
  });
});
