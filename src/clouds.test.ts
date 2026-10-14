import { describe, expect, it } from 'vitest';
import { cloudLevel, cloudSplit, nextUpdate } from './clouds';
import { exposure, type Room } from './room';

const s = { depth: 0.4, rateHz: 0.5, smooth: 1, gapS: 20, passes: 3, drift: 0, driftS: 8 };
const passes = (style: typeof s, until = 3000, dt = 0.05) => {
  const out: { start: number; end: number }[] = [];
  let inPass = false;
  for (let t = 0; t < until; t += dt) {
    const dim = cloudLevel(t, style) < 1;
    if (dim && !inPass) out.push({ start: t, end: t });
    if (dim) out[out.length - 1].end = t;
    inPass = dim;
  }
  return out;
};

describe('cloudLevel', () => {
  it('stays within full sun and the deepest cloud', () => {
    for (let t = 0; t < 500; t += 0.7) {
      const k = cloudLevel(t, { ...s, drift: 0.5 });
      expect(k).toBeLessThanOrEqual(1);
      expect(k).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('is full sun with no depth', () => {
    expect(cloudLevel(12.3, { ...s, depth: 0 })).toBe(1);
  });

  it('is clear most of the time, with clouds passing now and then', () => {
    let clear = 0, n = 0;
    for (let t = 0; t < 3000; t += 0.5, n++) if (cloudLevel(t, s) === 1) clear++;
    expect(clear / n).toBeGreaterThan(0.5);
    expect(clear / n).toBeLessThan(0.9);
  });

  it('spaces clouds irregularly, about gapS apart on average', () => {
    const p = passes(s), gaps = p.slice(1).map((q, i) => q.start - p[i].end);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeGreaterThan(s.gapS * 0.7);
    expect(mean).toBeLessThan(s.gapS * 1.6);
    const spread = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
    expect(spread).toBeGreaterThan(mean * 0.25); // never a regular beat
  });

  it('a passing cloud lasts a few changes of light at rateHz', () => {
    for (const q of passes(s)) {
      const length = q.end - q.start;
      expect(length).toBeGreaterThan(1 / s.rateHz);
      expect(length).toBeLessThanOrEqual((s.passes + 2) / s.rateHz + 0.1);
    }
  });

  it('glides when smooth', () => {
    let maxJump = 0;
    for (let t = 0; t < 400; t += 0.05) maxJump = Math.max(maxJump, Math.abs(cloudLevel(t + 0.05, s) - cloudLevel(t, s)));
    expect(maxJump).toBeLessThan(0.02);
  });

  it('drifts gently in clear spells, never as deep as a cloud', () => {
    const drift = { ...s, drift: 0.25 }, seen = new Set<number>();
    for (let t = 0; t < 3000; t += 0.5) {
      const k = cloudLevel(t, drift), clear = cloudLevel(t, s) === 1;
      if (clear) seen.add(Math.round(k * 1000)), expect(k).toBeGreaterThanOrEqual(1 - s.depth * 0.25 - 1e-9);
    }
    expect(seen.size).toBeGreaterThan(20);
  });
});

describe('nextUpdate', () => {
  it('waits the longest while the light holds, and updates often while it moves', () => {
    expect(nextUpdate(10, () => 1, 0.004, 1)).toBe(1);
    expect(nextUpdate(10, (t) => t * 0.5, 0.004, 1)).toBeCloseTo(1 / 15);
    expect(nextUpdate(10, (t) => t * 0.01, 0.004, 1)).toBeGreaterThan(0.2);
  });

  it('wakes in time for a cloud starting before the longest wait', () => {
    const level = (t: number) => (t > 10.5 ? 0.9 : 1);
    expect(10 + nextUpdate(10, level, 0.004, 1)).toBeLessThanOrEqual(10.5);
  });

  it('a clear spell with drift costs about one update a second', () => {
    const style = { ...s, depth: 0.1, rateHz: 0.3, gapS: 25, drift: 0.3 }, level = (t: number) => cloudLevel(t, style);
    let t = 0, updates = 0, clearS = 0;
    while (t < 600) {
      const d = nextUpdate(t, level, 0.004, 1);
      if (cloudLevel(t, { ...style, drift: 0 }) === 1) (updates++, (clearS += d));
      t += d;
    }
    expect(updates / clearS).toBeLessThan(2);
  });
});

describe('exposure', () => {
  const room = { sun: 1, fill: 0.35, bounce: 0.25 } as Room;
  it('is 1 in full sun and dims less than the window does, because the fill stays', () => {
    expect(exposure(room, 1)).toBeCloseTo(1);
    expect(exposure(room, 0.5)).toBeGreaterThan(0.5);
    expect(exposure(room, 0.5)).toBeLessThan(1);
  });
});

describe('cloudSplit', () => {
  it('sends the cloud to the room only, both, or the reflections only', () => {
    expect(cloudSplit(0.8, 0)).toEqual({ room: 0.8, reflections: 1 });
    expect(cloudSplit(0.8, 0.5)).toEqual({ room: 0.8, reflections: 0.8 });
    expect(cloudSplit(0.8, 1)).toEqual({ room: 1, reflections: 0.8 });
  });
});
