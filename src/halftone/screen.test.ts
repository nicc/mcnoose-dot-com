import { describe, expect, it } from 'vitest';
import { boxMean, densityFromRGBA, dotRadius, integral, screenDots } from './screen';

const opts = { pitch: 4, angleDeg: 45, gain: 1, minDot: 0, jitter: 0, noise: 0, seed: 1 };

describe('densityFromRGBA', () => {
  it('maps dark opaque to 1, white or transparent to 0, colour to tone', () => {
    const d = densityFromRGBA(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 0, 255]));
    expect([...d.slice(0, 3)]).toEqual([1, 0, 0]);
    expect(d[3]).toBeCloseTo(0.0722, 3); // yellow barely inks
  });
});

describe('integral + boxMean', () => {
  it('averages any box exactly', () => {
    const w = 4, h = 3;
    const d = Float32Array.from({ length: w * h }, (_, i) => (i % w < 2 ? 1 : 0));
    const s = integral(d, w, h);
    expect(boxMean(s, w, h, 2, 1.5, 2)).toBeCloseTo(0.5);
    expect(boxMean(s, w, h, 1, 1.5, 1)).toBeCloseTo(1);
    expect(boxMean(s, w, h, 100, 100, 1)).toBe(0);
  });
});

describe('dotRadius', () => {
  it('gives dot area proportional to density, capped so solids close up', () => {
    expect(Math.PI * dotRadius(0.25, 10, 1) ** 2).toBeCloseTo(25);
    expect(dotRadius(1, 10, 3)).toBe(7.5);
  });
});

describe('screenDots', () => {
  const w = 64, h = 64;
  const half = Float32Array.from({ length: w * h }, (_, i) => (i % w < 32 ? 1 : 0));

  it('prints nothing on blank and only where there is ink', () => {
    expect(screenDots(new Float32Array(w * h), w, h, opts).length).toBe(0);
    const dots = screenDots(half, w, h, opts);
    for (let i = 0; i < dots.length; i += 3) expect(dots[i]).toBeLessThan(32 + opts.pitch);
  });

  it('covers roughly the inked area at gain 1', () => {
    const dots = screenDots(half, w, h, opts);
    let area = 0;
    for (let i = 2; i < dots.length; i += 3) area += Math.PI * dots[i] ** 2;
    expect(area / (32 * 64)).toBeGreaterThan(0.8);
    expect(area / (32 * 64)).toBeLessThan(1.3);
  });

  it('is deterministic per seed and varies across seeds', () => {
    const o = { ...opts, jitter: 0.2, noise: 0.2 };
    expect(screenDots(half, w, h, o)).toEqual(screenDots(half, w, h, o));
    expect(screenDots(half, w, h, { ...o, seed: 2 })).not.toEqual(screenDots(half, w, h, o));
  });

  it('drops dots below minDot', () => {
    const faint = new Float32Array(w * h).fill(0.01);
    expect(screenDots(faint, w, h, { ...opts, minDot: 0.2 }).length).toBe(0);
    expect(screenDots(faint, w, h, opts).length).toBeGreaterThan(0);
  });
});
