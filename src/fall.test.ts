import { describe, expect, it, vi } from 'vitest';

vi.mock('./embroidery', () => ({ drawPending: () => {} }));
const { corners, offLip, tipStep } = await import('./fall');

const box = { x: 100, y: 50, w: 280, h: 200 };

describe('falling frame', () => {
  it('hangs from the middle of its top edge; turned, one bottom corner is lowest', () => {
    const level = corners(box, 0);
    expect(level[0]).toEqual({ x: 100, y: 50 });
    expect(level[2]).toEqual({ x: 380, y: 250 });
    const turned = corners(box, 20), low = turned.reduce((a, b) => (b.y > a.y ? b : a));
    expect(low).toBe(turned[2]); // turned clockwise, the bottom-right corner is lowest
  });

  const s = { g: 9810 * 0.6, kick: 1, tumble: 1 };
  const run = (dx: number, kick: number) => {
    let st = { pitch: 0, pitchRate: kick, roll: 0, rollRate: 0 }, t = 0;
    while (!offLip(st) && t < 5) (st = tipStep(st, 1 / 240, box.h, box.w, dx, s)), (t += 1 / 240);
    return { st, t };
  };

  it('caught square on the rail, it pitches forward off the lip without rolling', () => {
    const { st, t } = run(0, 3);
    expect(st.pitch).toBeGreaterThan(1.7);
    expect(st.roll).toBe(0);
    expect(t).toBeLessThan(1);
  });

  it('caught on a corner, it rolls away from that corner as it goes over', () => {
    expect(run(80, 3).st.roll).toBeGreaterThan(0);
    expect(run(-80, 3).st.roll).toBeLessThan(0);
  });
});
