import { describe, expect, it } from 'vitest';
import { groutMarks, type GroutAge, type Joint } from './grout';

const g = 4;
const joints: Joint[] = [
  { x: 0, y: 0, w: g, h: 154, horizontal: false },
  { x: 0, y: 0, w: 154, h: g, horizontal: true },
];
const none: GroutAge = { age: 0, grime: 0, mould: 0, limescale: 0, erosion: 0, cracks: 0, level: 0 };

describe('groutMarks', () => {
  it('is clean when everything is off, and deterministic per seed', () => {
    expect(groutMarks(joints, g, none, 1)).toEqual([]);
    const all = { age: 0.5, grime: 0.5, mould: 0.5, limescale: 0.5, erosion: 0.5, cracks: 1, level: 1 };
    expect(groutMarks(joints, g, all, 7)).toEqual(groutMarks(joints, g, all, 7));
    expect(groutMarks(joints, g, all, 7)).not.toEqual(groutMarks(joints, g, all, 8));
  });

  it('is dirtier in horizontal joints than vertical', () => {
    const marks = groutMarks(joints, g, { ...none, grime: 1, level: 0.5 }, 3);
    const peak = (ji: number) => Math.max(...marks.filter((m) => m.kind === 'band' && m.joint === ji).flatMap((m) => (m.kind === 'band' ? m.stops.map((s) => s[1]) : [])));
    expect(peak(1)).toBeGreaterThan(peak(0));
  });

  it('puts mould and limescale only low on the wall, limescale only in horizontals', () => {
    const high = groutMarks(joints, g, { ...none, mould: 1, limescale: 1, level: 0 }, 3);
    expect(high).toEqual([]);
    const low = groutMarks(joints, g, { ...none, mould: 1, limescale: 1, level: 1 }, 3);
    const lime = low.filter((m) => m.kind === 'band');
    expect(lime.length).toBe(1);
    expect(lime[0].joint).toBe(1);
  });

  it('erosion pits are soft dots of at least a few tenths of the joint, never single pixels', () => {
    const dots = groutMarks(joints, g, { ...none, erosion: 1 }, 5).filter((m) => m.kind === 'dot');
    expect(dots.length).toBeGreaterThan(10);
    for (const d of dots) if (d.kind === 'dot') expect(d.r).toBeGreaterThanOrEqual(g * 0.15);
  });
});
