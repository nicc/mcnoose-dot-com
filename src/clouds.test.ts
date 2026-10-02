import { describe, expect, it } from 'vitest';
import { cloudLevel, cloudSplit } from './clouds';
import { exposure, type Room } from './room';

const s = { depth: 0.4, rateHz: 0.1, smooth: 1 };

describe('cloudLevel', () => {
  it('stays within full sun and the deepest cloud', () => {
    for (let t = 0; t < 500; t += 0.7) {
      const k = cloudLevel(t, s);
      expect(k).toBeLessThanOrEqual(1);
      expect(k).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('is full sun with no depth', () => {
    expect(cloudLevel(12.3, { ...s, depth: 0 })).toBe(1);
  });

  it('glides when smooth, steps when not', () => {
    let maxJump = 0;
    for (let t = 0; t < 200; t += 0.05) maxJump = Math.max(maxJump, Math.abs(cloudLevel(t + 0.05, s) - cloudLevel(t, s)));
    expect(maxJump).toBeLessThan(0.01);
    const stepped = { ...s, smooth: 0 };
    expect(cloudLevel(10.2, stepped)).toBe(cloudLevel(19.8, stepped)); // held for the whole step
    let jumps = 0;
    for (let t = 0; t < 200; t += 0.05) if (Math.abs(cloudLevel(t + 0.05, stepped) - cloudLevel(t, stepped)) > 0.02) jumps++;
    expect(jumps).toBeGreaterThan(5);
  });

  it('changes level about rateHz times a second', () => {
    const slow = new Set<number>(), fast = new Set<number>();
    for (let t = 0; t < 100; t += 1) {
      slow.add(cloudLevel(t, { ...s, smooth: 0, rateHz: 0.05 }));
      fast.add(cloudLevel(t, { ...s, smooth: 0, rateHz: 0.5 }));
    }
    expect(fast.size).toBeGreaterThan(slow.size * 5);
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
