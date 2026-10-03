import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { kelvinRgb, lightTint, needsTint, patchRect, sunlit } from './sunlight';
import { skyAt } from './sunset';

describe('window light colour', () => {
  it('is neutral at 6500 K, warm below, cool above', () => {
    expect(lightTint(6500).map((v) => Math.round(v * 100))).toEqual([100, 100, 100]);
    const [r, g, b] = lightTint(3000);
    expect(r).toBe(1);
    expect(b).toBeLessThan(g);
    expect(g).toBeLessThan(1);
    const cool = lightTint(9000);
    expect(cool[2]).toBe(1);
    expect(cool[0]).toBeLessThan(1);
  });

  it('follows a black body: warmer light has less blue', () => {
    expect(kelvinRgb(2500)[2]).toBeLessThan(kelvinRgb(4000)[2]);
  });

  it('re-tints through a sunset that moves the kelvin only a little each tick', () => {
    const start = skyAt(CONFIG, 0);
    let applied = start, retints = 0;
    for (let k = 1; k <= 20; k++) {
      const s = { ...start, kelvin: start.kelvin - k };
      if (needsTint(applied, s)) (applied = s), retints++;
    }
    expect(retints).toBe(4);
  });
});

describe('sun patch', () => {
  it('is the window, thrown straight across with a level sun and lower with a higher one', () => {
    const level = patchRect({ ...CONFIG, ROOM_SUN_ELEVATION_DEG: 0, ROOM_SUN_AZIMUTH_DEG: 0 });
    expect(level.x1 - level.x0).toBeCloseTo(CONFIG.ROOM_WINDOW_WIDTH_CM);
    expect(level.y0).toBeCloseTo(CONFIG.ROOM_WINDOW_BOTTOM_CM);
    const high = patchRect({ ...CONFIG, ROOM_SUN_ELEVATION_DEG: 10, ROOM_SUN_AZIMUTH_DEG: 0 });
    expect(high.y0).toBeLessThan(level.y0);
    expect(high.y1 - high.y0).toBeCloseTo(level.y1 - level.y0); // parallel rays: same size
  });

  it('is there in clear sun, gone once a cloud dims the window by `hide`, and barely touched by thin cloud', () => {
    expect(sunlit(1, 0.2)).toBe(1);
    expect(sunlit(0.8, 0.2)).toBeCloseTo(0);
    expect(sunlit(0.99, 0.2)).toBeGreaterThan(0.95); // cloud depth 0.01 can't take it away
  });
});
