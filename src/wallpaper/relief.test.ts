import { describe, expect, it } from 'vitest';
import { blurWrap, hexToRgb, pebbles, shade } from './relief';

const flatAlbedo = (n: number) => Uint8ClampedArray.from({ length: n * 4 }, (_, i) => [240, 230, 210, 255][i % 4]);
const base = { relief: 4, lightDeg: 135, elevationDeg: 40, ambient: 0.6, sheen: 0 };

describe('blurWrap', () => {
  it('preserves the mean and wraps across edges', () => {
    const w = 16, h = 8;
    const src = new Float32Array(w * h);
    src[0] = 1; // corner spike: its blur must appear on the opposite edges too
    const out = blurWrap(src, w, h, 2, 1);
    expect(out.reduce((s, v) => s + v, 0)).toBeCloseTo(1);
    expect(out[w - 1]).toBeGreaterThan(0); // wrapped horizontally
    expect(out[(h - 1) * w]).toBeGreaterThan(0); // wrapped vertically
  });

  it('is a no-op at radius 0', () => {
    const src = Float32Array.from([0.2, 0.9, 0.4, 0.1]);
    expect(blurWrap(src, 2, 2, 0)).toEqual(src);
  });
});

describe('shade', () => {
  it('renders flat relief exactly in the base colour', () => {
    const px = shade(new Float32Array(9).fill(0.5), 3, 3, { ...base, albedo: flatAlbedo(9) });
    expect([...px.slice(0, 4)]).toEqual([240, 230, 210, 255]);
  });

  it('lights slopes facing the light (upper left) and darkens slopes facing away', () => {
    const w = 8, h = 1;
    const rampDownRight = Float32Array.from({ length: w }, (_, x) => -x * 0.1); // faces right: away from a left light
    const rampUpRight = Float32Array.from({ length: w }, (_, x) => x * 0.1); // faces left: toward it
    const mid = 4 * 4;
    const o = { ...base, albedo: flatAlbedo(w) };
    expect(shade(rampUpRight, w, h, o)[mid]).toBeGreaterThan(240);
    expect(shade(rampDownRight, w, h, o)[mid]).toBeLessThan(240);
  });
});

describe('helpers', () => {
  it('parses hex colours', () => expect(hexToRgb('#efe6cf')).toEqual([239, 230, 207]));
  it('pebbles are seeded, bounded and tile seamlessly', () => {
    const w = 40, h = 30;
    const a = pebbles(w, h, 6, 3);
    expect(a).toEqual(pebbles(w, h, 6, 3));
    expect(Math.max(...a)).toBeLessThanOrEqual(1);
    expect(Math.max(...a)).toBeGreaterThan(0.9);
    // Wrap: the column after the last equals the first, so edge-to-edge steps look like interior steps.
    let edge = 0, inner = 0;
    for (let y = 0; y < h; y++) {
      edge += Math.abs(a[y * w] - a[y * w + w - 1]);
      inner += Math.abs(a[y * w + 1] - a[y * w]);
    }
    expect(edge).toBeLessThan(inner * 3);
  });
});
