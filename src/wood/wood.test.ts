import { describe, expect, it } from 'vitest';
import { frameProfile, shadeBoard, type Finish } from './board';
import { weather } from './wear';
import { grainMaps, type GrainMaps, type GrainStyle } from './grain';
import { fbm, noise } from './noise';

const oak: GrainStyle = { early: [120, 85, 55], late: [50, 30, 18], ringPx: 4, figure: 0.6, pores: 0.6, drift: 0.3, seed: 3 };

describe('noise', () => {
  it('is seeded and wraps with a period', () => {
    expect(noise(1.3, 2.7, 5)).toBe(noise(1.3, 2.7, 5));
    expect(noise(1.3, 2.7, 5, 8)).toBeCloseTo(noise(9.3, 2.7, 5, 8));
    expect(fbm(0.4, 0.2, 1, 4, 4)).toBeCloseTo(fbm(4.4, 0.2, 1, 4, 4));
  });
});

describe('grainMaps', () => {
  const len = 120, wid = 30;
  const m = grainMaps(len, wid, oak);

  it('shows growth rings: a real spread between lighter earlywood and darker latewood', () => {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < len * wid; i++) {
      const r = m.albedo[i * 3];
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    expect(max - min).toBeGreaterThan(40);
  });

  it('makes pores dull and sunken', () => {
    const p = grainMaps(len, wid, { ...oak, pores: 1 });
    let seen = false;
    for (let i = 0; i < len * wid; i++) if (p.relief[i] < -0.2) (seen = true), expect(p.gloss[i]).toBeLessThan(0.5);
    expect(seen).toBe(true);
  });

  it('repeats seamlessly along the length when periodic: the wrap step looks like any other step', () => {
    // Pores are hard-edged cells by design, so compare ring/colour continuity without them.
    const per = grainMaps(len, wid, { ...oak, pores: 0 }, len);
    const step = (a: number, b: number) => {
      let d = 0;
      for (let v = 0; v < wid; v++) d += Math.abs(per.albedo[(v * len + a) * 3] - per.albedo[(v * len + b) * 3]);
      return d;
    };
    let mean = 0;
    for (let u = 0; u < len - 1; u++) mean += step(u, u + 1) / (len - 1);
    expect(step(len - 1, 0)).toBeLessThan(mean * 3 + 1);
  });
});

describe('shadeBoard', () => {
  const flat: Finish = { profile: () => 0.5, profileDepth: 0, grainDepth: 0, sheen: 0, gloss: 0.5, ambient: 0.6 };
  const maps = { albedo: new Float32Array(4 * 4 * 3).fill(100), gloss: new Float32Array(16).fill(1), relief: new Float32Array(16) };

  it('renders a flat matte board exactly in its albedo', () => {
    const px = shadeBoard(maps, 4, 4, flat, [0.5, -0.5, 0.7]);
    expect([...px.slice(0, 4)]).toEqual([100, 100, 100, 255]);
  });

  it('adds sheen only where gloss allows', () => {
    const shiny = shadeBoard(maps, 4, 4, { ...flat, sheen: 1, gloss: 0 }, [0, 0, 1]);
    const dull = shadeBoard({ ...maps, gloss: new Float32Array(16) }, 4, 4, { ...flat, sheen: 1, gloss: 0 }, [0, 0, 1]);
    expect(shiny[0]).toBeGreaterThan(dull[0] + 50);
  });

  it('frame profile rises from the outer edge, peaks on the face and drops at the rebate', () => {
    expect(frameProfile(0)).toBeCloseTo(0);
    expect(frameProfile(0.4)).toBeGreaterThan(0.9);
    expect(frameProfile(1)).toBeLessThan(0.2);
  });
});

describe('weather', () => {
  const len = 60, wid = 20;
  const blank = (): GrainMaps => ({ albedo: new Float32Array(len * wid * 3).fill(100), gloss: new Float32Array(len * wid).fill(1), relief: new Float32Array(len * wid) });
  const row = (m: GrainMaps, v: number) => {
    let s = 0;
    for (let u = 20; u < 40; u++) s += m.albedo[(v * len + u) * 3];
    return s / 20;
  };
  const base = { wear: 0.8, grime: 0.8, patches: 0, mitres: false, seed: 1 };

  it('leaves the board alone when wear and grime are zero', () => {
    expect(weather(blank(), len, wid, frameProfile, { ...base, wear: 0, grime: 0 })).toEqual(blank());
  });

  it('pales the raised face and darkens the low rebate', () => {
    const m = weather(blank(), len, wid, frameProfile, base);
    const face = Math.round(wid * 0.4), rebate = wid - 1;
    expect(row(m, face)).toBeGreaterThan(100);
    expect(row(m, rebate)).toBeLessThan(100);
  });

  it('collects grime along mitre joints at both ends', () => {
    const m = weather(blank(), len, wid, () => 0.7, { ...base, wear: 0, mitres: true });
    const at = (u: number, v: number) => m.albedo[(v * len + u) * 3];
    expect(at(10, 10)).toBeLessThan(at(30, 10)); // on the start mitre vs mid-board
    expect(at(len - 11, 10)).toBeLessThan(at(30, 10)); // on the end mitre
  });
});
