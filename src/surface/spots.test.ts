import { describe, expect, it } from 'vitest';
import { spotLayout } from './spots';

const o = { amount: 0.6, size: 4, limescale: 0, seed: 11 };

describe('spotLayout', () => {
  it('is empty at zero amount and deterministic per seed', () => {
    expect(spotLayout(300, 200, { ...o, amount: 0 })).toEqual([]);
    expect(spotLayout(300, 200, o)).toEqual(spotLayout(300, 200, o));
  });

  it('differs between surfaces so nothing visibly repeats', () => {
    const a = spotLayout(300, 200, o), b = spotLayout(300, 200, { ...o, seed: 12 });
    expect(a.slice(0, 5).map((s) => s.x)).not.toEqual(b.slice(0, 5).map((s) => s.x));
  });

  it('scales count with amount and keeps a long-tailed size mix', () => {
    const few = spotLayout(600, 400, { ...o, amount: 0.2 }).length, many = spotLayout(600, 400, { ...o, amount: 1 }).length;
    expect(many).toBeGreaterThan(few * 2);
    const rs = spotLayout(600, 400, o).map((s) => s.r).sort((a, b) => a - b);
    expect(rs[Math.floor(rs.length / 2)]).toBeLessThan(o.size); // median small
    expect(rs[rs.length - 1]).toBeGreaterThan(o.size * 1.2); // a few large
  });

  it('clusters like splashes rather than spreading evenly', () => {
    const spots = spotLayout(600, 600, { ...o, amount: 1 });
    const cells = new Array(36).fill(0);
    for (const s of spots) if (s.x >= 0 && s.y >= 0 && s.x < 600 && s.y < 600) cells[Math.floor(s.y / 100) * 6 + Math.floor(s.x / 100)]++;
    const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
    const variance = cells.reduce((a, b) => a + (b - mean) ** 2, 0) / cells.length;
    expect(variance).toBeGreaterThan(mean * 1.5); // overdispersed: an even (Poisson) spread gives ≈ mean
  });

  it('adds more and longer drips as limescale builds', () => {
    const drips = (l: number) => spotLayout(600, 400, { ...o, amount: 1, limescale: l }).filter((s) => s.drip > 0);
    expect(drips(1).length).toBeGreaterThan(drips(0).length);
  });
});
