import { describe, expect, it, vi } from 'vitest';

vi.mock('./embroidery', () => ({ turnReflection: () => {} }));
const { swingRate, swingStep } = await import('./frame');

const settle = (theta: number, omega: number, s: Parameters<typeof swingStep>[3]) => {
  let crossings = 0, t = 0, side = Math.sign(theta - s.rest);
  for (; t < 30; t += 1 / 240) {
    const next = swingStep(theta, omega, 1 / 240, s);
    if (!next) break;
    ({ theta, omega } = next);
    if (Math.sign(theta - s.rest) !== side && theta !== s.rest) (crossings++, (side = -side));
  }
  return { theta, t, crossings };
};

describe('swing', () => {
  it('a picture-sized frame swings about once a second', () => {
    const period = (2 * Math.PI) / swingRate(28, 20);
    expect(period).toBeGreaterThan(0.6);
    expect(period).toBeLessThan(1.2);
  });

  const s = { rest: 1, rate: swingRate(28, 20), damping: 0.12, stick: 2.5 };

  it("let go at a silly angle, it swings past rest and settles within the hanger's grip", () => {
    const end = settle(40, 0, s);
    expect(end.crossings).toBeGreaterThan(1);
    expect(Math.abs(end.theta - s.rest)).toBeLessThanOrEqual(s.stick + 0.01);
    expect(end.t).toBeLessThan(10);
  });

  it('heavy damping settles it without swinging past', () => {
    expect(settle(30, 0, { ...s, damping: 1 }).crossings).toBe(0);
  });

  it('a small tilt is held by friction', () => {
    expect(swingStep(s.rest + 2, 0, 1 / 60, s)).toBeUndefined();
    expect(swingStep(s.rest + 5, 0, 1 / 60, s)).toBeDefined();
  });
});
