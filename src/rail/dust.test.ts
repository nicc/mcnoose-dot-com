import { describe, expect, it } from 'vitest';
import { dustLayout, ledgeLight } from './dust';

describe('dustLayout', () => {
  it('is keyed to wall position: the same stretch of wall always gets the same dust', () => {
    const a = dustLayout(0, 400, 10, 0.5), b = dustLayout(-200, 600, 10, 0.5);
    const inA = b.clumps.filter((c) => c.x >= 10 && c.x <= 390);
    expect(inA.length).toBeGreaterThan(0);
    for (const c of inA) expect(a.clumps).toContainEqual(c);
  });

  it('is soft: clumps of a pixel or more, faint, settling near the top', () => {
    const { clumps } = dustLayout(0, 2000, 10, 0.8);
    expect(Math.min(...clumps.map((c) => c.r))).toBeGreaterThanOrEqual(1);
    expect(Math.max(...clumps.map((c) => c.alpha))).toBeLessThan(0.2);
    const upperHalf = clumps.filter((c) => c.y < 5).length;
    expect(upperHalf / clumps.length).toBeGreaterThan(0.6);
  });

  it('scales with the amount and is empty at zero', () => {
    expect(dustLayout(0, 2000, 10, 0).clumps.length).toBe(0);
    expect(dustLayout(0, 2000, 10, 1).clumps.length).toBeGreaterThan(dustLayout(0, 2000, 10, 0.3).clumps.length * 1.5);
  });
});

describe('ledgeLight', () => {
  it('a ledge facing up is brighter under ceiling light than under frontal window light', () => {
    expect(ledgeLight([{ dir: [0, -0.8, 0.6], weight: 1 }])).toBeGreaterThan(ledgeLight([{ dir: [0, 0, 1], weight: 1 }]));
  });
});
